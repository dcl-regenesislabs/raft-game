import { LIFE_REGEN_PCT_PER_S } from '../config/gameConfig'
import { isGameOver } from '../ui/gameOver'
import { isStartupGateActive } from '../ui/startupGate'
import { adjustStat, getStat } from '../ui/statsBars'

// Designer-facing rate in gameConfig is percentage-points-per-second; the
// stat store is 0..1, so scale once here.
const PCT = 1 / 100

// Passive life regeneration. Refills the bar at LIFE_REGEN_PCT_PER_S
// (≈10% per minute) so a wiped-out player recovers in ~10 minutes of
// uneventful play. Skipped during game-over and lobby for the same
// reasons survivalDrain skips them. Bailing out at the 1.0 cap matters:
// `adjustStat` clamps to [0, 1], so blindly adding while life sits
// over-cap (e.g. from a future life-bonus food) would pull it back
// down to 1.0.
export function lifeRegenSystem(dt: number): void {
  if (isGameOver()) return
  if (isStartupGateActive()) return
  if (getStat('life') >= 1) return
  adjustStat('life', LIFE_REGEN_PCT_PER_S * PCT * dt)
}
