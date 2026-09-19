import { RELEASE } from '../config/release'
import { IS_PRODUCTION } from '../config/env'
import { isNewerRelease, parseRelease, readPublishedRelease } from '../multiplayer/releases'
import { isCraftOpen } from '../ui/craftToggle'
import { isCookOpen } from '../ui/cookToggle'
import { isStorageOpen } from '../ui/storageToggle'
import { equipCraftedItem } from '../systems/nativeEquipment'
import { engine, InputModifier, Transform } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { worldRoom } from '../shared/messages'
import { Action, ActionResult, Delta, PROTOCOL_VERSION, Request, Snapshot } from '../multiplayer/types'
import { predictSnapshot } from '../multiplayer/prediction'
import { tileObjectId } from '../multiplayer/world'
import { applyDelta, Assembler } from '../multiplayer/transport'
import {
  enableMultiplayer,
  getUpdateNotice,
  setUpdateNotice,
  getMultiplayerSnapshot,
  multiplayerReady,
  setMultiplayerSnapshot,
  setMultiplayerStatus
} from './multiplayerState'
import { renderWorld } from './worldRenderer'
import { isSystemMenuOpen } from '../ui/systemSession'
import { isInventoryOpen } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'

export function initCooperativeClient(): void {
  const session = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
  const assembler = new Assembler()
  let heartbeat = -Infinity,
    server = '',
    sequence = 0,
    lastHello = -Infinity,
    lastSend = -Infinity
  let needsSnapshot = true
  const pending: Request[] = []
  let confirmed: Snapshot | null = null
  let joinError = ''
  let serverStatus = '',
    lastLocked: boolean | null = null
  const buffered: Delta[] = []
  function present(): void {
    if (!confirmed) return
    const predicted = predictSnapshot(confirmed, pending, Transform.getOrNull(engine.PlayerEntity)?.position)
    renderWorld(predicted, getMultiplayerSnapshot())
    setMultiplayerSnapshot(predicted)
  }
  enableMultiplayer((action: Action) => {
    if (pending.length >= 8 || !confirmed || !multiplayerReady()) return false
    // Do not repeatedly enqueue the same water object while the hook overlaps it.
    if (
      action.kind === 'collect' &&
      pending.some((p) => p.action.kind === 'collect' && p.action.target === action.target)
    )
      return false
    pending.push({
      protocol: PROTOCOL_VERSION,
      generation: confirmed.world.generation,
      session,
      sequence: ++sequence,
      action
    })
    if (pending.length === 1) lastSend = -Infinity
    present()
    return true
  })
  function requireUpdate(release: typeof RELEASE, phase: 'updating' | 'reload'): void {
    pending.length = 0
    if (confirmed) present()
    setUpdateNotice({ phase, incompatible: release.compatibility !== RELEASE.compatibility, build: release.id })
  }
  worldRoom.onMessage('worldRelease', (data) => {
    try {
      const message = JSON.parse(data.payload)
      const release = parseRelease(message.release)
      if (isNewerRelease(RELEASE, release)) requireUpdate(release, message.phase === 'updating' ? 'updating' : 'reload')
      else if (release.id === RELEASE.id && !getUpdateNotice()?.build) {
        setUpdateNotice(message.phase === 'checking' ? { phase: 'checking', incompatible: false, build: '' } : null)
      }
    } catch {
      /* malformed notices cannot unlock gameplay */
    }
  })
  let versionPollAt = 0,
    versionBusy = false
  // Pinned SDK Room filters client callbacks to AUTH_SERVER_PEER_ID and intentionally omits context.
  worldRoom.onMessage('worldPulse', (pulse) => {
    if (server !== pulse.server) {
      if (server) {
        pending.length = 0
        confirmed = null
        sequence = 0
      }
      server = pulse.server
      needsSnapshot = true
      assembler.clear()
      buffered.length = 0
    }
    heartbeat = Date.now()
    serverStatus = pulse.status
  })
  worldRoom.onMessage('worldJoinRejected', (data) => {
    if (data.session === session) joinError = data.error
  })
  function acknowledge(result: ActionResult): void {
    const head = pending[0]
    if (!head || result.session !== session || result.sequence !== head.sequence) return
    if (!result.ok) showNotification(result.error)
    else if (head.action.kind === 'craft') equipCraftedItem(head.action.item)
    // Requests queued against a predicted construction must use its confirmed identity.
    if (result.ok && confirmed && (head.action.kind === 'build' || head.action.kind === 'place')) {
      const cell = head.action.kind === 'build' ? `${head.action.x},${head.action.z}` : head.action.target.split('@')[0]
      const old = getMultiplayerSnapshot()?.world.tiles[cell]
      const actual = confirmed.world.tiles[cell]
      if (old && actual)
        for (const request of pending.slice(1)) {
          if ('target' in request.action && request.action.target === tileObjectId(old))
            request.action.target = tileObjectId(actual)
        }
    }
    pending.shift()
    lastSend = -Infinity
  }
  worldRoom.onMessage('worldResult', (data) => {
    try {
      const result = JSON.parse(data.payload) as ActionResult
      if (
        confirmed &&
        confirmed.world.generation === result.generation &&
        confirmed.world.revision >= result.revision
      ) {
        acknowledge(result)
        present()
      }
    } catch {
      needsSnapshot = true
    }
  })
  worldRoom.onMessage('worldChunk', (chunk) => {
    if (!server || !chunk.id.startsWith(server + ':')) return
    try {
      const packet = assembler.accept(chunk, Date.now()) as { kind: string; value: Snapshot | Delta } | null
      if (!packet) return
      let snapshot: Snapshot
      const previous = confirmed
      if (packet.kind === 'snapshot') {
        snapshot = packet.value as Snapshot
        if (snapshot.session !== session || snapshot.world.version !== 1) return
        if (
          previous &&
          (snapshot.world.generation < previous.world.generation ||
            (snapshot.world.generation === previous.world.generation &&
              snapshot.world.revision < previous.world.revision))
        )
          return
        needsSnapshot = false
        joinError = ''
      } else {
        const delta = packet.value as Delta
        if (delta.session !== session || (previous && delta.generation < previous.world.generation)) return
        if (!previous || needsSnapshot || delta.base > previous.world.revision) {
          if (buffered.length >= 64) buffered.shift()
          buffered.push(delta)
          needsSnapshot = true
          return
        }
        if (delta.revision <= previous.world.revision) return
        snapshot = applyDelta(previous, delta)
      }
      buffered.sort((a, b) => a.base - b.base)
      for (const delta of buffered) {
        if (delta.generation === snapshot.world.generation && delta.base === snapshot.world.revision)
          snapshot = applyDelta(snapshot, delta)
      }
      for (let i = buffered.length - 1; i >= 0; i--) {
        if (
          buffered[i].generation < snapshot.world.generation ||
          (buffered[i].generation === snapshot.world.generation && buffered[i].revision <= snapshot.world.revision)
        )
          buffered.splice(i, 1)
      }
      needsSnapshot = buffered.length > 0
      if (previous && previous.world.generation !== snapshot.world.generation) {
        pending.length = 0
        sequence = 0
      }
      confirmed = snapshot
      const saved = snapshot.player.sessions[session]
      if (saved) {
        if (pending[0] && saved.sequence === pending[0].sequence)
          acknowledge({ ...saved, session, generation: snapshot.world.generation, revision: snapshot.world.revision })
        if (!pending.length) sequence = saved.sequence
      }
      present()
    } catch (error) {
      console.error('[CLIENT] World synchronization failed', error)
      assembler.clear()
      needsSnapshot = true
    }
  })
  engine.addSystem(() => {
    const now = Date.now()
    if (IS_PRODUCTION && !versionBusy && now >= versionPollAt) {
      versionBusy = true
      versionPollAt = now + 15000
      void readPublishedRelease()
        .then((latest) => {
          if (isNewerRelease(RELEASE, latest)) requireUpdate(latest, 'reload')
        })
        .catch(() => {})
        .finally(() => {
          versionBusy = false
        })
    }
    const live = isStateSyncronized() && now - heartbeat < 8000
    if (!live) needsSnapshot = true
    const ready =
      !getUpdateNotice() &&
      live &&
      !joinError &&
      !needsSnapshot &&
      serverStatus === 'ready' &&
      !!getMultiplayerSnapshot()
    setMultiplayerStatus(
      joinError ||
        (ready
          ? pending.length
            ? 'Confirming…'
            : 'Connected to shared raft'
          : !live
            ? 'Connecting to shared raft…'
            : serverStatus === 'ready'
              ? 'Synchronizing shared raft…'
              : serverStatus),
      ready
    )
    if (isStateSyncronized() && now - lastHello > 2000) {
      lastHello = now
      void worldRoom
        .send('worldClientVersion', { payload: JSON.stringify({ session, release: RELEASE.id }) })
        .then(() => worldRoom.send('worldHello', { protocol: PROTOCOL_VERSION, session, resync: needsSnapshot }))
        .catch(() => {})
    }
    if (ready && pending.length && now - lastSend > 500) {
      lastSend = now
      void worldRoom.send('worldCommand', { payload: JSON.stringify(pending[0]) }).catch(() => {})
    }
    const locked =
      !ready ||
      (getMultiplayerSnapshot()?.player.dead ?? false) ||
      isSystemMenuOpen() ||
      isInventoryOpen() ||
      isCraftOpen() ||
      isCookOpen() ||
      isStorageOpen()
    if (lastLocked !== locked) {
      // Registered last, so connection loss cannot be overridden by another menu's input modifier.
      InputModifier.createOrReplace(engine.PlayerEntity, {
        mode: InputModifier.Mode.Standard({
          disableWalk: locked,
          disableJog: locked,
          disableRun: true,
          disableJump: locked,
          disableDoubleJump: true,
          disableGliding: true
        })
      })
      lastLocked = locked
    }
  })
}
