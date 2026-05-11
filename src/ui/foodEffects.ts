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
//   life        — added to the life stat, clamped at the normal max.
//                 Cooked plates restore health; raw fallback food does
//                 not. Scales with ingredient tier.
//
// All values default to 0; only the non-zero columns are listed.
//
// Plate values follow a tier formula derived from ingredient count
// (1→12, 2→25, 3→40, 4→60 hunger; 1→5, 2→10, 3→15, 4→25 life), tuned
// so the rare 4-ing hero plates feel exceptional. Thematic modifiers
// stacked on top:
//   • pasta plates (any spaghetti/fettuccine recipe) carry a +20
//     hungerBonus reserve.
//   • broth/soup/stew plates restore +10 thirst (thin liquid).
//   • sea_salt as an ingredient subtracts 4 thirst (salty bite).
//   • olive_oil as an ingredient adds another +10 hungerBonus reserve.

export interface FoodEffect {
  hunger?: number
  hungerBonus?: number
  thirst?: number
  life?: number
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

  // ─── 1-ingredient plates (hunger 12, life 5) ──────────────────────
  grilled_sardines:   { hunger: 12, life: 5 },
  boiled_mussels:     { hunger: 12, life: 5 },
  charred_squid:      { hunger: 12, life: 5 },
  roasted_potato:     { hunger: 12, life: 5 },
  grilled_shark_meat: { hunger: 12, life: 5 },

  // ─── 2-ingredient plates (hunger 25, life 10) ─────────────────────
  salted_sardines:    { hunger: 25, thirst: -4, life: 10 },
  clam_broth:         { hunger: 25, thirst: 6, life: 10 },          // -4 (salt) + 10 (broth)
  garlic_squid:       { hunger: 25, life: 10 },
  shark_steak:        { hunger: 25, thirst: -4, life: 10 },
  crab_with_sea_salt: { hunger: 25, thirst: -4, life: 10 },
  sardines_pomodoro:  { hunger: 25, life: 10 },
  mussels_pomodoro:   { hunger: 25, life: 10 },
  squid_with_seaweed: { hunger: 25, life: 10 },
  crab_with_potato:   { hunger: 25, life: 10 },
  shark_with_potato:  { hunger: 25, life: 10 },
  squid_with_tomato:  { hunger: 25, life: 10 },
  shark_with_tomato:  { hunger: 25, life: 10 },
  sardines_in_oil:    { hunger: 25, hungerBonus: 10, life: 10 },    // +oil
  mussels_and_clams:  { hunger: 25, life: 10 },
  spaghetti_pomodoro: { hunger: 25, hungerBonus: 20, life: 10 },    // +pasta

  // ─── 3-ingredient plates (hunger 40, life 15) ─────────────────────
  spaghetti_with_sardines: { hunger: 40, hungerBonus: 20, thirst: -4, life: 15 }, // +pasta +salt
  fettuccine_with_shark:   { hunger: 40, hungerBonus: 20, thirst: -4, life: 15 }, // +pasta +salt
  spaghetti_mussels:       { hunger: 40, hungerBonus: 20, life: 15 },             // +pasta
  fettuccine_squid:        { hunger: 40, hungerBonus: 20, life: 15 },             // +pasta
  fettuccine_pomodoro:     { hunger: 40, hungerBonus: 20, life: 15 },             // +pasta
  spaghetti_squid_seaweed: { hunger: 40, hungerBonus: 20, life: 15 },             // +pasta
  fettuccine_crab_potato:  { hunger: 40, hungerBonus: 20, life: 15 },             // +pasta
  seafood_stew:            { hunger: 40, thirst: 10, life: 15 },                  // +stew

  // ─── 4-ingredient hero plates (hunger 60, life 25) ────────────────
  spaghetti_alle_vongole: { hunger: 60, hungerBonus: 30, life: 25 },              // +pasta +oil
  fettuccine_sea_hunter:  { hunger: 60, hungerBonus: 20, life: 25 }               // +pasta
}

export function getFoodEffect(id: string): FoodEffect | null {
  return FOOD_EFFECTS[id] ?? null
}
