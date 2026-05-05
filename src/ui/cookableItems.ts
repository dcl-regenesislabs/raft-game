// Catalog of recipes the cook menu recognises. The menu has 4 input
// cells + 1 fuel cell — the player drops items into cells and the
// matcher below scans this catalog for a recipe whose ingredient
// multiset (and fuel id) exactly matches what's placed. There's no
// "select a recipe" step: the placement IS the selection.
//
// Output ids resolve through the food catalog in `items.ts`, so
// completed cooks land in the inventory the same way materials do.

export interface CookIngredient {
  itemId: string
  amount: number
}

export interface CookableItem {
  // Output item id — must exist in the crafted/food catalog so a finished
  // cook can stack into the player's inventory.
  id: string
  name: string
  description: string
  texture: string
  // Sum of `amount` must be ≤ 4 (cells in the input grid). Multi-unit
  // ingredients consume that many cells when placed.
  ingredients: readonly CookIngredient[]
  // Fuel item the burner expects. Always amount 1 because the burner
  // has a single cell — recipes that "want more wood" instead extend
  // their cook duration via `cookSec`.
  fuel: CookIngredient
  // Optional per-recipe cook duration in seconds. Falls back to the cook
  // session default when omitted.
  cookSec?: number
}

export const COOKABLE_ITEMS: readonly CookableItem[] = [
  {
    id: 'cookedFish',
    name: 'GRILLED FISH',
    description:
      'A simple grilled fish. Light, healthy, and better than raw.',
    texture: 'images/hud/items/item-13.png',
    ingredients: [{ itemId: 'rawFish', amount: 1 }],
    fuel: { itemId: 'wood', amount: 1 }
  },
  {
    id: 'cookedPotato',
    name: 'BAKED POTATO',
    description:
      'A baked potato. Filling, warm, and far easier on the gut than raw.',
    texture: 'images/hud/items/item-17.png',
    ingredients: [{ itemId: 'rawPotato', amount: 1 }],
    fuel: { itemId: 'wood', amount: 1 }
  },
  {
    id: 'cookedFishPasta',
    name: 'FISH PASTA',
    description:
      'Pasta tossed with grilled fish. Hearty enough to keep you going for hours.',
    texture: 'images/hud/items/item-13.png',
    // 2 fish + 1 pasta — the larger fish demand exercises the
    // "you've placed it but don't have enough quantity" red badge.
    ingredients: [
      { itemId: 'rawFish', amount: 2 },
      { itemId: 'pasta', amount: 1 }
    ],
    // Single wood for the burner; the longer simmer is expressed via cookSec.
    fuel: { itemId: 'wood', amount: 1 },
    cookSec: 6
  }
]

export function getCookableById(id: string): CookableItem | null {
  return COOKABLE_ITEMS.find((c) => c.id === id) ?? null
}

// Recipe matcher for the drop-and-cook menu. Cells are SYMBOLIC: each
// holds one ingredient type, never two of the same. `inputs` is the
// list of placed cell contents (nulls allowed but ignored). A recipe
// matches when its set of ingredient ids equals the set of placed ids.
//
// Fuel (wood) is intentionally NOT part of the match — the player gets
// a recipe preview as soon as they've placed the right INGREDIENTS,
// even before dropping wood in the burner. The fuel requirement is
// enforced separately by the cook session before the COOK button
// enables. Recipe quantities are also not consulted here; they're
// enforced at COOK time against the player's inventory totals.
export function matchCookRecipe(
  inputs: readonly (string | null)[]
): CookableItem | null {
  const placed = new Set<string>()
  for (const id of inputs) {
    if (id !== null) placed.add(id)
  }
  for (const recipe of COOKABLE_ITEMS) {
    if (recipe.ingredients.length !== placed.size) continue
    let matches = true
    for (const ing of recipe.ingredients) {
      if (!placed.has(ing.itemId)) {
        matches = false
        break
      }
    }
    if (matches) return recipe
  }
  return null
}
