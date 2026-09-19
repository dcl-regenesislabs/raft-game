import { isCraftOpen } from '../ui/craftToggle'
import { isCookOpen } from '../ui/cookToggle'
import { isStorageOpen } from '../ui/storageToggle'
import { equipCraftedItem } from '../systems/nativeEquipment'
import { engine, InputModifier } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { worldRoom } from '../shared/messages'
import { Action, ActionResult, Delta, PROTOCOL_VERSION, Request, Snapshot } from '../multiplayer/types'
import { applyDelta, Assembler } from '../multiplayer/transport'
import {
  enableMultiplayer,
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
  let needsSnapshot = true,
    pending: Request | null = null
  let joinError = ''
  let serverStatus = '',
    lastLocked: boolean | null = null
  const buffered: Delta[] = []
  enableMultiplayer((action: Action) => {
    if (pending) return false
    const snapshot = getMultiplayerSnapshot()
    if (!snapshot || !multiplayerReady()) return false
    pending = {
      protocol: PROTOCOL_VERSION,
      generation: snapshot.world.generation,
      session,
      sequence: ++sequence,
      action
    }
    lastSend = -Infinity
    return true
  })
  // Pinned SDK Room filters client callbacks to AUTH_SERVER_PEER_ID and intentionally omits context.
  worldRoom.onMessage('worldPulse', (pulse) => {
    if (server !== pulse.server) {
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
    if (!pending || result.session !== session || result.sequence !== pending.sequence) return
    if (!result.ok) showNotification(result.error)
    else {
      if (pending.action.kind === 'craft') equipCraftedItem(pending.action.item)
      showNotification(pending.action.kind === 'reset' ? 'World reset for everyone.' : 'Saved.')
    }
    pending = null
    sequence = getMultiplayerSnapshot()?.player.sessions[session]?.sequence ?? sequence
  }
  worldRoom.onMessage('worldResult', (data) => {
    try {
      const result = JSON.parse(data.payload) as ActionResult
      // Wait for committed state as well as the receipt before enabling another action.
      if ((getMultiplayerSnapshot()?.world.revision ?? -1) >= result.revision) acknowledge(result)
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
      const previous = getMultiplayerSnapshot()
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
        pending = null
        sequence = 0
      }
      renderWorld(snapshot, previous)
      setMultiplayerSnapshot(snapshot)
      const saved = snapshot.player.sessions[session]
      if (saved) {
        if (pending && saved.sequence === pending.sequence)
          acknowledge({ ...saved, session, generation: snapshot.world.generation, revision: snapshot.world.revision })
        if (!pending) sequence = saved.sequence
      }
    } catch (error) {
      console.error('[CLIENT] World synchronization failed', error)
      assembler.clear()
      needsSnapshot = true
    }
  })
  engine.addSystem(() => {
    const now = Date.now()
    const live = isStateSyncronized() && now - heartbeat < 8000
    if (!live) needsSnapshot = true
    const ready = live && !joinError && !needsSnapshot && serverStatus === 'ready' && !!getMultiplayerSnapshot()
    setMultiplayerStatus(
      joinError ||
        (ready
          ? pending
            ? 'Saving action…'
            : 'Shared world saved'
          : !live
            ? 'Connecting to shared raft…'
            : serverStatus === 'ready'
              ? 'Synchronizing shared raft…'
              : serverStatus),
      ready
    )
    if (isStateSyncronized() && now - lastHello > 2000) {
      lastHello = now
      void worldRoom.send('worldHello', { protocol: PROTOCOL_VERSION, session, resync: needsSnapshot }).catch(() => {})
    }
    if (ready && pending && now - lastSend > 2000) {
      lastSend = now
      void worldRoom.send('worldCommand', { payload: JSON.stringify(pending) }).catch(() => {})
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
