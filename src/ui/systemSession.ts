// Open/close + status state for the SYSTEM menu (SAVE / LOAD / RESTART).
// Lives alongside the other menu-toggle modules so the HUD index can
// gate it the same way it gates inventory / cook / craft. Status is
// surfaced in the modal so the player gets feedback while the
// authoritative-server round-trip is in flight.

export type SystemStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'loading' }
  | { kind: 'wiping' }
  | { kind: 'saved'; atMs: number }
  | { kind: 'loaded'; atMs: number; found: boolean }
  | { kind: 'wiped'; atMs: number }
  | { kind: 'error'; message: string }

let isOpen = false
let status: SystemStatus = { kind: 'idle' }
// Pending confirm step for destructive actions. The modal renders a
// secondary panel when this is non-null and routes the confirmation
// click to the matching handler.
export type SystemConfirm = 'restart' | 'load' | 'lobby' | null
let confirm: SystemConfirm = null

export function isSystemMenuOpen(): boolean {
  return isOpen
}

export function setSystemMenuOpen(value: boolean): void {
  isOpen = value
  if (!value) confirm = null
}

export function getSystemStatus(): SystemStatus {
  return status
}

export function setSystemStatus(next: SystemStatus): void {
  status = next
}

export function getSystemConfirm(): SystemConfirm {
  return confirm
}

export function setSystemConfirm(next: SystemConfirm): void {
  confirm = next
}
