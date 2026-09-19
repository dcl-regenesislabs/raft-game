import { Action, PlayerState, RESET_ADMIN, Snapshot } from '../multiplayer/types'
let enabled = false
let snapshot: Snapshot | null = null
let sender: ((action: Action) => boolean) | null = null
let status = 'Connecting to shared raft…'
let ready = false
let applying = false
export function enableMultiplayer(send: (action: Action) => boolean): void {
  enabled = true
  sender = send
}
export function isMultiplayer(): boolean {
  return enabled
}
export function isApplyingWorld(): boolean {
  return applying
}
export function applyingWorld<T>(fn: () => T): T {
  applying = true
  try {
    return fn()
  } finally {
    applying = false
  }
}
export function multiplayerReady(): boolean {
  return !enabled || ready
}
export function multiplayerStatus(): string {
  return status
}
export function setMultiplayerStatus(value: string, playable: boolean): void {
  status = value
  ready = playable
}
export function getMultiplayerSnapshot(): Snapshot | null {
  return snapshot
}
export function setMultiplayerSnapshot(value: Snapshot): void {
  snapshot = value
}
export function getMultiplayerPlayer(): PlayerState | null {
  return snapshot?.player ?? null
}
export function canResetWorld(): boolean {
  return snapshot?.player.address === RESET_ADMIN
}
export function sendWorldAction(action: Action): boolean {
  return enabled && ready && sender !== null && sender(action)
}

export type UpdateNotice = { phase: 'checking' | 'updating' | 'reload'; incompatible: boolean; build: string }
let updateNotice: UpdateNotice | null = null
export function getUpdateNotice(): UpdateNotice | null {
  return updateNotice
}
export function setUpdateNotice(value: UpdateNotice | null): void {
  updateNotice = value
  if (value) ready = false
}
