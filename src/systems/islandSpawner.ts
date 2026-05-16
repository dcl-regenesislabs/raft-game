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
// How far upstream from the raft islands spawn
const SPAWN_DISTANCE_MARGIN = 35
// Lateral offset from raft edge — large enough that the island (radius ~10m)
// never overlaps the raft deck.
const BYPASS_MIN_MARGIN = 14
const BYPASS_MAX_MARGIN = 20
const MAP_EDGE_SPAWN_MARGIN = 5
const MIN_UPSTREAM_GAP = 8
const MAX_ISLANDS = 1

let elapsed = SPAWN_INTERVAL_S

export function islandSpawnerSystem(dt: number): void {
  if (isStartupGateActive()) return
  if (isAnchored()) return
  if (isBoatChefActive()) return
  // Cap simultaneous islands
  let count = 0
  for (const _ of engine.getEntitiesWith(FloatingIsland)) {
    count++
    if (count >= MAX_ISLANDS) return
  }
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

  const side = Math.random() < 0.5 ? -1 : 1
  const lateral = side * (perpHalf + BYPASS_MIN_MARGIN + Math.random() * (BYPASS_MAX_MARGIN - BYPASS_MIN_MARGIN))
  const lateralX = anchorX + perpX * lateral
  const lateralZ = anchorZ + perpZ * lateral

  const upstreamMax = maxFlowDistance(lateralX, lateralZ, -flowX, -flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
  const downstreamMax = maxFlowDistance(lateralX, lateralZ, flowX, flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)

  if (upstreamMax < flowHalf + MIN_UPSTREAM_GAP) return
  if (downstreamMax < MIN_UPSTREAM_GAP) return

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
