import { engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { FloatingIsland } from '../components'
import { isAnchored } from './anchorState'
import { activateFloatingIsland } from '../factories/floatingIsland'
import { GRID_ORIGIN } from '../factories/platform'
import { aabbHalfExtentAlong, getPlatformExtent } from '../factories/platformExtent'
import {
  SEA_FLOW_DIR_X,
  SEA_FLOW_DIR_Z,
  WATER_LEVEL
} from '../factories/sceneLevels'

// Floating-island spawn service. Scheduling lives in `eventScheduler.ts`
// — this file only exposes a "try to spawn one right now" entry point
// plus the parcel-fitting geometry the spawn relies on. Callers retry
// every frame until the trigger reports success.

// --- tunables ---
// Much slower than debris so the player has time to jump on
const DRIFT_SPEED = 1.2
const DRIFT_SPEED_JITTER = 0.3
// Perpendicular-to-flow offset from the raft footprint to the island
// path. Sized so the island reads clearly from the deck — not jammed
// against the raft, not parked at the parcel edge.
const LATERAL_OFFSET_M = 15
// Along-flow offset from the lateral approach point to the spawn
// (upstream) and despawn (downstream) positions. Total visible drift
// distance = 2 × FLOW_OFFSET_M.
const FLOW_OFFSET_M = 15
// Safety margin against the parcel boundary. If the computed spawn
// would push the visual outside the scene, skip the tick instead of
// dropping a half-clipped island — caller will retry on the next
// interval.
const PARCEL_MARGIN_M = 10
const MAX_ISLANDS = 1

// Called from `eventScheduler.ts` when an island spawn is due. Returns
// true when an island was activated this call (so the scheduler can
// advance its clock); false when the cap is already hit, the player
// has anchored, or no parcel-safe spawn point could be found. The
// scheduler retries every frame until this reports success.
export function triggerIslandSpawn(): boolean {
  if (isAnchored()) return false
  for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
    if (FloatingIsland.get(entity).active) {
      // Already a live island on screen — cap is 1.
      return false
    }
    // We never inspect more than the single pooled entity; the cap
    // matches the pool size.
    break
  }
  return spawnIsland()
}

function spawnIsland(): boolean {
  const extent = getPlatformExtent()
  const flowX = SEA_FLOW_DIR_X
  const flowZ = SEA_FLOW_DIR_Z
  const perpX = flowZ
  const perpZ = -flowX
  const perpHalf = aabbHalfExtentAlong(extent, perpX, perpZ)
  const flowHalf = aabbHalfExtentAlong(extent, flowX, flowZ)
  const sceneSize = GRID_ORIGIN.x * 2

  const lateralDist = perpHalf + LATERAL_OFFSET_M
  const flowDist = flowHalf + FLOW_OFFSET_M

  // Try both sides perpendicular to flow. Pick the first whose spawn
  // position fits inside the parcel margins; fall through to the other
  // if it doesn't.
  const firstSide = Math.random() < 0.5 ? -1 : 1
  const spawn = tryComputeSpawn(extent.cx, extent.cz, perpX, perpZ, flowX, flowZ, firstSide, lateralDist, flowDist, sceneSize)
    ?? tryComputeSpawn(extent.cx, extent.cz, perpX, perpZ, flowX, flowZ, -firstSide, lateralDist, flowDist, sceneSize)
  if (spawn === null) return false

  const speed = DRIFT_SPEED + (Math.random() * 2 - 1) * DRIFT_SPEED_JITTER
  const velocity = Vector3.create(flowX * speed, 0, flowZ * speed)
  // Drift from spawn through the lateral approach to the symmetric
  // exit point, then despawn. Lifetime is the only despawn signal —
  // simpler than juggling parcel bounds with the spawn-margin math.
  const totalDistance = flowDist * 2
  const maxLifetime = totalDistance / Math.max(speed, 0.1)

  activateFloatingIsland({
    position: Vector3.create(spawn.x, WATER_LEVEL, spawn.z),
    velocity,
    maxLifetime
  })
  return true
}

function tryComputeSpawn(
  cx: number,
  cz: number,
  perpX: number,
  perpZ: number,
  flowX: number,
  flowZ: number,
  side: number,
  lateralDist: number,
  flowDist: number,
  sceneSize: number
): { x: number; z: number } | null {
  const lx = cx + perpX * side * lateralDist
  const lz = cz + perpZ * side * lateralDist
  const x = lx - flowX * flowDist
  const z = lz - flowZ * flowDist
  const lo = PARCEL_MARGIN_M
  const hi = sceneSize - PARCEL_MARGIN_M
  if (x < lo || x > hi || z < lo || z > hi) return null
  // Also reject if the exit point (symmetric downstream) would clip —
  // we don't want the island to vanish mid-flight by reaching a bound
  // before its lifetime expires.
  const exitX = lx + flowX * flowDist
  const exitZ = lz + flowZ * flowDist
  if (exitX < lo || exitX > hi || exitZ < lo || exitZ > hi) return null
  return { x, z }
}
