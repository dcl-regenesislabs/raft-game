// Client-side save/load networking glue. Sits between the UI (SYSTEM
// menu buttons + boot-time startup gate) and the authoritative server's
// save room. Lifecycle:
//
//   - register loadResult + ack listeners once on boot
//   - poll isGameServerReady() each frame; on the rising edge fire a
//     PROBE load that records whether a save exists without applying
//     it, so the StartupScreen can dim/enable the LOAD LAST GAME button
//   - SYSTEM > Save / Load / Restart and the StartupScreen's LOAD LAST
//     GAME button route through requestSave / requestLoad / requestWipe;
//     they bail if the room isn't synced yet
//
// The SaveBlob is JSON-stringified on the wire — the server stores it
// as opaque text. parseSaveBlob (src/shared/saveSchema.ts) validates
// shape on read; an invalid blob is logged and ignored.

import { isGameServerReady } from './serverConnection'

import { playAgain } from '../ui/gameOver'
import { showNotification } from '../ui/notification'
import { setSaveProbeResult } from '../ui/startupGate'
import {
  setSystemStatus
} from '../ui/systemSession'
import { saveRoom } from '../shared/messages'
import {
  applySaveBlob,
  buildSaveBlob,
  parseSaveBlob
} from '../shared/saveSchema'

let listenersRegistered = false
let probeFired = false
let lastSyncState = false
let pendingWipeFollowup = false
// Track whether the in-flight load originated from the auto-load on
// boot. Auto-loads must not pop a notification banner since the player
// hasn't asked for anything yet — only player-initiated loads should.
let suppressLoadNotification = false
// True while the rising-edge "does a save exist?" probe is in flight.
// The loadResult handler short-circuits when this is set: it records
// the found-state into the startup gate but does NOT applySaveBlob, so
// the player still gets to choose NEW GAME or LOAD LAST GAME.
let saveProbeInFlight = false
let queuedLoad: boolean | null = null
let loadRequested = false


export function initSaveClient(): void {
  if (listenersRegistered) return
  listenersRegistered = true

  saveRoom.onMessage('loadResult', (data) => {
    if (saveProbeInFlight) {
      saveProbeInFlight = false
      const found =
        data.found && data.payload !== '' && parseSaveBlob(data.payload) !== null
      setSaveProbeResult(found)
      if (queuedLoad !== null) {
        const silent = queuedLoad
        queuedLoad = null
        void requestLoad(silent)
      }
      return
    }
    if (!loadRequested) return
    loadRequested = false
    const silent = suppressLoadNotification
    suppressLoadNotification = false
    if (!data.found || data.payload === '') {
      setSystemStatus({ kind: 'loaded', atMs: Date.now(), found: false })
      if (!silent) showNotification('No saved game found yet.')
      return
    }
    const blob = parseSaveBlob(data.payload)
    if (blob === null) {
      setSystemStatus({
        kind: 'error',
        message: 'Saved data could not be read.'
      })
      if (!silent) showNotification('Saved data could not be read.')
      return
    }
    try {
      applySaveBlob(blob)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save could not be loaded.'
      setSystemStatus({ kind: 'error', message })
      if (!silent) showNotification(message)
      return
    }
    setSystemStatus({ kind: 'loaded', atMs: Date.now(), found: true })
    if (!silent) showNotification('Loaded.')
  })

  saveRoom.onMessage('ack', (data) => {
    if (data.op === 'save') {
      if (data.ok) {
        setSystemStatus({ kind: 'saved', atMs: Date.now() })
        showNotification('Saved.')
      } else {
        const message = data.error !== '' ? data.error : 'Save failed.'
        setSystemStatus({ kind: 'error', message })
        showNotification(`Save failed: ${message}`)
      }
      return
    }
    if (data.op === 'wipe') {
      if (data.ok) {
        // Local reset only runs after the server confirms the cloud
        // bucket is gone — otherwise a failed delete + local wipe
        // could leave the player with a stale cloud save they didn't
        // expect to keep.
        if (pendingWipeFollowup) {
          pendingWipeFollowup = false
          playAgain()
        }
        setSystemStatus({ kind: 'wiped', atMs: Date.now() })
        showNotification('Save wiped. Fresh start.')
      } else {
        pendingWipeFollowup = false
        const message = data.error !== '' ? data.error : 'Restart failed.'
        setSystemStatus({ kind: 'error', message })
        showNotification(`Restart failed: ${message}`)
      }
      return
    }
  })
}

// Once-per-frame system. Watches for the room state flipping to
// synchronized and fires the save-existence probe on the rising edge.
// Re-armed if sync drops out so a reconnect after a disconnect can
// re-pull. The probe records found-state into the startup gate; it
// does NOT apply the save (the player chooses via the startup screen).
export function saveClientTickSystem(_dt: number): void {
  const synced = isGameServerReady()
  if (synced && !lastSyncState) {
    if (!probeFired) {
      probeFired = true
      void sendSaveProbe().catch(() => {
        // Failure is non-fatal: leave the LOAD LAST GAME button dimmed.
      })
    }
  }
  if (!synced) {
    probeFired = false
    saveProbeInFlight = false
    queuedLoad = null
  }
  lastSyncState = synced
}

async function sendSaveProbe(): Promise<void> {
  saveProbeInFlight = true
  saveRoom.send('load', {})
}

export async function requestSave(): Promise<void> {
  if (!isGameServerReady()) {
    setSystemStatus({
      kind: 'error',
      message: 'Server connecting — try again in a moment.'
    })
    showNotification('Server connecting — try again in a moment.')
    return
  }
  setSystemStatus({ kind: 'saving' })
  showNotification('Saving…')
  const blob = buildSaveBlob()
  saveRoom.send('save', { payload: JSON.stringify(blob) })
}

// `silent` drops the in-flight "Loading…" status so the auto-load on
// scene entry doesn't flash a transient label across the HUD before
// the SYSTEM menu has even been opened. It also suppresses the
// loadResult toast notification so the player doesn't see a banner pop
// on first connect.
export async function requestLoad(silent: boolean = false): Promise<void> {
  if (!isGameServerReady()) {
    if (!silent) {
      setSystemStatus({
        kind: 'error',
        message: 'Server connecting — try again in a moment.'
      })
      showNotification('Server connecting — try again in a moment.')
    }
    return
  }
  if (saveProbeInFlight) {
    queuedLoad = silent
    return
  }
  if (!silent) {
    setSystemStatus({ kind: 'loading' })
    showNotification('Loading…')
  }
  suppressLoadNotification = silent
  loadRequested = true
  saveRoom.send('load', {})
}

export async function requestWipe(): Promise<void> {
  if (!isGameServerReady()) {
    setSystemStatus({
      kind: 'error',
      message: 'Server connecting — try again in a moment.'
    })
    showNotification('Server connecting — try again in a moment.')
    return
  }
  setSystemStatus({ kind: 'wiping' })
  showNotification('Restarting…')
  pendingWipeFollowup = true
  saveRoom.send('wipe', {})
}
