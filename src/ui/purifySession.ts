// Active water-purification session. Triggered by clicking a placed
// purifier construction while holding a salt-water cup. While the
// session runs, the HUD hides every interactive element except the
// centred progress bar (same shape as the craft progress bar) and tool
// systems are blocked through `isInventoryActionLocked`. The slot
// holding the salt-water cup is locked in at start; on completion that
// same slot transmutes to a fresh-water cup so the player keeps the
// container and just gets the new contents.

import { addCollected, transmuteContainerSlot } from './inventoryState'

const PURIFY_DURATION_S = 4

let active = false
let elapsedSec = 0
let activeSlot = -1

export function isPurifying(): boolean {
  return active
}

export function getPurifyProgress(): number {
  if (!active) return 0
  return Math.min(1, elapsedSec / PURIFY_DURATION_S)
}

// Begin a purify cycle on the given slot. Caller must verify the slot
// currently holds a salt-water cup; this function only checks that no
// other purify is already in flight. The slot is locked in here and
// re-used at completion — `isInventoryActionLocked()` returns true
// while purifying so the player can't drag the slot away mid-cycle.
// If a cancel-purify path is added later, it must reset `activeSlot`
// alongside `active` or the next purify could transmute a stale slot.
export function startPurify(slotIndex: number): boolean {
  if (active) return false
  active = true
  activeSlot = slotIndex
  elapsedSec = 0
  return true
}

export function purifySessionTickSystem(dt: number): void {
  if (!active) return
  elapsedSec += dt
  if (elapsedSec >= PURIFY_DURATION_S) {
    // Salt evaporates out of the cup as a byproduct — the player keeps
    // the cup (now fresh water) AND gains sea salt for cooking.
    addCollected('sea_salt', 1)
    transmuteContainerSlot(activeSlot, 'freshWater')
    active = false
    elapsedSec = 0
    activeSlot = -1
  }
}
