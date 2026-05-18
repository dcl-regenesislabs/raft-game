import { engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { FloatingIsland } from '../components'
import { isAnchored } from './anchorState'
import { isBoatChefActive } from './boatChefDirector'
import { activateFloatingIsland } from '../factories/floatingIsland'
import { GRID_ORIGIN } from '../factories/platform'
import { aabbHalfExtentAlong, getPlatformExtent } from '../factories/platformExtent'
import { isStartupGateActive } from '../ui/startupGate'
import {
  SEA_FLOW_DIR_X,
  SEA_FLOW_DIR_Z,
  WATER_LEVEL
} from '../factories/sceneLevels'

// --- tunables ---
const SPAWN_INTERVAL_S = 15
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

let elapsed = SPAWN_INTERVAL_S
// Set by armIslandEvent({ immediate: true }) — fires one spawn on the next
// tick that has a built game world, bypassing the boat-chef and anchor
// gates. The startup gate still applies (no islands while the lobby UI is
// up). Mirrors armBoatChefEvent's immediate-fire path.
let forceSpawnArmed = false

// Called from `buildGameWorld`. `immediate: true` (DEBUG / SKIP_LOBBY) drops
// an island into the scene on the next tick so the encounter is testable
// from any session start; otherwise the regular spawn timer runs.
export function armIslandEvent(opts: { immediate: boolean }): void {
  if (opts.immediate) forceSpawnArmed = true
}

export function islandSpawnerSystem(dt: number): void {
  if (isStartupGateActive()) return
  // The island is a pooled entity that always exists with the
  // FloatingIsland component. We cap by counting *active* islands so the
  // hidden pool slot doesn't read as already-spawned.
  let activeCount = 0
  for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
    if (FloatingIsland.get(entity).active) activeCount++
    if (activeCount >= MAX_ISLANDS) {
      forceSpawnArmed = false
      return
    }
  }
  if (forceSpawnArmed) {
    forceSpawnArmed = false
    elapsed = 0
    spawnIsland()
    return
  }
  if (isAnchored()) return
  if (isBoatChefActive()) return
  elapsed += dt
  if (elapsed < SPAWN_INTERVAL_S) return
  elapsed = 0
  spawnIsland()
}

function spawnIsland(): void {
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
  if (spawn === null) return

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
