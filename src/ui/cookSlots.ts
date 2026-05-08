// Mutable state for the cook menu's drop targets: the 4 input cells, the
// 1 fuel cell, and the inventory item id the player is currently
// holding (the "drag source", though strictly it's a click-to-pick
// model since react-ecs has no drag events).
//
// Placements are SYMBOLIC — each cell represents "this ingredient is
// part of the recipe", not "one unit has been moved here". The
// player's inventory is only debited at COOK time, by the cook
// session. That way:
//   - the player can preview the recipe as soon as they've placed the
//     right TYPES of ingredients (regardless of whether they have
//     enough of each yet),
//   - cells display a have/need badge against the matched recipe and
//     turn red when the inventory is short,
//   - leaving the menu doesn't require a refund — there was nothing to
//     refund in the first place.
//
// To keep the matcher simple, each ingredient type can sit in at most
// one cell at a time — placing a type that's already on the board is a
// no-op. This means the visual cell layout is a SET of ingredients,
// not a multiset.

import { matchCookRecipe, type CookableItem } from './cookableItems'
import { getCatalogItem } from './items'
import { getCombinedCount } from './storageSession'

// 4 input cells — index 0 is top-left, 1 top-right, 2 bottom-left,
// 3 bottom-right. Layout matches `COOK_INPUT_CENTERS_PCT` in `theme.ts`.
const INPUT_CELL_COUNT = 4

let inputs: (string | null)[] = new Array(INPUT_CELL_COUNT).fill(null)
let fuel: string | null = null
let pickedSourceId: string | null = null

export function getCookInputCount(): number {
  return INPUT_CELL_COUNT
}

export function getCookInput(slotIndex: number): string | null {
  return inputs[slotIndex] ?? null
}

export function getCookFuel(): string | null {
  return fuel
}

export function getPickedIngredient(): string | null {
  return pickedSourceId
}

// Item id of the recipe whose ingredient set matches the current cell
// layout, or null if it doesn't. The output preview slot mirrors this;
// the cook session uses it as the eligibility check before debiting
// quantities. Fuel is NOT part of this match — the burner only gates
// the COOK button (see `canStartCook`).
export function getMatchingRecipe(): CookableItem | null {
  return matchCookRecipe(inputs)
}

// Pick an inventory item to place in the next-clicked cook cell. Only
// items flagged `ingredient: true` are allowed; clicking any other slot
// while the cook menu is open is a no-op (the drop targets ignore them).
// Re-picking the same id toggles selection off so the player can
// cancel by clicking the same inventory slot twice. Requires at least
// one of the item across the player's pocket OR any placed storage —
// the cook session debits from the same combined pool, so an item the
// player only stores in a chest is still a valid pick.
export function pickIngredient(itemId: string): boolean {
  // Catalog-wide lookup (not `getItem`) so ingredients the player has
  // never personally carried — only sitting in a chest — still resolve.
  // `getItem` is keyed on the player's inventory layout and would miss
  // them, gating storage-only picks before the count check fires.
  const def = getCatalogItem(itemId)
  if (def === null) return false
  if (!def.ingredient) return false
  if (getCombinedCount(itemId) <= 0) return false
  if (pickedSourceId === itemId) {
    pickedSourceId = null
    return true
  }
  pickedSourceId = itemId
  return true
}

export function clearPickedIngredient(): void {
  pickedSourceId = null
}

// True iff `itemId` is sitting in any input or fuel cell. Used to
// reject re-placing a duplicate of an ingredient that's already on
// the board.
function isAlreadyPlaced(itemId: string): boolean {
  if (fuel === itemId) return true
  for (const id of inputs) if (id === itemId) return true
  return false
}

// Place the picked item in `slotIndex` of the input grid. No-op if no
// pick is active, the slot is occupied, or the picked id is already
// in another cell (we model the layout as a SET — same ingredient in
// two cells would be meaningless to the matcher). Symbolic only: no
// inventory debit. Clears the pick on success so the next click on a
// cell doesn't accidentally re-place the same item.
export function placeInInputCell(slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= INPUT_CELL_COUNT) return false
  if (inputs[slotIndex] !== null) return false
  if (pickedSourceId === null) return false
  if (isAlreadyPlaced(pickedSourceId)) return false
  inputs[slotIndex] = pickedSourceId
  pickedSourceId = null
  return true
}

// Burner cell. Same symbolic model as input cells. Conceptually only
// fuel-flagged items belong here, but we don't enforce — the matcher
// just won't find a recipe when the burner holds something weird.
export function placeInFuelCell(): boolean {
  if (fuel !== null) return false
  if (pickedSourceId === null) return false
  if (isAlreadyPlaced(pickedSourceId)) return false
  fuel = pickedSourceId
  pickedSourceId = null
  return true
}

// Pop the input cell back to empty. Symbolic-only model means there
// is no inventory return — nothing was taken in the first place.
export function removeFromInputCell(slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= INPUT_CELL_COUNT) return false
  if (inputs[slotIndex] === null) return false
  inputs[slotIndex] = null
  return true
}

export function removeFromFuelCell(): boolean {
  if (fuel === null) return false
  fuel = null
  return true
}

// Empty every cell. Called on `closeCookMenu` so the next time the
// player opens the menu they start from a blank board, and on the
// death-screen reset for the same reason. No inventory side effects.
export function clearCookSlots(): void {
  for (let i = 0; i < inputs.length; i++) inputs[i] = null
  fuel = null
  pickedSourceId = null
}

// Same as `clearCookSlots`. Kept as a separate name for the cook
// session's "I'm done with these cells, the burner has lit" call site
// — semantically distinct from "the player walked away".
export function consumePlacedCells(): void {
  clearCookSlots()
}
