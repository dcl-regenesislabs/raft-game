import { Entity } from '@dcl/sdk/ecs'
import { setCraftStation, getCraftStation, isCraftStationAvailable } from './craftContext'
import { beginUiTouch } from './mobileControlsState'
// Craft menu open/close toggle button. Mirrors the press-pulse shape of the
// inventory toggle so the two HUD buttons feel consistent. Craft and
// inventory behave as a mutually-exclusive toggle group — opening one
// closes the other so only a single panel is on screen at a time.

import { playSfx } from '../audio/sfx'
import { setCookOpen } from './cookToggle'
import { setInventoryOpen } from './inventoryToggle'
import { closeStorageMenu, isStorageOpen } from './storageToggle'
import { setSystemMenuOpen } from './systemSession'
import { CRAFTABLE_ITEMS } from './craftableItems'

const PRESS_DURATION_S = 0.32
const PRESS_PEAK_BONUS = 0.18

let open = false
let openRevision = 0
let guideElapsed = 2
export const craftOpenRevision = () => openRevision
export const craftGuidePulse = () => guideElapsed < 1.4 ? (1 - guideElapsed / 1.4) * (0.5 + 0.5 * Math.cos(guideElapsed * 12)) : 0
let pressElapsedSec = PRESS_DURATION_S + 1
let selectedCraftableId: string | null = CRAFTABLE_ITEMS[0]?.id ?? null

export function isCraftOpen(): boolean {
  return open
}

// Direct setter — used by `inventoryToggle` to close craft when the
// inventory opens. Does NOT trigger the press pulse: the pulse is the
// "you pressed this button" feedback and should only fire when the user
// actually clicked the craft button, not when another button closed it.
export function setCraftOpen(target: boolean, station: Entity | null = null): void {
  if (open === target && getCraftStation() === station) return
  setCraftStation(target ? station : null)
  selectedCraftableId = null
  beginUiTouch()
  open = target
  if (target) {
    openRevision++
    guideElapsed = 0
    setInventoryOpen(false)
    setCookOpen(false)
    if (isStorageOpen()) closeStorageMenu()
    setSystemMenuOpen(false)
  }
}

export function toggleCraft(): void {
  const next = !open
  setCraftOpen(next)
  playSfx(next ? 'craftOpen' : 'craftClose')
  // Press feedback fires here because it represents the user clicking
  // the craft button — not the state change itself.
  pressElapsedSec = 0
  // Mutually exclusive with the inventory, cook and storage menus:
  // opening craft closes any of those so only one panel is up at a time.
  if (next) {
    setInventoryOpen(false)
    setCookOpen(false)
    if (isStorageOpen()) closeStorageMenu()
    setSystemMenuOpen(false)
  }
}

export function getSelectedCraftableId(): string | null {
  return selectedCraftableId
}

export function selectCraftable(id: string | null): void {
  selectedCraftableId = id
}

export function craftToggleResetSystem(dt: number): void {
  guideElapsed = Math.min(2, guideElapsed + dt)
  if (open && !isCraftStationAvailable()) setCraftOpen(false)
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
}

export function getCraftButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
