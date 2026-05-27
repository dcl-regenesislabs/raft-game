// Place-and-wait cooking. Pressing COOK debits the recipe's quantities,
// closes the menu, spawns the flame + ingredient sprites on the grill
// platform that the menu was opened on, and writes an `ActiveCook`
// component on that platform. From there the world drives the timeline:
// `systems/grillCook` ticks elapsed time and transitions the visuals
// (ingredients → plate → coal). The HUD does NOT lock — the player
// roams while the food cooks.
//
// Cell placements themselves stay symbolic — see `cookSlots.ts`.
// Quantities only matter at this layer.

import { Entity } from '@dcl/sdk/ecs'

import { playSfx } from '../audio/sfx'
import { ActiveCook, CookStatus, PlatformConstruction } from '../components'
import { setConstructionPointerPrompt } from '../factories/construction'
import {
  createFlameSprite,
  createIngredientSprites
} from '../factories/cookingSprites'
import {
  consumePlacedCells,
  getCookFuel,
  getMatchingRecipe
} from './cookSlots'
import { closeCookMenu } from './cookToggle'
import { markRecipeLearned } from './learnedRecipes'
import { showNotification } from './notification'
import { getCombinedCount, subtractFromAll } from './storageSession'

// The grill platform entity the open cook menu targets. Set by
// `openCookMenu(grill)` in `cookToggle.ts`; consumed by `startCook`
// to know WHERE to spawn the cook sprites.
let activeCookGrill: Entity | null = null

export function setActiveCookGrill(grill: Entity): void {
  activeCookGrill = grill
}

export function clearActiveCookGrill(): void {
  activeCookGrill = null
}

export function getActiveCookGrill(): Entity | null {
  return activeCookGrill
}

// True iff a recipe is matched, the burner holds the matching fuel,
// AND the player has enough of each ingredient (and fuel) to satisfy
// recipe quantities. The cook menu uses this to enable/dim the COOK
// button.
//
// Recipe matching itself ignores fuel (so the output preview shows
// from ingredients alone) — wood is checked here instead so the COOK
// button only lights up once the burner is fed. We also block the
// button if the targeted grill already has an `ActiveCook` — the grill
// can only host one cook at a time.
export function canStartCook(): boolean {
  const recipe = getMatchingRecipe()
  if (recipe === null) return false
  if (getCookFuel() !== recipe.fuel.itemId) return false
  for (const ing of recipe.ingredients) {
    if (getCombinedCount(ing.itemId) < ing.amount) return false
  }
  if (getCombinedCount(recipe.fuel.itemId) < recipe.fuel.amount) return false
  if (activeCookGrill === null) return false
  if (PlatformConstruction.getOrNull(activeCookGrill) === null) return false
  if (ActiveCook.getOrNull(activeCookGrill) !== null) return false
  return true
}

export function startCook(): boolean {
  if (!canStartCook()) return false
  const recipe = getMatchingRecipe()
  if (recipe === null) return false
  const grill = activeCookGrill
  if (grill === null) return false
  const construction = PlatformConstruction.getOrNull(grill)
  if (construction === null) return false
  // Debit recipe quantities — placement was symbolic so the inventory
  // hasn't been touched yet. Pulls from the player's pocket first,
  // then any placed storage (see `subtractFromAll`), so chests act as
  // an extension of the player's pantry.
  for (const ing of recipe.ingredients) {
    subtractFromAll(ing.itemId, ing.amount)
  }
  subtractFromAll(recipe.fuel.itemId, recipe.fuel.amount)
  consumePlacedCells()
  // Spawn the world-side sprites and tag the grill with cook state.
  playSfx('fireIgnite')
  const flame = createFlameSprite(grill, construction.yawDeg)
  const ingredientSprites = createIngredientSprites(grill, construction.yawDeg, recipe)
  // Cooking is in progress — strip the grill's PointerEvents so taps
  // (and the hover prompt) go inert until the food is ready or burned.
  setConstructionPointerPrompt(construction.child, null)
  ActiveCook.create(grill, {
    recipeId: recipe.id,
    elapsedSec: 0,
    status: CookStatus.Cooking,
    fireSprite: flame,
    foodSprites: ingredientSprites,
    bobPhase: Math.random() * Math.PI * 2
  })
  // First-time discovery: surface the new recipe so the player gets a
  // beat of feedback and knows the recipes list just grew.
  if (markRecipeLearned(recipe.id)) {
    showNotification(`NEW RECIPE: ${recipe.name}`)
  }
  closeCookMenu()
  return true
}
