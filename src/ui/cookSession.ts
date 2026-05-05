// Active cooking session. Triggered by pressing COOK in the cook menu
// once the placed ingredient SET matches a recipe AND the player's
// inventory holds at least the recipe's required QUANTITIES of every
// ingredient (incl. fuel). Pressing COOK debits those quantities,
// clears the cells, runs a timer with the HUD hidden behind a centered
// progress bar, and grants the matched recipe's output on completion.
//
// Note: cell placements themselves are symbolic — see `cookSlots.ts`.
// Quantities only matter at this layer.

import { type CookableItem } from './cookableItems'
import { consumePlacedCells, getMatchingRecipe } from './cookSlots'
import {
  addCollected,
  getCollectedCount,
  subtractCollected
} from './inventoryState'

const COOK_DEFAULT_SEC = 4

let activeRecipe: CookableItem | null = null
let activeDurationSec = COOK_DEFAULT_SEC
let elapsedSec = 0

export function isCooking(): boolean {
  return activeRecipe !== null
}

export function getCookProgress(): number {
  if (activeRecipe === null) return 0
  return Math.min(1, elapsedSec / activeDurationSec)
}

// True iff a recipe is matched AND the player has enough of each
// ingredient (and the fuel) to satisfy the recipe quantities. The cook
// menu also uses this to enable / dim the COOK button.
export function canStartCook(): boolean {
  if (isCooking()) return false
  const recipe = getMatchingRecipe()
  if (recipe === null) return false
  for (const ing of recipe.ingredients) {
    if (getCollectedCount(ing.itemId) < ing.amount) return false
  }
  if (getCollectedCount(recipe.fuel.itemId) < recipe.fuel.amount) return false
  return true
}

export function startCook(): boolean {
  if (!canStartCook()) return false
  const recipe = getMatchingRecipe()
  if (recipe === null) return false
  // Debit recipe quantities — placement was symbolic so the inventory
  // hasn't been touched yet.
  for (const ing of recipe.ingredients) {
    subtractCollected(ing.itemId, ing.amount)
  }
  subtractCollected(recipe.fuel.itemId, recipe.fuel.amount)
  consumePlacedCells()
  activeRecipe = recipe
  activeDurationSec = recipe.cookSec ?? COOK_DEFAULT_SEC
  elapsedSec = 0
  return true
}

export function cookSessionTickSystem(dt: number): void {
  if (activeRecipe === null) return
  elapsedSec += dt
  if (elapsedSec >= activeDurationSec) {
    addCollected(activeRecipe.id, 1)
    activeRecipe = null
    elapsedSec = 0
  }
}
