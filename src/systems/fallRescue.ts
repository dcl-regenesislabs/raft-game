import { Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'

import { WATER_LEVEL } from '../factories/sceneLevels'

// How far below the water surface the player has to drop before we bail them
// out. A small buffer avoids triggering on jumps that briefly dip below.
const FALL_THRESHOLD = WATER_LEVEL - 0.5

// Y offset above the platform top so the player lands cleanly instead of
// clipping into geometry.
const RESCUE_HEIGHT_OFFSET = 1

export function createFallRescueSystem(platformCenter: Vector3) {
  // Gate concurrent rescue calls. movePlayerTo is async and the player can
  // still be below threshold mid-teleport — without this we'd fire it every
  // frame.
  let inFlight = false

  return function fallRescueSystem(): void {
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player === null) return
    if (player.position.y >= FALL_THRESHOLD) return
    if (inFlight) return

    inFlight = true
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
