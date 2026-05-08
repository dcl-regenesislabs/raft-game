// Tracks which cooking recipes the player has discovered. The cooking menu
// uses this to populate its recipes list — only learned recipes are shown
// so the rest of the catalog stays a hidden, try-and-error puzzle.
//
// Discovery model:
//   - All 1-ingredient recipes are LEARNED from the start. They double as
//     the tutorial: the player can see at least a handful of recipes the
//     first time they open the cook menu.
//   - Every other recipe is locked until the player successfully cooks it
//     once via free-form ingredient placement (`cookSession.startCook`).
//
// Set lives in module memory only — the death-screen `playAgain` flow
// resets it via `resetLearnedRecipes` so a fresh run starts from the
// same baseline knowledge.

import { COOKABLE_ITEMS } from './cookableItems'

const learned = new Set<string>()

function seedStarterRecipes(): void {
  for (const recipe of COOKABLE_ITEMS) {
    if (recipe.ingredients.length === 1) learned.add(recipe.id)
  }
}

seedStarterRecipes()

export function isRecipeLearned(id: string): boolean {
  return learned.has(id)
}

// Add a recipe to the learned set. Returns true iff this was the first
// time the recipe was learned, so callers can fire a one-shot
// "RECIPE DISCOVERED" notification.
export function markRecipeLearned(id: string): boolean {
  if (learned.has(id)) return false
  learned.add(id)
  return true
}

// Snapshot of every learned recipe id, in catalog order so the recipes
// list renders in the same stable sequence the catalog declares.
export function getLearnedRecipeIds(): string[] {
  const out: string[] = []
  for (const recipe of COOKABLE_ITEMS) {
    if (learned.has(recipe.id)) out.push(recipe.id)
  }
  return out
}

export function resetLearnedRecipes(): void {
  learned.clear()
  seedStarterRecipes()
}
