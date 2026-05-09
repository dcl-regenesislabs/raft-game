// SYSTEM menu open/close toggle. Mirrors `inventoryToggle.ts` so the
// SAVE / LOAD / RESTART surface is mutually exclusive with every other
// HUD panel and movement is locked while it's up. Press-pulse animation
// is consistent with the other top-row toggles.

import { setCookOpen } from './cookToggle'
import { setCraftOpen } from './craftToggle'
import { setInventoryOpen } from './inventoryToggle'
import { closeStorageMenu } from './storageToggle'
import {
  isSystemMenuOpen,
  setSystemConfirm,
  setSystemMenuOpen
} from './systemSession'

const PRESS_DURATION_S = 0.32
const PRESS_PEAK_BONUS = 0.18

let pressElapsedSec = PRESS_DURATION_S + 1

export function toggleSystemMenu(): void {
  const next = !isSystemMenuOpen()
  setSystemMenuOpen(next)
  pressElapsedSec = 0
  if (next) {
    // Mutually exclusive with every other panel — opening the SYSTEM
    // menu closes whatever was up so the player has a single, focused
    // surface for save/load/restart.
    setInventoryOpen(false)
    setCraftOpen(false)
    setCookOpen(false)
    closeStorageMenu()
    setSystemConfirm(null)
  }
}

export function getSystemButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}

export function systemToggleTickSystem(dt: number): void {
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
}
