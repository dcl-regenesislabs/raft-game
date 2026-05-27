import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'

import { FloatingGarbage, FloatingIsland, Platform } from '../components'
import { destroyFloatingGarbage } from '../factories/floatingGarbage'
import { GRID_ORIGIN, RAFT_SIZE } from '../factories/platform'
import { isOnFloatingIsland } from './floatingIsland'
import { RAD_TO_DEG } from '../utils/math'

// Vertical bob frequency in radians/second. ~0.2 Hz feels like a slow
// ocean swell rather than a video-game wobble.
const BOB_RATE = Math.PI * 0.4
// Margin (metres) inside the parcel boundary at which we despawn an item
// that has drifted out of view.
const SCENE_MARGIN = 3
// Metres below the item's spawn baseY to tuck it when its (x,z) rounds
// into an occupied raft cell. Items have no collider against the deck
// (CL_POINTER only) so without this push they visibly clip THROUGH the
// raft. Default 0.6 m clears the platform collider underside (water at
// y=4, raft collider bottom at y=4.0) with a small margin. Per-kind
// overrides below for tall/buoyant kinds whose mesh would still peek
// through at the default depth.
const SUBMERGE_DROP_DEFAULT = 0.6
// Per-kind submerge override. Barrels sit higher at rest (yOffset +0.1)
// AND their mesh is taller than the others — a default drop leaves the
// top of the barrel poking up through the deck. 1.5 m sinks the whole
// barrel below the collider.
const SUBMERGE_DROP_BY_KIND: Record<string, number> = {
  barrel: 1.5
}
// Per-second lerp rate toward the surface/under-raft target. Tuned so
// the transition reads as the item dipping under the raft rather than
// snapping. ~0.15 s effective half-life at 60 fps.
const SUBMERGE_LERP_RATE = 6

// True when at least one *active* FloatingIsland is on screen. The pool
// slot itself always exists, so presence alone isn't a reliable signal.
let islandPresent = false

export function hasActiveIsland(): boolean {
  return islandPresent
}

// Per-frame set of occupied grid cells, keyed by 32-bit packing of
// (gridX, gridZ). Rebuilt at the top of every frame so newly placed or
// destroyed rafts are picked up without an explicit dirty flag. Raft
// counts are small (≤25 in demo, bounded by player builds in full) so
// the rebuild is O(N_rafts) with N tiny — cheaper than maintaining
// a subscription on placement/destruction.
const occupiedCells = new Set<number>()

function encodeCell(gx: number, gz: number): number {
  return ((gx & 0xffff) << 16) | (gz & 0xffff)
}

function rebuildOccupancy(): void {
  occupiedCells.clear()
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    const cell = Platform.get(entity)
    occupiedCells.add(encodeCell(cell.gridX, cell.gridZ))
  }
}

function isOverRaft(wx: number, wz: number): boolean {
  const gx = Math.round((wx - GRID_ORIGIN.x) / RAFT_SIZE)
  const gz = Math.round((wz - GRID_ORIGIN.z) / RAFT_SIZE)
  return occupiedCells.has(encodeCell(gx, gz))
}

export function floatingGarbageSystem(dt: number): void {
  const sceneSize = GRID_ORIGIN.x * 2

  // Check once per frame whether any island is alive. Used by the spawner
  // to suppress new debris while an island is on screen. Skip the pooled
  // entity when it's inactive.
  islandPresent = false
  for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
    if (!FloatingIsland.get(entity).active) continue
    islandPresent = true
    break
  }

  // Tilemap of which (gridX, gridZ) cells currently host a raft. Built
  // once per frame and queried per-item below to suppress items clipping
  // through the deck.
  rebuildOccupancy()
  const submergeBlend = Math.min(1, dt * SUBMERGE_LERP_RATE)

  for (const [entity] of engine.getEntitiesWith(FloatingGarbage, Transform)) {
    const garbage = FloatingGarbage.getMutable(entity)
    garbage.lifetime += dt
    if (garbage.lifetime >= garbage.maxLifetime) {
      destroyFloatingGarbage(entity)
      continue
    }

    garbage.bobPhase += BOB_RATE * dt

    const transform = Transform.getMutable(entity)
    const pos = transform.position
    pos.x += garbage.velocityX * dt
    pos.z += garbage.velocityZ * dt
    const surfaceY = garbage.baseY + Math.sin(garbage.bobPhase) * garbage.bobAmplitude
    const drop = SUBMERGE_DROP_BY_KIND[garbage.kind] ?? SUBMERGE_DROP_DEFAULT
    // The active floating-island participates in the same submersion
    // grid as rafts — items drifting over it dip under, matching the
    // platform behaviour.
    const overObstacle = isOverRaft(pos.x, pos.z) || isOnFloatingIsland(pos.x, pos.z)
    const targetY = overObstacle ? garbage.baseY - drop : surfaceY
    pos.y = pos.y + (targetY - pos.y) * submergeBlend

    // Despawn the moment the item leaves the parcel footprint
    if (
      pos.x < SCENE_MARGIN ||
      pos.x > sceneSize - SCENE_MARGIN ||
      pos.z < SCENE_MARGIN ||
      pos.z > sceneSize - SCENE_MARGIN
    ) {
      destroyFloatingGarbage(entity)
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
