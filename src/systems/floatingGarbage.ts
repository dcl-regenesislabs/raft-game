import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'

import { FloatingGarbage, FloatingIsland } from '../components'
import { GRID_ORIGIN } from '../factories/platform'
import { RAD_TO_DEG } from '../utils/math'

// Vertical bob frequency in radians/second. ~0.2 Hz feels like a slow
// ocean swell rather than a video-game wobble.
const BOB_RATE = Math.PI * 0.4
// Margin (metres) inside the parcel boundary at which we despawn an item
// that has drifted out of view.
const SCENE_MARGIN = 3

// Sinking speed when islands are active — garbage descends below water
// and gets removed once it's far enough down that the pop is invisible.
const SINK_SPEED = 1.5
const SINK_REMOVE_DEPTH = 2.0

// True when at least one FloatingIsland exists. Cached per frame.
let islandPresent = false

export function hasActiveIsland(): boolean {
  return islandPresent
}

export function floatingGarbageSystem(dt: number): void {
  const sceneSize = GRID_ORIGIN.x * 2

  // Check once per frame whether any island is alive
  islandPresent = false
  for (const _ of engine.getEntitiesWith(FloatingIsland)) {
    islandPresent = true
    break
  }

  for (const [entity] of engine.getEntitiesWith(FloatingGarbage, Transform)) {
    const garbage = FloatingGarbage.getMutable(entity)
    garbage.lifetime += dt
    if (garbage.lifetime >= garbage.maxLifetime) {
      engine.removeEntity(entity)
      continue
    }

    garbage.bobPhase += BOB_RATE * dt

    const transform = Transform.getMutable(entity)
    const pos = transform.position
    pos.x += garbage.velocityX * dt
    pos.z += garbage.velocityZ * dt

    if (islandPresent) {
      // Sink below water and remove once invisible
      pos.y -= SINK_SPEED * dt
      if (pos.y < garbage.baseY - SINK_REMOVE_DEPTH) {
        engine.removeEntity(entity)
        continue
      }
    } else {
      pos.y = garbage.baseY + Math.sin(garbage.bobPhase) * garbage.bobAmplitude
    }

    // Despawn the moment the item leaves the parcel footprint
    if (
      pos.x < SCENE_MARGIN ||
      pos.x > sceneSize - SCENE_MARGIN ||
      pos.z < SCENE_MARGIN ||
      pos.z > sceneSize - SCENE_MARGIN
    ) {
      engine.removeEntity(entity)
      continue
    }

    // Rebuild rotation each frame from euler so pitch/roll oscillate cleanly
    const yawDeg = garbage.baseYawDeg + garbage.spinSpeed * garbage.lifetime * RAD_TO_DEG
    const rollDeg =
      garbage.rollAmplitude > 0
        ? Math.sin(garbage.bobPhase * 1.3) * garbage.rollAmplitude
        : 0
    const pitchDeg =
      garbage.rollAmplitude > 0
        ? Math.sin(garbage.bobPhase + 0.7) * garbage.rollAmplitude * 0.6
        : 0
    transform.rotation = Quaternion.fromEulerDegrees(pitchDeg, yawDeg, rollDeg)
  }
}
