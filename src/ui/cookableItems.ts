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
  // Optional 3D model for the finished plate. When present the grill
  // spawns a GLB instead of a flat sprite at the Cooking → Ready
  // transition, and the held viewmodel uses the GLB in the player's
  // hand. Only the tier-4 hero plates set this; everything else falls
  // back to the `texture`-based sprite.
  glb?: string
}

const WOOD: CookIngredient = { itemId: 'wood', amount: 1 }

// Cook-time tiers — ladders complexity with ingredient count without
// ever exceeding 8 seconds. With pasta no longer a separate axis,
// pasta plates fall into whichever ingredient-count tier they belong
// to (e.g. spaghetti_alle_vongole at 2-ing → SEC_2).
const SEC_1 = 4
const SEC_2 = 5
const SEC_3 = 6
const SEC_4 = 8

// All recipes use unique ingredients (no duplicates inside a single
// recipe) so `amount: 1` everywhere — the matcher uses set equality and
// quantity is enforced separately at COOK time against the player's
// inventory totals.
const ING = (id: string): CookIngredient => ({ itemId: id, amount: 1 })

export const COOKABLE_ITEMS: readonly CookableItem[] = [
  // ─── 1-ingredient plates (5) ────────────────────────────────────────
  {
    id: 'grilled_sardines',
    name: 'GRILLED SARDINES',
    description: 'A simple grilled sardine. Light and clean.',
    texture: 'images/cooking/grilled_sardines.png',
    ingredients: [ING('sardines')],
    fuel: WOOD,
    cookSec: SEC_1
  },
  {
    id: 'boiled_mussels',
    name: 'BOILED MUSSELS',
    description: 'Mussels boiled open. Quick and warming.',
    texture: 'images/cooking/boiled_mussels.png',
    ingredients: [ING('mussels')],
    fuel: WOOD,
    cookSec: SEC_1
  },
  {
    id: 'charred_squid',
    name: 'CHARRED SQUID',
    description: 'Squid charred straight on the grill.',
    texture: 'images/cooking/charred_squid.png',
    ingredients: [ING('squid')],
    fuel: WOOD,
    cookSec: SEC_1
  },
  {
    id: 'roasted_potato',
    name: 'ROASTED POTATO',
    description: 'A potato roasted in its skin. Filling fuel.',
    texture: 'images/cooking/roasted_potato.png',
    ingredients: [ING('potato')],
    fuel: WOOD,
    cookSec: SEC_1
  },
  {
    id: 'grilled_shark_meat',
    name: 'GRILLED SHARK MEAT',
    description: 'Dense shark meat seared over open flame.',
    texture: 'images/cooking/grilled_shark_meat.png',
    ingredients: [ING('shark_meat')],
    fuel: WOOD,
    cookSec: SEC_1
  },

  // ─── 2-ingredient plates (15) ───────────────────────────────────────
  {
    id: 'salted_sardines',
    name: 'SALTED SARDINES',
    description: 'Sardines cured with sea salt. Sharper bite.',
    texture: 'images/cooking/salted_sardines.png',
    ingredients: [ING('sardines'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'clam_broth',
    name: 'CLAM BROTH',
    description: 'A clear, briny broth from steamed clams.',
    texture: 'images/cooking/clam_broth.png',
    ingredients: [ING('clams'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'garlic_squid',
    name: 'GARLIC SQUID',
    description: 'Squid sautéed in pungent garlic.',
    texture: 'images/cooking/garlic_squid.png',
    ingredients: [ING('squid'), ING('garlic')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'shark_steak',
    name: 'SHARK STEAK',
    description: 'A thick shark steak, salted and seared.',
    texture: 'images/cooking/shark_steak.png',
    ingredients: [ING('shark_meat'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'crab_with_sea_salt',
    name: 'CRAB WITH SEA SALT',
    description: 'Crab cracked and dressed with sea salt.',
    texture: 'images/cooking/crab_with_sea_salt.png',
    ingredients: [ING('crab'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'sardines_pomodoro',
    name: 'SARDINES POMODORO',
    description: 'Sardines simmered in tomato sauce.',
    texture: 'images/cooking/sardines_pomodoro.png',
    ingredients: [ING('sardines'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'mussels_pomodoro',
    name: 'MUSSELS POMODORO',
    description: 'Mussels in a quick tomato sauce.',
    texture: 'images/cooking/mussels_pomodoro.png',
    ingredients: [ING('mussels'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'squid_with_seaweed',
    name: 'SQUID WITH SEAWEED',
    description: 'Squid wrapped in tender seaweed.',
    texture: 'images/cooking/squid_with_seaweed.png',
    ingredients: [ING('squid'), ING('seaweed')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'crab_with_potato',
    name: 'CRAB WITH POTATO',
    description: 'Crab and potato — sea meets land.',
    texture: 'images/cooking/crab_with_potato.png',
    ingredients: [ING('crab'), ING('potato')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'shark_with_potato',
    name: 'SHARK WITH POTATO',
    description: 'Shark roasted alongside hearty potato.',
    texture: 'images/cooking/shark_with_potato.png',
    ingredients: [ING('shark_meat'), ING('potato')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'squid_with_tomato',
    name: 'SQUID WITH TOMATO',
    description: 'Squid braised in fresh tomato.',
    texture: 'images/cooking/squid_with_tomato.png',
    ingredients: [ING('squid'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'shark_with_tomato',
    name: 'SHARK WITH TOMATO',
    description: 'Shark steak in a tomato glaze.',
    texture: 'images/cooking/shark_with_tomato.png',
    ingredients: [ING('shark_meat'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'sardines_in_oil',
    name: 'SARDINES IN OIL',
    description: 'Sardines confit in olive oil.',
    texture: 'images/cooking/sardines_in_oil.png',
    ingredients: [ING('sardines'), ING('olive_oil')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'mussels_and_clams',
    name: 'MUSSELS AND CLAMS',
    description: 'A simple shellfish duo, steamed open.',
    texture: 'images/cooking/mussels_and_clams.png',
    ingredients: [ING('mussels'), ING('clams')],
    fuel: WOOD,
    cookSec: SEC_2
  },
  {
    id: 'spaghetti_alle_vongole',
    name: 'SPAGHETTI ALLE VONGOLE',
    description: 'Spaghetti with clams. Simple and briny.',
    texture: 'images/cooking/spaghetti_alle_vongole.png',
    ingredients: [ING('spaghetti'), ING('clams')],
    fuel: WOOD,
    cookSec: SEC_2
  },

  // ─── 3-ingredient plates (8) ────────────────────────────────────────
  {
    id: 'spaghetti_with_sardines',
    name: 'SPAGHETTI WITH SARDINES',
    description: 'Spaghetti tossed with sardines and a pinch of salt.',
    texture: 'images/cooking/spaghetti_with_sardines.png',
    ingredients: [ING('spaghetti'), ING('sardines'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'fettuccine_with_shark',
    name: 'FETTUCCINE WITH SHARK',
    description: 'Fettuccine topped with a salted shark steak.',
    texture: 'images/cooking/fettuccine_with_shark.png',
    ingredients: [ING('fettuccine'), ING('shark_meat'), ING('sea_salt')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'spaghetti_mussels',
    name: 'SPAGHETTI MUSSELS',
    description: 'Spaghetti with mussels in tomato sauce.',
    texture: 'images/cooking/spaghetti_mussels.png',
    ingredients: [ING('spaghetti'), ING('mussels'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'fettuccine_squid',
    name: 'FETTUCCINE SQUID',
    description: 'Fettuccine with squid, finished with garlic.',
    texture: 'images/cooking/fettuccine_squid.png',
    ingredients: [ING('fettuccine'), ING('squid'), ING('garlic')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'fettuccine_pomodoro',
    name: 'FETTUCCINE POMODORO',
    description: 'Fettuccine with sardines in tomato sauce.',
    texture: 'images/cooking/fettuccine_pomodoro.png',
    ingredients: [ING('fettuccine'), ING('sardines'), ING('tomatoes')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'spaghetti_squid_seaweed',
    name: 'SPAGHETTI SQUID SEAWEED',
    description: 'Spaghetti with squid and a salty seaweed sauce.',
    texture: 'images/cooking/spaghetti_squid_seaweed.png',
    ingredients: [ING('spaghetti'), ING('squid'), ING('seaweed')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'fettuccine_crab_potato',
    name: 'FETTUCCINE CRAB POTATO',
    description: 'Fettuccine with crab and potato in a salted broth.',
    texture: 'images/cooking/fettuccine_crab_potato.png',
    ingredients: [ING('fettuccine'), ING('crab'), ING('potato')],
    fuel: WOOD,
    cookSec: SEC_3
  },
  {
    id: 'seafood_stew',
    name: 'SEAFOOD STEW',
    description: 'A briny stew of squid, clams, and seaweed.',
    texture: 'images/cooking/seafood_stew.png',
    ingredients: [ING('squid'), ING('clams'), ING('seaweed')],
    fuel: WOOD,
    cookSec: SEC_3
  },

  // ─── 4-ingredient hero plates (2) ───────────────────────────────────
  {
    id: 'spaghetti_shark_pomodoro',
    name: 'SPAGHETTI SHARK POMODORO',
    description: 'Spaghetti with shark meat in a rich tomato sauce, finished with olive oil.',
    texture: 'images/cooking/spaghetti_shark_pomodoro.png',
    glb: 'assets/scene/items/spaghetti_shark_pomodoro.glb',
    ingredients: [ING('spaghetti'), ING('shark_meat'), ING('tomatoes'), ING('olive_oil')],
    fuel: WOOD,
    cookSec: SEC_4
  },
  {
    id: 'fettuccine_sea_food',
    name: 'FETTUCCINE SEA FOOD',
    description: 'A seafood feast: fettuccine with shark, squid, and crab.',
    texture: 'images/cooking/fettuccine_sea_food.png',
    glb: 'assets/scene/items/fettuccine_sea_food.glb',
    ingredients: [ING('fettuccine'), ING('shark_meat'), ING('squid'), ING('crab')],
    fuel: WOOD,
    cookSec: SEC_4
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
