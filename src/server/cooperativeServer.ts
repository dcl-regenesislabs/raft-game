import { RELEASE } from '../config/release'
import { IS_PRODUCTION } from '../config/env'
import { Release, handoffKey, isNewerRelease, readPublishedRelease, releaseNamespace } from '../multiplayer/releases'
import { inheritReleaseWorld } from './releaseWorld'
import { engine, PlayerIdentityData, Transform } from '@dcl/sdk/ecs'
import { worldRoom } from '../shared/messages'
import {
  MULTIPLAYER_MAX_PENDING,
  MULTIPLAYER_MAX_PLAYERS,
  MULTIPLAYER_BATCH_S,
  MULTIPLAYER_CHECKPOINT_S,
  MULTIPLAYER_BACKUP_S,
  MULTIPLAYER_HEARTBEAT_S,
  MULTIPLAYER_TIMEOUT_S
} from '../config/gameConfig'
import { executeRequest } from '../multiplayer/authority'
import { LiveAuthority } from '../multiplayer/liveAuthority'
import { WorldRepository } from '../multiplayer/persistence'
import { worldStorage } from './worldStorage'
import {
  ActionResult,
  clone,
  PROTOCOL_VERSION,
  publicWorld,
  Request,
  Snapshot,
  Vec,
  PublicWorld,
  Delta
} from '../multiplayer/types'
import { freshPlayer, freshWorld } from '../multiplayer/world'
import { simulateWorld } from '../multiplayer/simulation'
import { Chunk, makeDelta, splitMessage } from '../multiplayer/transport'

type Peer = {
  session: string
  at: number
  joined: boolean
  playing: boolean
  snapshot: Snapshot | null
  outgoing: Chunk[]
  lastJoin: number
}
export function runCooperativeServer(): void {
  const server = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  const repository = new WorldRepository(worldStorage, server, releaseNamespace(RELEASE.id))
  let lastVersionCheck = -Infinity,
    versionPollAt = 0,
    versionBusy = false
  let replacement: Release | null = null,
    drained = false,
    drainBusy = false,
    drainRetryAt = 0
  let inheritanceStartedAt = 0
  const versionAllowed = (): boolean => !IS_PRODUCTION || (!replacement && Date.now() - lastVersionCheck < 30000)
  const releaseMessage = (): string =>
    JSON.stringify({
      release: replacement ?? RELEASE,
      phase: replacement ? (drained ? 'reload' : 'updating') : versionAllowed() ? 'active' : 'checking'
    })
  const versions = new Map<string, { session: string; release: string; at: number }>()
  const peers = new Map<string, Peer>()
  const requests: { address: string; request: Request }[] = []
  let coordinator: LiveAuthority | null = null
  let startupPersisted = false
  let stopped = false
  let ready = false,
    busy = false,
    elapsed = 0,
    pulse = MULTIPLAYER_HEARTBEAT_S,
    status = 'Loading shared world',
    retryAt = 0
  let receipts: { address: string; result: ActionResult }[] = []
  let backupElapsed = 0,
    backupBusy = false,
    backupRequested = false,
    backupRetryAt = 0
  let resetCandidate: import('../multiplayer/types').WorldState | null = null
  let oldGeneration = 0
  let transferSequence = 0
  let publishedWorld: PublicWorld | null = null
  const sharedDeltas = new Map<number, Delta>()
  const positions = (): Map<string, Vec> => {
    const found = new Map<string, Vec>()
    for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
      const t = Transform.getOrNull(entity)
      if (t) found.set(identity.address.toLowerCase(), { ...t.position })
    }
    return found
  }
  const sendState = (address: string, peer: Peer, full = false): void => {
    if (!coordinator || !peer.joined) return
    const w = coordinator.state
    const player = w.players[address]
    if (!player?.sessions[peer.session]) {
      peer.joined = false
      return
    }
    if (publishedWorld?.revision !== w.revision) {
      publishedWorld = publicWorld(w)
      sharedDeltas.clear()
    }
    const snapshot: Snapshot = { world: publishedWorld, player: clone(player), session: peer.session }
    if (!full && peer.snapshot?.world.revision === snapshot.world.revision) return
    // Finish in-flight snapshots before scheduling another revision.
    if (peer.outgoing.length && !full) return
    // Explicit resync replaces a broken transfer with a complete snapshot.
    const reset = full || !peer.snapshot || peer.outgoing.length > 0 || peer.snapshot.world.generation !== w.generation
    let delta: Delta | null = null
    if (!reset) {
      const base = peer.snapshot!.world.revision
      delta = sharedDeltas.get(base) ?? makeDelta(peer.snapshot!.world, snapshot)
      sharedDeltas.set(base, delta)
    }
    const packet = reset
      ? { kind: 'snapshot', value: snapshot }
      : { kind: 'delta', value: { ...delta!, player: snapshot.player, session: snapshot.session } }
    peer.outgoing = splitMessage(`${server}:${w.revision}:${++transferSequence}`, packet)
    peer.snapshot = snapshot
  }
  worldRoom.onMessage('worldClientVersion', (data, ctx) => {
    const address = (ctx?.from ?? '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(address) || data.payload.length > 400) return
    for (const [wallet, version] of versions) if (Date.now() - version.at > 8000) versions.delete(wallet)
    if (!versions.has(address) && versions.size >= MULTIPLAYER_MAX_PLAYERS * 2) return
    try {
      const version = JSON.parse(data.payload)
      if (
        typeof version.session !== 'string' ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(version.session) ||
        typeof version.release !== 'string'
      )
        return
      versions.set(address, { session: version.session, release: version.release, at: Date.now() })
    } catch {
      /* malformed version envelopes cannot join */
    }
  })
  worldRoom.onMessage('worldHello', (data, ctx) => {
    const address = (ctx?.from ?? '').toLowerCase()
    if (
      !/^0x[0-9a-f]{40}$/.test(address) ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(data.session) ||
      data.protocol !== PROTOCOL_VERSION
    )
      return
    const version = versions.get(address)
    if (IS_PRODUCTION && (version?.session !== data.session || version?.release !== RELEASE.id)) {
      void worldRoom.send('worldRelease', { payload: releaseMessage() }, { to: [address] }).catch(() => {})
      return
    }
    const reject = (error: string): void => {
      void worldRoom.send('worldJoinRejected', { session: data.session, error }, { to: [address] }).catch(() => {})
    }
    const saved = coordinator?.state.players[address]
    const createdAt = parseInt(data.session.split('-')[0], 36)
    if (
      !Number.isSafeInteger(createdAt) ||
      (saved && !saved.sessions[data.session] && createdAt <= (saved.retiredSessionBefore ?? 0))
    ) {
      reject('This connection expired. Reload to join again.')
      return
    }
    const previous = peers.get(address)
    if (!previous && peers.size >= MULTIPLAYER_MAX_PLAYERS) {
      reject('This raft is full. Retrying…')
      return
    }
    // One active session per wallet. A second device cannot take over while the first is live.
    if (previous && previous.session !== data.session && Date.now() - previous.at < MULTIPLAYER_TIMEOUT_S * 1000) {
      reject('This wallet is playing on another device. Close it there to join.')
      return
    }
    const peer =
      previous?.session === data.session
        ? previous
        : {
            session: data.session,
            at: Date.now(),
            joined: false,
            playing: false,
            snapshot: null,
            outgoing: [],
            lastJoin: 0
          }
    peer.at = Date.now()
    peer.playing = peer.joined && !data.resync
    peers.set(address, peer)
    if (data.resync && ready && peer.joined && !peer.outgoing.length && Date.now() - peer.lastJoin >= 1000) {
      peer.lastJoin = Date.now()
      sendState(address, peer, true)
    }
  })
  worldRoom.onMessage('worldCommand', (data, ctx) => {
    const address = (ctx?.from ?? '').toLowerCase(),
      peer = peers.get(address)
    if (!ready || !peer?.joined || data.payload.length > 4000 || requests.length >= MULTIPLAYER_MAX_PENDING) return
    try {
      const request = JSON.parse(data.payload) as Request
      if (
        request.session !== peer.session ||
        !Number.isSafeInteger(request.sequence) ||
        request.sequence < 1 ||
        !request.action ||
        typeof request.action.kind !== 'string'
      )
        return
      if (requests.some((p) => p.address === address && p.request.sequence === request.sequence)) return
      if (requests.filter((p) => p.address === address).length >= 2) return
      peer.playing = true
      requests.push({ address, request })
    } catch {
      /* malformed messages have no effects */
    }
  })
  async function work(): Promise<void> {
    if (!versionAllowed() || stopped || busy || Date.now() < retryAt) return
    busy = true
    try {
      if (!coordinator) {
        if (!peers.size) return
        const saved = await repository.load()
        let inherited = null
        if (!saved && RELEASE.id !== 'dev') {
          if (!inheritanceStartedAt) inheritanceStartedAt = Date.now()
          const transfer = await inheritReleaseWorld(worldStorage, RELEASE, Date.now() - inheritanceStartedAt >= 20000)
          if (transfer.waiting) {
            status = 'Transferring shared raft from the previous version…'
            return
          }
          inherited = transfer.world
        }
        const initial = saved ?? inherited ?? freshWorld()
        coordinator = new LiveAuthority(initial, repository)
        startupPersisted = saved !== null
        if (!saved) coordinator.stage(initial)
      }
      const revisionBefore = coordinator.state.revision
      if (!startupPersisted) {
        await coordinator.checkpoint()
        startupPersisted = true
      }
      if (resetCandidate) {
        await coordinator.reset(resetCandidate)
        resetCandidate = null
      } else {
        const verified = positions()
        const next = clone(coordinator.state)
        const online = new Set<string>()
        for (const [address, peer] of peers) {
          if (Date.now() - peer.at > MULTIPLAYER_TIMEOUT_S * 1000) {
            peers.delete(address)
            backupRequested = true
            continue
          }
          const position = verified.get(address)
          if (!position) continue
          const player = next.players[address] ?? (next.players[address] = freshPlayer(address))
          if (
            !player.sessions[peer.session] &&
            parseInt(peer.session.split('-')[0], 36) <= (player.retiredSessionBefore ?? 0)
          ) {
            peers.delete(address)
            continue
          }
          if (peer.playing) online.add(address)
          else player.rescueCooldown = Math.max(3, player.rescueCooldown)
          if (!player.sessions[peer.session]) {
            // Keep a bounded history; old sessions cannot reconnect once evicted.
            const entries = Object.keys(player.sessions)
            if (entries.length >= 8) {
              const oldest = entries.sort((a, b) => parseInt(a.split('-')[0], 36) - parseInt(b.split('-')[0], 36))[0]
              player.retiredSessionBefore = Math.max(
                player.retiredSessionBefore ?? 0,
                parseInt(oldest.split('-')[0], 36)
              )
              delete player.sessions[oldest]
            }
            player.sessions[peer.session] = { sequence: 0, ok: true, error: '' }
          }
          if (peer.playing && player.rescueCooldown <= 0) player.position = position
        }
        const dt = Math.min(1, elapsed)
        elapsed = 0
        simulateWorld(next, dt, online)
        let candidate = next
        receipts = []
        for (const entry of requests.splice(0, MULTIPLAYER_MAX_PENDING)) {
          if (!online.has(entry.address) || peers.get(entry.address)?.session !== entry.request.session) continue
          const applied = executeRequest(candidate, entry.address, entry.request)
          candidate = applied.world
          receipts.push({ address: entry.address, result: applied.result })
          if (candidate.generation !== next.generation) break
        }
        oldGeneration = coordinator.state.generation
        if (candidate.generation !== oldGeneration) {
          resetCandidate = candidate
          await coordinator.reset(candidate)
          resetCandidate = null
        } else if (!ready || JSON.stringify(candidate) !== JSON.stringify(coordinator.state))
          coordinator.stage(candidate)
      }
      const changed = revisionBefore !== coordinator.state.revision
      ready = true
      status = 'ready'
      for (const [address, peer] of peers) {
        const exists = !!coordinator.state.players[address]?.sessions[peer.session]
        if (!exists) {
          peer.joined = false
          peer.playing = false
          peer.snapshot = null
          peer.outgoing = []
          continue
        }
        const first = !peer.joined
        peer.joined = true
        if (changed || first) sendState(address, peer, first || oldGeneration !== coordinator.state.generation)
      }
      for (const receipt of receipts.splice(0)) {
        receipt.result.revision = coordinator.state.revision
        void worldRoom
          .send('worldResult', { payload: JSON.stringify(receipt.result) }, { to: [receipt.address] })
          .catch(() => {})
      }
    } catch (error) {
      status = 'Saving unavailable — retrying safely'
      retryAt = Date.now() + 2000
      console.error('[SERVER] Cooperative world:', error)
    } finally {
      busy = false
    }
  }
  let batch = 0,
    sendBusy = false,
    sendCursor = 0,
    sendTokens = 20
  engine.addSystem((dt) => {
    if (!worldRoom.isReady()) return
    if (IS_PRODUCTION && !versionBusy && Date.now() >= versionPollAt) {
      versionBusy = true
      versionPollAt = Date.now() + 5000
      void readPublishedRelease()
        .then((latest) => {
          lastVersionCheck = Date.now()
          if (isNewerRelease(RELEASE, latest)) replacement = latest
        })
        .catch((error) => {
          console.error('[SERVER] Release check unavailable', error)
        })
        .finally(() => {
          versionBusy = false
        })
    }
    if (!versionAllowed()) {
      ready = false
      status = replacement
        ? 'A new version is available. Re-enter the world to continue.'
        : 'Checking deployed version…'
    }
    if (replacement && !drained && !busy && !drainBusy && Date.now() >= drainRetryAt) {
      drainBusy = true
      requests.length = 0
      const target = replacement
      void (async () => {
        if (coordinator) {
          // First reconcile an uncertain older write, then save the final live state.
          await coordinator.checkpoint()
          await coordinator.checkpoint()
          if (
            !(await worldStorage.write(handoffKey(RELEASE.id, target.id), {
              from: RELEASE.id,
              to: target.id,
              revision: coordinator.state.revision
            }))
          )
            throw Error('Handoff acknowledgement was not saved')
        }
        drained = true
      })()
        .catch((error) => {
          drainRetryAt = Date.now() + 5000
          console.error('[SERVER] Final handoff backup pending', error)
        })
        .finally(() => {
          drainBusy = false
        })
    }
    elapsed += Math.max(0, dt)
    backupElapsed += Math.max(0, dt)
    if (
      ready &&
      coordinator &&
      !backupBusy &&
      !resetCandidate &&
      Date.now() >= backupRetryAt &&
      (backupRequested || backupElapsed >= MULTIPLAYER_BACKUP_S)
    ) {
      backupRequested = false
      backupElapsed = 0
      backupBusy = true
      const recovering = backupRetryAt > 0
      void coordinator
        .checkpoint()
        .then(() => {
          // After reconciling an old uncertain backup, immediately capture the newer live state once.
          if (recovering) backupRequested = true
          backupRetryAt = 0
        })
        .catch((error) => {
          backupRequested = true
          backupRetryAt = Date.now() + 5000
          if (String(error).includes('Another server changed')) {
            stopped = true
            ready = false
            status = 'Another authority owns this world. Reconnect.'
          }
          console.error('[SERVER] Backup delayed; gameplay remains in memory:', error)
        })
        .finally(() => {
          backupBusy = false
        })
    }
    batch += dt
    pulse += dt
    if (pulse >= MULTIPLAYER_HEARTBEAT_S) {
      pulse = 0
      void worldRoom.send('worldPulse', { server, status }).catch(() => {})
      void worldRoom.send('worldRelease', { payload: releaseMessage() }).catch(() => {})
    }
    if (
      batch >= MULTIPLAYER_BATCH_S &&
      (requests.length || elapsed >= MULTIPLAYER_CHECKPOINT_S || !ready || [...peers.values()].some((p) => !p.joined))
    ) {
      batch = 0
      void work()
    }
    sendTokens = Math.min(20, sendTokens + Math.max(0, dt) * 200)
    if (!sendBusy) {
      const jobs: Promise<unknown>[] = []
      // Bound host calls and rotate recipients so a large snapshot cannot starve later joins.
      const recipients = [...peers.entries()]
      for (let n = 0; n < recipients.length && jobs.length < 16 && sendTokens >= 1; n++) {
        const [address, peer] = recipients[sendCursor++ % recipients.length]
        for (let i = 0; i < 2 && peer.outgoing.length && jobs.length < 16 && sendTokens >= 1; i++) {
          sendTokens--
          jobs.push(worldRoom.send('worldChunk', peer.outgoing.shift()!, { to: [address] }))
        }
      }
      if (jobs.length) {
        sendBusy = true
        void Promise.all(jobs)
          .catch(() => {})
          .finally(() => {
            sendBusy = false
          })
      }
    }
  })
  console.log('[SERVER] Cooperative authority started', server)
}
