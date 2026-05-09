// Client-side save/load networking glue. Sits between the UI (SYSTEM
// menu buttons) and the authoritative server's save room. Lifecycle:
//
//   - register loadResult + ack listeners once on boot
//   - poll isStateSyncronized() each frame; the first time it flips
//     true, fire one auto-load so the player rehydrates without
//     pressing anything
//   - SYSTEM > Save / Load / Restart route through requestSave /
//     requestLoad / requestWipe; they bail if the room isn't synced yet
//
// The SaveBlob is JSON-stringified on the wire — the server stores it
// as opaque text. parseSaveBlob (src/shared/saveSchema.ts) validates
// shape on read; an invalid blob is logged and ignored.

import { isStateSyncronized } from '@dcl/sdk/network'

import { playAgain } from '../ui/gameOver'
import {
  setSystemStatus
} from '../ui/systemSession'
import { saveRoom } from '../shared/messages'
import {
  applySaveBlob,
  buildSaveBlob,
  parseSaveBlob
} from '../shared/saveSchema'
import { getSceneMode } from '../runtime/sceneMode'
import type { SceneMode } from '../runtime/sceneMode'

let cachedMode: SceneMode | null = null
let listenersRegistered = false
let autoLoadFired = false
let lastSyncState = false
let pendingWipeFollowup = false

async function ensureMode(): Promise<SceneMode> {
  if (cachedMode !== null) return cachedMode
  cachedMode = await getSceneMode()
  return cachedMode
}

export function initSaveClient(): void {
  if (listenersRegistered) return
  listenersRegistered = true

  saveRoom.onMessage('loadResult', (data) => {
    if (!data.found || data.payload === '') {
      setSystemStatus({ kind: 'loaded', atMs: Date.now(), found: false })
      return
    }
    const blob = parseSaveBlob(data.payload)
    if (blob === null) {
      setSystemStatus({
        kind: 'error',
        message: 'Saved data could not be read.'
      })
      return
    }
    applySaveBlob(blob)
    setSystemStatus({ kind: 'loaded', atMs: Date.now(), found: true })
  })

  saveRoom.onMessage('ack', (data) => {
    if (data.op === 'save') {
      if (data.ok) {
        setSystemStatus({ kind: 'saved', atMs: Date.now() })
      } else {
        setSystemStatus({
          kind: 'error',
          message: data.error !== '' ? data.error : 'Save failed.'
        })
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
      } else {
        pendingWipeFollowup = false
        setSystemStatus({
          kind: 'error',
          message: data.error !== '' ? data.error : 'Restart failed.'
        })
      }
      return
    }
  })
}

// Once-per-frame system. Watches for the room state flipping to
// synchronized and fires an auto-load on the rising edge so the player
// rehydrates without pressing Load. Re-armed if sync drops out so a
// reconnect after a disconnect can re-pull.
export function saveClientTickSystem(_dt: number): void {
  const synced = isStateSyncronized()
  if (synced && !lastSyncState) {
    if (!autoLoadFired) {
      autoLoadFired = true
      void requestLoad(true).catch(() => {
        // requestLoad already routes errors through setSystemStatus.
      })
    }
  }
  lastSyncState = synced
}

export async function requestSave(): Promise<void> {
  if (!isStateSyncronized()) {
    setSystemStatus({
      kind: 'error',
      message: 'Connecting — try again in a moment.'
    })
    return
  }
  const mode = await ensureMode()
  setSystemStatus({ kind: 'saving' })
  const blob = buildSaveBlob(mode)
  saveRoom.send('save', { mode, payload: JSON.stringify(blob) })
}

// `silent` drops the in-flight "Loading…" status so the auto-load on
// scene entry doesn't flash a transient label across the HUD before
// the SYSTEM menu has even been opened.
export async function requestLoad(silent: boolean = false): Promise<void> {
  if (!isStateSyncronized()) {
    if (!silent) {
      setSystemStatus({
        kind: 'error',
        message: 'Connecting — try again in a moment.'
      })
    }
    return
  }
  const mode = await ensureMode()
  if (!silent) setSystemStatus({ kind: 'loading' })
  saveRoom.send('load', { mode })
}

export async function requestWipe(): Promise<void> {
  if (!isStateSyncronized()) {
    setSystemStatus({
      kind: 'error',
      message: 'Connecting — try again in a moment.'
    })
    return
  }
  setSystemStatus({ kind: 'wiping' })
  pendingWipeFollowup = true
  saveRoom.send('wipe', {})
}
