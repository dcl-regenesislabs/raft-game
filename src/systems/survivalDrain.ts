import {
  HUNGER_DRAIN_PCT_PER_S,
  LIFE_DAMAGE_BOTH_PCT_PER_S,
  LIFE_DAMAGE_SINGLE_PCT_PER_S,
  THIRST_DRAIN_PCT_PER_S
} from '../config/gameConfig'
import { adjustStat, getStat } from '../ui/statsBars'

// Designer-facing rates in gameConfig are percentage-points-per-second; the
// stat store is 0..1, so scale once here.
const PCT = 1 / 100

// Drains hunger and thirst every frame, then applies starvation/dehydration
// damage to life when either bar hits empty. Both empty deals the BOTH rate
// (which is already the sum of the singles), not stacked.
export function survivalDrainSystem(dt: number): void {
  adjustStat('hunger', -HUNGER_DRAIN_PCT_PER_S * PCT * dt)
  adjustStat('thirst', -THIRST_DRAIN_PCT_PER_S * PCT * dt)

  const hungerEmpty = getStat('hunger') <= 0
  const thirstEmpty = getStat('thirst') <= 0
  if (!hungerEmpty && !thirstEmpty) return

  const damagePct =
    hungerEmpty && thirstEmpty
      ? LIFE_DAMAGE_BOTH_PCT_PER_S
      : LIFE_DAMAGE_SINGLE_PCT_PER_S
  adjustStat('life', -damagePct * PCT * dt)
}
