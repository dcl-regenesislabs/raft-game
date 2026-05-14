// Per-food effects applied when the player consumes a stack item. Stat
// values are expressed in the same 0..100 scale the player-facing UI uses
// for hunger / thirst (the underlying stat is normalised to 0..1, so each
// integer here equals 0.01 on the bar).
//
//   hunger      — added to the hunger stat, clamped at the normal max.
//   hungerBonus — added on top, allowed to exceed the max as a reserve
//                 (the bar caps at full but the underlying value stays
//                 high until something drains it).
//   thirst      — signed delta on thirst (salt water sets it negative).
//
// All four values default to 0; only the non-zero columns are listed.
//
// Plate values follow a tier formula derived from ingredient count
// (1→12, 2→25, 3→40, 4→60), tuned so the rare 4-ing hero plates feel
// exceptional. Thematic modifiers stacked on top:
//   • pasta plates (any spaghetti/fettuccine recipe) carry a +20
//     hungerBonus reserve.
//   • broth/soup/stew plates restore +10 thirst (thin liquid).
//   • sea_salt as an ingredient subtracts 4 thirst (salty bite).
//   • olive_oil as an ingredient adds another +10 hungerBonus reserve.

export interface FoodEffect {
  hunger?: number
  hungerBonus?: number
  thirst?: number
}

const FOOD_EFFECTS: Record<string, FoodEffect> = {
  // ─── Containers / liquids ─────────────────────────────────────────
  saltWater:  { thirst: -25 },
  freshWater: { thirst: 25 },

  // ─── Raw ingredients (low edibility — survival fallback) ─────────
  sardines:   { hunger: 4, thirst: -2 },
  mussels:    { hunger: 4, thirst: -2 },
  clams:      { hunger: 4, thirst: -2 },
  squid:      { hunger: 4, thirst: -2 },
  crab:       { hunger: 4, thirst: -2 },
  shark_meat: { hunger: 6, thirst: -3 },
  seaweed:    { hunger: 3, thirst: 2 },
  tomatoes:   { hunger: 3, thirst: 4 },
  potato:     { hunger: 4 },
  garlic:     { hunger: 1, thirst: -1 },
  olive_oil:  { hunger: 6 },
  sea_salt:   { thirst: -8 },
  spaghetti:  { hunger: 4, thirst: -2 },
  fettuccine: { hunger: 4, thirst: -2 },

  // ─── 1-ingredient plates (hunger 12) ──────────────────────────────
  grilled_sardines:   { hunger: 12 },
  boiled_mussels:     { hunger: 12 },
  charred_squid:      { hunger: 12 },
  roasted_potato:     { hunger: 12 },
  grilled_shark_meat: { hunger: 12 },

  // ─── 2-ingredient plates (hunger 25) ──────────────────────────────
  salted_sardines:    { hunger: 25, thirst: -4 },
  clam_broth:         { hunger: 25, thirst: 6 },                  // -4 (salt) + 10 (broth)
  garlic_squid:       { hunger: 25 },
  shark_steak:        { hunger: 25, thirst: -4 },
  crab_with_sea_salt: { hunger: 25, thirst: -4 },
  sardines_pomodoro:  { hunger: 25 },
  mussels_pomodoro:   { hunger: 25 },
  squid_with_seaweed: { hunger: 25 },
  crab_with_potato:   { hunger: 25 },
  shark_with_potato:  { hunger: 25 },
  squid_with_tomato:  { hunger: 25 },
  shark_with_tomato:  { hunger: 25 },
  sardines_in_oil:    { hunger: 25, hungerBonus: 10 },             // +oil
  mussels_and_clams:  { hunger: 25 },
  spaghetti_alle_vongole: { hunger: 25, hungerBonus: 20 },         // +pasta

  // ─── 3-ingredient plates (hunger 40) ──────────────────────────────
  spaghetti_with_sardines: { hunger: 40, hungerBonus: 20, thirst: -4 }, // +pasta +salt
  fettuccine_with_shark:   { hunger: 40, hungerBonus: 20, thirst: -4 }, // +pasta +salt
  spaghetti_mussels:       { hunger: 40, hungerBonus: 20 },             // +pasta
  fettuccine_squid:        { hunger: 40, hungerBonus: 20 },             // +pasta
  fettuccine_pomodoro:     { hunger: 40, hungerBonus: 20 },             // +pasta
  spaghetti_squid_seaweed: { hunger: 40, hungerBonus: 20 },             // +pasta
  fettuccine_crab_potato:  { hunger: 40, hungerBonus: 20 },             // +pasta
  seafood_stew:            { hunger: 40, thirst: 10 },                  // +stew

  // ─── 4-ingredient hero plates (hunger 60) ─────────────────────────
  spaghetti_shark_pomodoro: { hunger: 60, hungerBonus: 30 },            // +pasta +oil
  fettuccine_sea_food:    { hunger: 60, hungerBonus: 20 }               // +pasta
}

export function getFoodEffect(id: string): FoodEffect | null {
  return FOOD_EFFECTS[id] ?? null
}
