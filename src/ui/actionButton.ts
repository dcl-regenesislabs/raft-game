// Mobile action button state. The on-screen circular button on the right of
// the HUD drives a virtual pointer that the tool systems (hook/spear/hammer)
// read in place of the real `IA_POINTER` press on mobile. Edge flags are
// cleared at the end of each frame by `actionButtonResetSystem`, registered
// last in `index.ts` so every reader sees the edge during its own tick.

import { getSelectedSlot, getSlotHasAction } from './inventoryState'

let pressed = false
let edgePressed = false
let edgeReleased = false

// Press feedback: scale up by a small amount on press, then ease back to
// 1.0 with a squared-linear decay — same shape the inventory slots use
// when they're tapped, so the two animations feel consistent.
const PRESS_DURATION_S = 0.32
const PRESS_PEAK_BONUS = 0.18
let pressElapsedSec = PRESS_DURATION_S + 1 // start idle (no animation in flight)

export function pressActionButton(): void {
  if (pressed) return
  pressed = true
  edgePressed = true
  pressElapsedSec = 0
}

export function releaseActionButton(): void {
  if (!pressed) return
  pressed = false
  edgeReleased = true
}

export function isActionButtonPressed(): boolean {
  return pressed
}

export function actionButtonJustPressed(): boolean {
  return edgePressed
}

export function actionButtonJustReleased(): boolean {
  return edgeReleased
}

// Visible only when the currently selected slot is flagged as having an
// executable action (see `hasAction` on each SLOTS entry).
export function isActionButtonAvailable(): boolean {
  return getSlotHasAction(getSelectedSlot())
}

// Clears the single-frame edge flags. Must run after every system that reads
// them, i.e. last in the system list. Also advances the press animation
// clock so the UI can read the current scale each frame.
export function actionButtonResetSystem(dt: number): void {
  edgePressed = false
  edgeReleased = false
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
}

export function getActionButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  // Squared-linear decay from 1 → 0 over the duration. Peak bonus is applied
  // immediately on press, eases out smoothly.
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
