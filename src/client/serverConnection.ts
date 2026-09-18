import { isStateSyncronized } from '@dcl/sdk/network'
import { saveRoom } from '../shared/messages'

let lastHeartbeatMs = -Infinity
let initialized = false

export function initServerConnection(): void {
  if (initialized) return
  initialized = true
  // Messages are transient: an old room snapshot cannot masquerade as a live server.
  saveRoom.onMessage('serverHeartbeat', () => {
    lastHeartbeatMs = Date.now()
  })
}

export function isGameServerReady(): boolean {
  if (!isStateSyncronized()) {
    lastHeartbeatMs = -Infinity
    return false
  }
  return Date.now() - lastHeartbeatMs < 6000
}
