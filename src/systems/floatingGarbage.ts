import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'

import { FloatingGarbage } from '../components'
import { GRID_ORIGIN } from '../factories/platform'
import { RAD_TO_DEG } from '../utils/math'

// Vertical bob frequency in radians/second. ~0.2 Hz feels like a slow
// ocean swell rather than a video-game wobble.
const BOB_RATE = Math.PI * 0.4
// Margin (metres) inside the parcel boundary at which we despawn an item
// that has drifted out of view. Must be smaller than the spawn-side margin
// in `garbageSpawner.ts` (MAP_EDGE_SPAWN_MARGIN) so freshly-spawned items
// don't immediately self-despawn, and large enough that items always die
// BEFORE they cross the map edge — DCL hides anything outside the parcel
// footprint, so a 3 m cushion absorbs one frame of drift without flicker.
const SCENE_MARGIN = 3

// Per-frame: drift along stored velocity, sinusoidal bob on Y, gentle yaw
// drift + pitch/roll wobble, despawn on lifetime OR scene-bounds exit.
// Despawn is lifetime + bounds based (not platform-distance based) so we
// don't have to recompute the platform centroid for every debris entity.
export function floatingGarbageSystem(dt: number): void {
  // Scene is square and centred on GRID_ORIGIN; sceneSize = 2 * GRID_ORIGIN.x.
  // Read once per frame rather than per entity.
  const sceneSize = GRID_ORIGIN.x * 2

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
    pos.y = garbage.baseY + Math.sin(garbage.bobPhase) * garbage.bobAmplitude

    // Despawn the moment the item leaves the parcel footprint — DCL hides
    // entities outside scene bounds anyway, so keeping them around is waste.
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
    // instead of drifting. Yaw drift accumulates linearly via lifetime.
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
