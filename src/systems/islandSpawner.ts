import { engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { FloatingIsland } from '../components'
import { isAnchored } from './anchorState'
import { isBoatChefActive } from './boatChefDirector'
import { createFloatingIsland } from '../factories/floatingIsland'
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
// Floor on perp distance from the raft edge to the island path. If neither
// side of the map can fit this much clearance, we skip the spawn tick.
const LATERAL_FLOOR_M = 22
// Fraction of the available perp distance to push the island toward the
// scene edge. 1.0 = the island centre sits right at the perp-axis spawn
// margin. The island visual extends a few metres past the scene boundary
// at this extreme, which reads as "the horizon" rather than a clip — the
// despawn check (SCENE_MARGIN = 3 in floatingIsland.ts) still removes the
// entity once its centre crosses the boundary as it drifts downstream.
const LATERAL_FRACTION = 1.0
// Absolute cap so the FULL (800m) map doesn't put islands so far out they
// stop being visible. 150m sits well beyond rendering fade for the demo's
// 80m scene and still reads as "horizon" on the full map.
const LATERAL_MAX_M = 150
const MAP_EDGE_SPAWN_MARGIN = 5
const MIN_UPSTREAM_GAP = 8
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
  // Cap simultaneous islands — applies to both the timer path and the
  // forced-spawn path.
  let count = 0
  for (const _ of engine.getEntitiesWith(FloatingIsland)) {
    count++
    if (count >= MAX_ISLANDS) {
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
  const anchorX = (extent.minX + extent.maxX) / 2
  const anchorZ = (extent.minZ + extent.maxZ) / 2
  const flowX = SEA_FLOW_DIR_X
  const flowZ = SEA_FLOW_DIR_Z
  const perpX = flowZ
  const perpZ = -flowX
  const flowHalf = aabbHalfExtentAlong(extent, flowX, flowZ)
  const perpHalf = aabbHalfExtentAlong(extent, perpX, perpZ)
  const sceneSize = GRID_ORIGIN.x * 2

  // Push the island as far from the raft along the perp axis as the map
  // allows. Start at LATERAL_FRACTION of perpMax (capped by LATERAL_MAX_M
  // and the no-radius MAP_EDGE_SPAWN_MARGIN perp clamp), then back off
  // geometrically if the lateral position lands in a corner with no
  // upstream/downstream flow room — corners trade perp distance for
  // along-flow drift room. Returns null only if no perp distance down to
  // LATERAL_FLOOR_M leaves enough flow room.
  const tryPick = (side: number) => {
    const perpMax = maxFlowDistance(anchorX, anchorZ, perpX * side, perpZ * side, sceneSize, MAP_EDGE_SPAWN_MARGIN)
    const lateralFloor = perpHalf + LATERAL_FLOOR_M
    if (lateralFloor > perpMax) return null
    let lateralMag = Math.min(perpMax * LATERAL_FRACTION, LATERAL_MAX_M)
    if (lateralMag < lateralFloor) lateralMag = lateralFloor
    for (let attempt = 0; attempt < 10; attempt++) {
      const lx = anchorX + perpX * side * lateralMag
      const lz = anchorZ + perpZ * side * lateralMag
      const upstreamMax = maxFlowDistance(lx, lz, -flowX, -flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
      const downstreamMax = maxFlowDistance(lx, lz, flowX, flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
      if (
        upstreamMax >= flowHalf + MIN_UPSTREAM_GAP &&
        downstreamMax >= MIN_UPSTREAM_GAP
      ) {
        return { lateralX: lx, lateralZ: lz, upstreamMax, downstreamMax }
      }
      lateralMag *= 0.85
      if (lateralMag < lateralFloor) return null
    }
    return null
  }

  const firstSide = Math.random() < 0.5 ? -1 : 1
  const pick = tryPick(firstSide) ?? tryPick(-firstSide)
  if (!pick) return
  const { lateralX, lateralZ, upstreamMax, downstreamMax } = pick

  // Always spawn at the map edge so the island is never near the raft at birth
  const spawnDistance = upstreamMax
  const along = -spawnDistance

  const position = Vector3.create(
    lateralX + flowX * along,
    WATER_LEVEL,
    lateralZ + flowZ * along
  )

  const speed = DRIFT_SPEED + (Math.random() * 2 - 1) * DRIFT_SPEED_JITTER
  const velocity = Vector3.create(flowX * speed, 0, flowZ * speed)
  const totalDistance = spawnDistance + downstreamMax
  const maxLifetime = totalDistance / Math.max(speed, 0.1) + 5

  createFloatingIsland({ position, velocity, maxLifetime })
}

function maxFlowDistance(
  startX: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  sceneSize: number,
  margin: number
): number {
  const lo = margin
  const hi = sceneSize - margin
  let t = Infinity
  const eps = 1e-6
  if (dirX > eps) t = Math.min(t, (hi - startX) / dirX)
  else if (dirX < -eps) t = Math.min(t, (lo - startX) / dirX)
  if (dirZ > eps) t = Math.min(t, (hi - startZ) / dirZ)
  else if (dirZ < -eps) t = Math.min(t, (lo - startZ) / dirZ)
  return Math.max(0, t)
}
