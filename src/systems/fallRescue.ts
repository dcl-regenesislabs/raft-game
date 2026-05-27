import { InputModifier, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'

import { FALL_LIFE_DAMAGE_PCT } from '../config/gameConfig'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { isOnFloatingIsland } from './floatingIsland'
import { playSfx } from '../audio/sfx'
import { isGameOver } from '../ui/gameOver'
import { isStartupGateActive } from '../ui/startupGate'
import { adjustStat } from '../ui/statsBars'

// How far below the water surface the player has to drop before we bail them
// out. A small buffer avoids triggering on jumps that briefly dip below.
const FALL_THRESHOLD = WATER_LEVEL - 0.5

// Y offset above the platform top so the player lands cleanly instead of
// clipping into geometry.
const RESCUE_HEIGHT_OFFSET = 1

// Lock player input for this long after a rescue so the teleport lands
// cleanly and the rescue can't re-trigger from residual downward motion.
const MOVEMENT_LOCK_S = 1

// Extra grace period after the lock lifts before another rescue can fire,
// covering the case where movePlayerTo's promise resolves before the
// camera/physics actually settle above the threshold.
const RESCUE_COOLDOWN_S = 1.5

function setMovementLocked(locked: boolean): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: locked,
      disableJog: locked,
      // Run, double-jump and gliding are scene-wide invariants. Without
      // pinning them here, releasing the rescue lock would write a fresh
      // standard modifier with no flags and silently re-enable them —
      // the bug previously seen on lobby → game transitions, where
      // movePlayerTo's async settle leaves the player briefly below
      // WATER_LEVEL just long enough for this system to fire and unlock.
      disableRun: true,
      disableJump: locked,
      disableDoubleJump: true,
      disableGliding: true
    })
  })
}

export function createFallRescueSystem(platformCenter: Vector3) {
  // Gate concurrent rescue calls. movePlayerTo is async and the player can
  // still be below threshold mid-teleport — without this we'd fire it every
  // frame.
  let inFlight = false
  let cooldownRemaining = 0
  let lockRemaining = 0

  return function fallRescueSystem(dt: number): void {
    if (lockRemaining > 0) {
      lockRemaining -= dt
      if (lockRemaining <= 0) {
        lockRemaining = 0
        setMovementLocked(false)
      }
    }
    if (cooldownRemaining > 0) {
      cooldownRemaining -= dt
      if (cooldownRemaining < 0) cooldownRemaining = 0
    }

    // While the lobby is up the player legitimately stands at y≈0.3
    // (lobby raft surface) — far below the game's WATER_LEVEL fall
    // threshold. Suppress the rescue so the lobby doesn't constantly
    // teleport the player back onto a non-existent main raft.
    if (isStartupGateActive()) return

    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player === null) return
    if (player.position.y >= FALL_THRESHOLD) return
    if (isOnFloatingIsland(player.position.x, player.position.z)) return
    if (inFlight) return
    if (cooldownRemaining > 0) return
    // Skip rescue + damage while the death screen is up. The player
    // can't move during the overlay, but a floating-point drift below
    // threshold could still trigger a life debit on a corpse.
    if (isGameOver()) return

    // Charge life damage once per fall — `inFlight` plus the cooldown
    // ensure the system only fires once per dip, so each fall costs
    // FALL_LIFE_DAMAGE_PCT and not more.
    playSfx('fallSplash')
    adjustStat('life', -FALL_LIFE_DAMAGE_PCT / 100)

    inFlight = true
    cooldownRemaining = RESCUE_COOLDOWN_S
    lockRemaining = MOVEMENT_LOCK_S
    setMovementLocked(true)

    movePlayerTo({
      newRelativePosition: Vector3.create(
        platformCenter.x,
        platformCenter.y + RESCUE_HEIGHT_OFFSET,
        platformCenter.z
      )
    }).finally(() => {
      inFlight = false
    })
  }
}
