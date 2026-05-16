import {
  HUNGER_DRAIN_PCT_PER_S,
  LIFE_DAMAGE_BOTH_PCT_PER_S,
  LIFE_DAMAGE_SINGLE_PCT_PER_S,
  LIFE_REGEN_PCT_PER_S,
  THIRST_DRAIN_PCT_PER_S
} from '../config/gameConfig'
import { isGameOver, triggerGameOver } from '../ui/gameOver'
import { isStartupGateActive } from '../ui/startupGate'
import { adjustStat, getStat } from '../ui/statsBars'

// Designer-facing rates in gameConfig are percentage-points-per-second; the
// stat store is 0..1, so scale once here.
const PCT = 1 / 100

// Drains hunger and thirst every frame, then applies starvation/dehydration
// damage to life when either bar hits empty. Both empty deals the BOTH rate
// (which is already the sum of the singles), not stacked.
export function survivalDrainSystem(dt: number): void {
  // Freeze every gameplay timer while the death screen is up. Otherwise
  // life/hunger/thirst would keep ticking and the player would re-die
  // immediately on Play Again before the reset frame even rendered.
  if (isGameOver()) return
  // Same idea for the lobby — the player hasn't started the run yet,
  // so survival timers shouldn't tick while they're picking a portal.
  if (isStartupGateActive()) return

  adjustStat('hunger', -HUNGER_DRAIN_PCT_PER_S * PCT * dt)
  adjustStat('thirst', -THIRST_DRAIN_PCT_PER_S * PCT * dt)

  const hungerEmpty = getStat('hunger') <= 0
  const thirstEmpty = getStat('thirst') <= 0
  if (hungerEmpty || thirstEmpty) {
    const damagePct =
      hungerEmpty && thirstEmpty
        ? LIFE_DAMAGE_BOTH_PCT_PER_S
        : LIFE_DAMAGE_SINGLE_PCT_PER_S
    adjustStat('life', -damagePct * PCT * dt)
  } else if (getStat('life') < 1) {
    // Passive RAFT-style regen. Gated on neither vital being empty so the
    // player can't out-heal starvation/dehydration damage; gated on life<1
    // so we don't fight adjustStat's [0,1] clamp when an over-cap value
    // (currently impossible for life, but cheap to be safe) is in play.
    adjustStat('life', LIFE_REGEN_PCT_PER_S * PCT * dt)
  }

  if (getStat('life') <= 0) triggerGameOver()
}
