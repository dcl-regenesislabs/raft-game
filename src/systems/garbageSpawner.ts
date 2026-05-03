import { Vector3 } from '@dcl/sdk/math'

import {
  GARBAGE_KINDS,
  GarbageKind,
  createFloatingGarbage
} from '../factories/floatingGarbage'
import { GRID_ORIGIN } from '../factories/platform'
import { getPlatformExtent } from '../factories/platformExtent'
import {
  SEA_FLOW_DIR_X,
  SEA_FLOW_DIR_Z,
  WATER_LEVEL
} from '../factories/sceneLevels'

// --- tunables ---
// Seconds between groups.
const SPAWN_INTERVAL_S = 30
// Items per group.
const GROUP_SIZE = 5
// Desired upstream spawn distance from the platform footprint. The system
// clamps this down per-spawn if the scene bounds don't allow it (5x5 demo
// has tight upstream/downstream room on the corners).
const SPAWN_DISTANCE_MARGIN = 35
// Lateral offset band (perpendicular to flow). Items pass between
// `BYPASS_MIN_MARGIN` and `BYPASS_MAX_MARGIN` metres beyond the raft
// footprint — close enough to be hooked from the deck, never on top of it.
const BYPASS_MIN_MARGIN = 3
const BYPASS_MAX_MARGIN = 9
// Stagger the group along the flow axis so the 5 items don't arrive in a
// rigid line.
const UPSTREAM_JITTER_M = 3
// Drift speed in metres/second along the flow direction.
const DRIFT_SPEED = 1.8
const DRIFT_SPEED_JITTER = 0.3
// Margin (metres) inside the scene parcel boundary that spawn positions
// must respect. Items drifting past the downstream boundary self-despawn.
const SCENE_BOUND_MARGIN = 2
// Minimum upstream gap from the raft footprint we still consider workable.
// If the chosen lateral side has less than this much room upstream we flip
// to the other side or skip the slot entirely.
const MIN_UPSTREAM_GAP = 6

// State — module-local because there's only ever one spawner. Initialized
// to SPAWN_INTERVAL_S so the first group fires on the first frame.
let elapsed = SPAWN_INTERVAL_S

export function garbageSpawnerSystem(dt: number): void {
  elapsed += dt
  if (elapsed < SPAWN_INTERVAL_S) return
  elapsed = 0
  spawnGroup()
}

function spawnGroup(): void {
  const { cx, cz, radius } = getPlatformExtent()
  const flowX = SEA_FLOW_DIR_X
  const flowZ = SEA_FLOW_DIR_Z
  // Right-hand perpendicular on the XZ plane (rotate flow by -90°).
  const perpX = flowZ
  const perpZ = -flowX
  // Scene is square, centred on GRID_ORIGIN.
  const sceneSize = GRID_ORIGIN.x * 2

  const desiredSpawnDistance = radius + SPAWN_DISTANCE_MARGIN
  const bypassMin = radius + BYPASS_MIN_MARGIN
  const bypassMax = radius + BYPASS_MAX_MARGIN

  // Barrels are the high-value pickup of the group — cap at one per group
  // so the player never gets a barrel-only haul that trivialises the
  // current 30-second cycle.
  let barrelSpawned = false

  for (let i = 0; i < GROUP_SIZE; i++) {
    let side = Math.random() < 0.5 ? -1 : 1
    let lateral = side * (bypassMin + Math.random() * (bypassMax - bypassMin))
    let lateralX = cx + perpX * lateral
    let lateralZ = cz + perpZ * lateral
    let upstreamMax = maxFlowDistance(lateralX, lateralZ, -flowX, -flowZ, sceneSize, SCENE_BOUND_MARGIN)
    let downstreamMax = maxFlowDistance(lateralX, lateralZ, flowX, flowZ, sceneSize, SCENE_BOUND_MARGIN)

    // The chosen side puts us in a corner with no upstream room — flip to
    // the other lateral side and try again.
    if (upstreamMax < radius + MIN_UPSTREAM_GAP) {
      side = -side
      lateral = side * (bypassMin + Math.random() * (bypassMax - bypassMin))
      lateralX = cx + perpX * lateral
      lateralZ = cz + perpZ * lateral
      upstreamMax = maxFlowDistance(lateralX, lateralZ, -flowX, -flowZ, sceneSize, SCENE_BOUND_MARGIN)
      downstreamMax = maxFlowDistance(lateralX, lateralZ, flowX, flowZ, sceneSize, SCENE_BOUND_MARGIN)
    }
    if (upstreamMax < radius + MIN_UPSTREAM_GAP) continue
    if (downstreamMax < MIN_UPSTREAM_GAP) continue

    // Clamp spawn distance into the available upstream room. The item will
    // start at most upstreamMax-2 metres along -flow from lateralPos.
    const upstreamCap = Math.max(0, upstreamMax - SCENE_BOUND_MARGIN)
    const baseSpawnDistance = Math.min(desiredSpawnDistance, upstreamCap)
    const upstreamJitter = (Math.random() * 2 - 1) * UPSTREAM_JITTER_M
    const spawnDistance = clamp(
      baseSpawnDistance + upstreamJitter,
      radius + MIN_UPSTREAM_GAP,
      upstreamCap
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
    const totalDistance = spawnDistance + Math.max(0, downstreamMax - SCENE_BOUND_MARGIN)
    const maxLifetime = totalDistance / Math.max(speed, 0.5) + 5

    const pool: readonly GarbageKind[] = barrelSpawned
      ? GARBAGE_KINDS.filter((k) => k !== 'barrel')
      : GARBAGE_KINDS
    const kind: GarbageKind = pool[Math.floor(Math.random() * pool.length)]
    if (kind === 'barrel') barrelSpawned = true

    createFloatingGarbage({
      kind,
      position,
      velocity,
      maxLifetime
    })
  }
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
