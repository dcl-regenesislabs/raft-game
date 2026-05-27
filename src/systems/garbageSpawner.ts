import { Vector3 } from '@dcl/sdk/math'

import {
  GARBAGE_KINDS,
  createFloatingGarbage,
  pickWeightedKind
} from '../factories/floatingGarbage'
import { GRID_ORIGIN } from '../factories/platform'
import { aabbHalfExtentAlong, getPlatformExtent } from '../factories/platformExtent'
import { isStartupGateActive } from '../ui/startupGate'
import {
  SEA_FLOW_DIR_X,
  SEA_FLOW_DIR_Z,
  WATER_LEVEL
} from '../factories/sceneLevels'

// --- tunables ---
// Mean seconds between spawns. One item per tick, jittered ±SPAWN_INTERVAL_JITTER_S
// so the cadence reads as a steady drip rather than a metronome. Total
// throughput matches the previous "3 items / 12 s" group rhythm (~1 item
// every 4 s) but items arrive unevenly across the corridor instead of
// in lockstep.
const SPAWN_INTERVAL_MEAN_S = 3.5
const SPAWN_INTERVAL_JITTER_S = 1.5
// Desired upstream spawn distance from the platform's flow-axis footprint.
// The system clamps this down per-spawn if the scene bounds don't allow it
// (5x5 demo has tight upstream/downstream room on the corners).
const SPAWN_DISTANCE_MARGIN = 35
// Lateral half-width of the spawn corridor, measured PERPENDICULAR to the
// flow direction. Items sample uniformly in [-LATERAL_HALF_WIDTH,
// +LATERAL_HALF_WIDTH] from the raft centroid, so trajectories can pass
// directly over the raft as well as past either side — no longer a strict
// bypass band. The corridor scales with the platform's perp footprint
// so a 4x2 raft still gets items skirting both edges, not just the centre.
const LATERAL_HALF_WIDTH_MARGIN = 8
// Stagger spawns along the flow axis so consecutive items don't line up
// at the exact same depth.
const UPSTREAM_JITTER_M = 4
// Drift speed in metres/second along the flow direction.
const DRIFT_SPEED = 1.8
const DRIFT_SPEED_JITTER = 0.3
// Margin (metres) inside the parcel boundary that spawn positions must
// respect. Nothing is ever spawned inside this band — ensures items
// always start visibly inside the map. floatingGarbage.ts uses a slightly
// smaller margin so spawned items don't immediately self-despawn.
const MAP_EDGE_SPAWN_MARGIN = 4
// Minimum upstream gap from the raft AABB we still consider workable. If
// the chosen lateral side has less than this much room upstream we flip
// to the other side or skip the slot entirely.
const MIN_UPSTREAM_GAP = 6

// State — module-local because there's only ever one spawner. Initialized
// so the first item fires almost immediately on scene start.
let elapsed = SPAWN_INTERVAL_MEAN_S
let nextInterval = SPAWN_INTERVAL_MEAN_S

function rollNextInterval(): number {
  const jitter = (Math.random() * 2 - 1) * SPAWN_INTERVAL_JITTER_S
  return Math.max(0.5, SPAWN_INTERVAL_MEAN_S + jitter)
}

export function garbageSpawnerSystem(dt: number): void {
  // Suppress while the lobby is up — debris spawned at WATER_LEVEL=4
  // would float in the sky above the lobby raft (which sits at y=0).
  if (isStartupGateActive()) return
  elapsed += dt
  if (elapsed < nextInterval) return
  elapsed = 0
  nextInterval = rollNextInterval()
  spawnOne()
}

function spawnOne(): void {
  const extent = getPlatformExtent()
  // Spawn anchor is the geometric centre of the platform AABB so an
  // asymmetric raft (e.g. 4x2 or L-shape) doesn't bias spawns toward its
  // heavy side.
  const anchorX = (extent.minX + extent.maxX) / 2
  const anchorZ = (extent.minZ + extent.maxZ) / 2
  const flowX = SEA_FLOW_DIR_X
  const flowZ = SEA_FLOW_DIR_Z
  // Right-hand perpendicular on the XZ plane (rotate flow by -90°).
  const perpX = flowZ
  const perpZ = -flowX
  // Half-depth of the platform AABB along each axis. These project the
  // group's actual corners onto the flow / perp directions, so margins
  // below scale with whatever shape the player has built.
  const flowHalf = aabbHalfExtentAlong(extent, flowX, flowZ)
  const perpHalf = aabbHalfExtentAlong(extent, perpX, perpZ)
  // Scene is square, centred on GRID_ORIGIN.
  const sceneSize = GRID_ORIGIN.x * 2

  const desiredSpawnDistance = flowHalf + SPAWN_DISTANCE_MARGIN
  const lateralHalfWidth = perpHalf + LATERAL_HALF_WIDTH_MARGIN

  // Sample one lateral offset across the full corridor — anywhere from
  // dead-centre (passing right over the raft) to the corridor edge. No
  // bypass enforced; items are colliderless so they drift through the
  // raft footprint visually, which is exactly the desired behaviour.
  let lateral = (Math.random() * 2 - 1) * lateralHalfWidth
  let lateralX = anchorX + perpX * lateral
  let lateralZ = anchorZ + perpZ * lateral
  let upstreamMax = maxFlowDistance(lateralX, lateralZ, -flowX, -flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
  let downstreamMax = maxFlowDistance(lateralX, lateralZ, flowX, flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)

  // The chosen lateral puts us in a corner with no upstream room —
  // mirror to the opposite side and retry once before giving up on
  // this tick.
  if (upstreamMax < flowHalf + MIN_UPSTREAM_GAP) {
    lateral = -lateral
    lateralX = anchorX + perpX * lateral
    lateralZ = anchorZ + perpZ * lateral
    upstreamMax = maxFlowDistance(lateralX, lateralZ, -flowX, -flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
    downstreamMax = maxFlowDistance(lateralX, lateralZ, flowX, flowZ, sceneSize, MAP_EDGE_SPAWN_MARGIN)
  }
  if (upstreamMax < flowHalf + MIN_UPSTREAM_GAP) return
  if (downstreamMax < MIN_UPSTREAM_GAP) return

  // Clamp spawn distance into the available upstream room. The item
  // starts at most `upstreamMax` metres along -flow from the lateral
  // anchor — `maxFlowDistance` already bakes in MAP_EDGE_SPAWN_MARGIN.
  const baseSpawnDistance = Math.min(desiredSpawnDistance, upstreamMax)
  const upstreamJitter = (Math.random() * 2 - 1) * UPSTREAM_JITTER_M
  const spawnDistance = clamp(
    baseSpawnDistance + upstreamJitter,
    flowHalf + MIN_UPSTREAM_GAP,
    upstreamMax
  )
  const along = -spawnDistance

  const position = Vector3.create(
    lateralX + flowX * along,
    WATER_LEVEL,
    lateralZ + flowZ * along
  )

  const speed = DRIFT_SPEED + (Math.random() * 2 - 1) * DRIFT_SPEED_JITTER
  const velocity = Vector3.create(flowX * speed, 0, flowZ * speed)

  // Lifetime: time to drift from spawn through the lateral pos and on to
  // the downstream boundary, plus a small safety pad. The drift system
  // also enforces a scene-bounds despawn so this is just an upper cap.
  const totalDistance = spawnDistance + downstreamMax
  const maxLifetime = totalDistance / Math.max(speed, 0.5) + 5

  const kind = pickWeightedKind(GARBAGE_KINDS)

  createFloatingGarbage({
    kind,
    position,
    velocity,
    maxLifetime
  })
}

// Distance along (dirX, dirZ) from (startX, startZ) until the path exits
// [margin, sceneSize-margin] on either axis. (dirX, dirZ) must be a unit
// vector. Returns 0 if already at/past a boundary.
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

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return value < min ? min : value > max ? max : value
}
