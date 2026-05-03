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

export interface FoodEffect {
  hunger?: number
  hungerBonus?: number
  thirst?: number
}

const FOOD_EFFECTS: Record<string, FoodEffect> = {
  saltWater: { thirst: -25 },
  freshWater: { thirst: 25 },
  rawFish: { hunger: 4, thirst: -4 },
  rawPotato: { hunger: 4 },
  cookedPotato: { hunger: 12 },
  cookedFish: { hunger: 10 },
  pasta: { hunger: 20 },
  cookedFishPasta: { hunger: 25, hungerBonus: 40 }
}

export function getFoodEffect(id: string): FoodEffect | null {
  return FOOD_EFFECTS[id] ?? null
}
