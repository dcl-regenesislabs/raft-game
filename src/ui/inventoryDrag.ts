// Inventory swap state. The interaction model is select-then-swap (not
// press-and-drag), since react-ecs has no `onMouseMove` to anchor an
// icon to the cursor. The flow:
//
//   1. Press a non-empty slot → that slot becomes "selected" (rendered
//      bigger). Every other non-empty slot starts shaking to invite a
//      swap target.
//   2. Press another slot     → the two slots swap, selection clears.
//   3. Press the same slot    → selection clears (toggle off).
//   4. Press anywhere that
//      isn't a slot            → selection clears.
//
// `pressBackground` relies on `interactionThisFrame` so a slot press that
// also bubbles up through a parent UiEntity (if react-ecs ever does that)
// won't immediately cancel its own selection. The flag is cleared once
// per frame by `dragResetSystem`.

import { getInventorySlot, swapInventorySlots } from './items'

let selectedSlot: number | null = null
let interactionThisFrame = false

export function getSelectedDragSlot(): number | null {
  return selectedSlot
}

export function isSwapModeActive(): boolean {
  return selectedSlot !== null
}

// Mouse-down on a slot. Caller is responsible for inventory-open gating.
export function pressSlot(i: number): void {
  interactionThisFrame = true
  if (selectedSlot === null) {
    if (getInventorySlot(i) === null) return
    selectedSlot = i
    return
  }
  if (selectedSlot === i) {
    selectedSlot = null
    return
  }
  swapInventorySlots(selectedSlot, i)
  selectedSlot = null
}

// Mouse-down anywhere on the screen that isn't a slot. Cancels selection
// unless a slot already handled the click in this same frame.
export function pressBackground(): void {
  if (interactionThisFrame) return
  selectedSlot = null
}

export function cancelSelection(): void {
  selectedSlot = null
}

export function dragResetSystem(_dt: number): void {
  interactionThisFrame = false
}
