import {
  Entity,
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { ChefNpc, Platform } from '../components'
import {
  BOAT_Y_OFFSET,
  BoatChefHandles,
  boatYawForVelocity,
  setBoatChefPose,
  spawnBoatChefVisitor
} from '../factories/boat'
import {
  CHEF_BIG_WAVE_HELLO_CLIP,
  CHEF_CELEBRATING_CLIP,
  CHEF_IFEELYOUBRO_CLIP,
  CHEF_SITTING_IDLE_CLIP,
  CHEF_THANKS_CLIP,
  CHEF_THINKING_CLIP
} from '../factories/chef'
import { PLATFORM_SIZE_X, PLATFORM_SIZE_Z } from '../factories/platform'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { NEIGHBOUR_DELTAS } from './raft/shared'
import { setSharkAttacksSuppressed } from './sharkDirector'
import { getCollectedCount } from '../ui/inventoryState'
import {
  BOAT_CHEF_NO_TIER4_DIALOG_LINES,
  BOAT_CHEF_TIER4_DIALOG_LINES
} from './chefDialog'

// Boat-chef visitor event director. One singleton state machine
// (module-level — same pattern as `sharkDirector.ts`) that owns the
// recurring scripted encounter:
//
//   ARMED       — counting down to the next visit (immediate in DEBUG).
//   ARRIVING    — boat sailing from the spawn point to the dock point;
//                 chef stands and waves.
//   DOCKING     — boat reached the dock; a 1.5 s settle window between
//                 motion stopping and WAITING starting. The bow stays
//                 pointed at the raft so the chef faces the player
//                 head-on; the slerp is currently a hold (dockYaw =
//                 arrivalYaw), kept as a phase so the cadence
//                 "arrive → settle → wait" reads clearly.
//   WAITING     — boat parked, chef sits. 30 s click window. Bubble
//                 already shows the welcome line (visible from arrival).
//   INTERACTING — player clicked the chef. Script swapped to TIER4 or
//                 NO_TIER4 based on inventory; chef plays the matching
//                 stand-up clip. Dialog advances on each subsequent
//                 click via the regular `chefDialogSystem`.
//   LINGER      — dialog completed; chef plays the thanks clip while
//                 the boat sits perfectly still for 5 s. The thanks
//                 moment reads as a self-contained beat — no rotation
//                 or translation happens until LEAVING begins.
//   LEAVING     — boat sails outward past the despawn radius, then we
//                 destroy every entity and re-arm.
//
// The system MUST be registered before `chefDialogSystem` in
// `src/index.ts`. On the WAITING → INTERACTING transition, both systems
// observe the same click frame; the director must run first so it can
// swap `ChefNpc.dialogLines` + reset `dialogLineIndex = -1` before
// `chefDialogSystem`'s `(idx + 1) % stateCount` lands on 0 to show the
// new script's first line.

// --- constants ---

const VISIT_INTERVAL_S = 600 // 10 minutes between visits
const TRAVEL_SPEED = 2 // m/s — gentle rowing pace
// Metres beyond the centroid-to-farthest-platform-centre radius.
// 3 m sits the bow just off the deck edge for a 1-platform raft
// (platform half-extent ~1.5 m + ~1.5 m breathing room).
const DOCK_GAP = 3
const SPAWN_GAP = 40 // far horizon for arrival
const DESPAWN_GAP = 60 // beyond spawn — boat sails out the same way it came
const ARRIVE_THRESHOLD = 0.5 // metres — snap to target inside this radius
const DOCKING_DURATION_S = 1.5 // seconds to slerp from bow-in to broadside
const WAITING_TIMEOUT_S = 30
const LINGER_AFTER_DIALOG_S = 5

type Phase =
  | 'ARMED'
  | 'ARRIVING'
  | 'DOCKING'
  | 'WAITING'
  | 'INTERACTING'
  | 'LINGER'
  | 'LEAVING'

interface DockGeometry {
  dock: Vector3
  spawn: Vector3
  despawn: Vector3
  // Heading the boat travels along while approaching the dock (bow
  // pointing at the centroid).
  arrivalYawDeg: number
  // Heading the boat holds while parked — bow still pointing at the
  // raft centroid (same as arrivalYaw) so the chef faces the player
  // head-on across the deck. Slerp from arrivalYaw to dockYaw during
  // DOCKING is a hold today, but the field exists so future tuning
  // can introduce a small settle rotation without re-plumbing.
  dockYawDeg: number
  // Heading the boat takes once it pulls away from the dock — bow
  // pointing outward, opposite the arrival direction.
  departureYawDeg: number
}

// --- module state ---

let phase: Phase = 'ARMED'
let elapsedInPhase = 0
// Seconds until the next ARMED → ARRIVING transition. -1 means
// "disarmed" (BACK TO LOBBY / fresh boot). 0 fires on the next tick.
let rearmCountdown = -1
let visitor: BoatChefHandles | null = null
let geometry: DockGeometry | null = null

// --- public API ---

// Called once per game-world build. `immediate: true` (DEBUG / SKIP_LOBBY)
// fires the event on the next tick; otherwise it waits the full visit
// interval before sailing the boat in.
export function armBoatChefEvent(opts: { immediate: boolean }): void {
  if (phase !== 'ARMED' || visitor !== null) return
  rearmCountdown = opts.immediate ? 0 : VISIT_INTERVAL_S
}

// True while the chef boat is anywhere in the scene (arriving, docked,
// leaving). The island spawner gates on this so both events don't overlap.
export function isBoatChefActive(): boolean {
  return phase !== 'ARMED'
}

// Called from `returnToLobby` after the entity sweep. The sweep already
// destroyed any active boat/chef entities, so we just clear the module
// refs and disarm — the next `armBoatChefEvent` rearms.
export function resetBoatChefEventState(): void {
  phase = 'ARMED'
  elapsedInPhase = 0
  rearmCountdown = -1
  visitor = null
  geometry = null
  // BACK TO LOBBY may fire mid-visit; restore the shark trigger so the
  // next game-world build starts with a clean default.
  setSharkAttacksSuppressed(false)
}

// --- system ---

export function boatChefDirectorSystem(dt: number): void {
  elapsedInPhase += dt
  switch (phase) {
    case 'ARMED':
      tickArmed(dt)
      return
    case 'ARRIVING':
      tickArriving(dt)
      return
    case 'DOCKING':
      tickDocking()
      return
    case 'WAITING':
      tickWaiting()
      return
    case 'INTERACTING':
      tickInteracting()
      return
    case 'LINGER':
      tickLinger()
      return
    case 'LEAVING':
      tickLeaving(dt)
      return
  }
}

// --- phase ticks ---

function tickArmed(dt: number): void {
  if (rearmCountdown < 0) return
  rearmCountdown -= dt
  if (rearmCountdown > 0) return
  const g = computeDockGeometry()
  if (g === null) {
    // No platforms yet (e.g. lobby still loading) — check again shortly.
    rearmCountdown = 1
    return
  }
  geometry = g
  visitor = spawnBoatChefVisitor({
    spawnPosition: g.spawn,
    yawDeg: g.arrivalYawDeg,
    initialClip: CHEF_BIG_WAVE_HELLO_CLIP
  })
  // Pause the shark attack trigger for the duration of the visit —
  // sharks already patrolling keep orbiting, and any mid-bite shark
  // finishes its cycle; only new attacks are gated. The shark
  // schedule clock continues to accumulate underneath so a bite can
  // fire immediately once the boat is gone (per user intent: "don't
  // reset the timer, just ignore").
  setSharkAttacksSuppressed(true)
  phase = 'ARRIVING'
  elapsedInPhase = 0
}

function tickArriving(dt: number): void {
  if (visitor === null || geometry === null) {
    abort()
    return
  }
  const reached = moveBoatToward(visitor.boat, geometry.dock, dt)
  if (reached) {
    // Chef shifts to the thinking pose the moment the boat is parked
    // — reads as "I'm here, waiting for you to come over". The
    // DOCKING settle window follows before WAITING begins counting
    // down the 30 s interaction timer.
    setBoatChefPose(visitor.chef, CHEF_THINKING_CLIP)
    phase = 'DOCKING'
    elapsedInPhase = 0
  }
}

function tickDocking(): void {
  if (visitor === null || geometry === null) {
    abort()
    return
  }
  // Slerp from bow-toward-raft (arrival heading) to bow-along-raft-edge
  // (dock heading) over DOCKING_DURATION_S, holding position. Avoids a
  // visible snap on the WAITING entry.
  const progress = Math.min(1, elapsedInPhase / DOCKING_DURATION_S)
  const startRot = Quaternion.fromEulerDegrees(0, geometry.arrivalYawDeg, 0)
  const endRot = Quaternion.fromEulerDegrees(0, geometry.dockYawDeg, 0)
  const t = Transform.getMutable(visitor.boat)
  t.rotation = Quaternion.slerp(startRot, endRot, progress)
  if (progress >= 1) {
    phase = 'WAITING'
    elapsedInPhase = 0
  }
}

function tickWaiting(): void {
  if (visitor === null) {
    abort()
    return
  }
  const clicked = inputSystem.isTriggered(
    InputAction.IA_PRIMARY,
    PointerEventType.PET_DOWN,
    visitor.clickEntity
  )
  if (clicked) {
    enterInteracting()
    return
  }
  if (elapsedInPhase >= WAITING_TIMEOUT_S) {
    enterLeaving()
  }
}

function tickInteracting(): void {
  if (visitor === null) {
    abort()
    return
  }
  const chefState = ChefNpc.get(visitor.chef)
  // `chefDialogSystem` advances `dialogLineIndex` to `dialogLines.length`
  // (the hidden state) on the click past the final line. When we see
  // that, the dialog has played out — let the chef wave goodbye and
  // start the departure.
  if (chefState.dialogLineIndex >= chefState.dialogLines.length) {
    setBoatChefPose(visitor.chef, CHEF_THANKS_CLIP)
    phase = 'LINGER'
    elapsedInPhase = 0
  }
}

function tickLinger(): void {
  if (visitor === null) {
    abort()
    return
  }
  // Boat stays planted with the bow still pointing at the raft so the
  // thanks clip reads as a clean closing beat. The 180° U-turn now
  // happens at the start of LEAVING (moveBoatToward re-derives yaw
  // from velocity each frame), accepted as a quick pivot since the
  // dialog is already over.
  if (elapsedInPhase >= LINGER_AFTER_DIALOG_S) enterLeaving()
}

function tickLeaving(dt: number): void {
  if (visitor === null || geometry === null) {
    abort()
    return
  }
  const reached = moveBoatToward(visitor.boat, geometry.despawn, dt)
  if (reached) {
    despawnVisitor()
    rearmCountdown = VISIT_INTERVAL_S
  }
}

// --- transitions ---

function enterInteracting(): void {
  if (visitor === null) return
  const hasTier4 =
    getCollectedCount('spaghetti_alle_vongole') > 0 ||
    getCollectedCount('fettuccine_sea_hunter') > 0
  const script = hasTier4
    ? BOAT_CHEF_TIER4_DIALOG_LINES
    : BOAT_CHEF_NO_TIER4_DIALOG_LINES
  const chefState = ChefNpc.getMutable(visitor.chef)
  chefState.dialogLines = [...script]
  // -1 so that `chefDialogSystem`'s `(idx + 1) % stateCount` on this
  // same frame lands on 0, showing the new script's first line. Both
  // systems see the same click; the director MUST run first (see the
  // header comment).
  chefState.dialogLineIndex = -1
  // Tier-4 path celebrates; the no-tier-4 path uses the empathetic
  // "I feel you, bro" gesture — pairs better with the "no plate yet,
  // my friend" dialog than the standing-still thinking clip we now
  // use for WAITING.
  setBoatChefPose(
    visitor.chef,
    hasTier4 ? CHEF_CELEBRATING_CLIP : CHEF_IFEELYOUBRO_CLIP
  )
  phase = 'INTERACTING'
  elapsedInPhase = 0
}

function enterLeaving(): void {
  if (visitor === null) return
  setBoatChefPose(visitor.chef, CHEF_SITTING_IDLE_CLIP)
  phase = 'LEAVING'
  elapsedInPhase = 0
}

function abort(): void {
  // Defensive fallback if any phase tick lost its visitor/geometry
  // reference — wipe state and re-arm so the next interval restarts
  // the event cleanly instead of stranding the machine.
  despawnVisitor()
  rearmCountdown = VISIT_INTERVAL_S
}

function despawnVisitor(): void {
  if (visitor !== null) {
    engine.removeEntity(visitor.boat)
    engine.removeEntity(visitor.chef)
    engine.removeEntity(visitor.clickEntity)
    engine.removeEntity(visitor.dialogBubbleEntity)
    engine.removeEntity(visitor.dialogTextEntity)
    visitor = null
  }
  geometry = null
  phase = 'ARMED'
  elapsedInPhase = 0
  // Hand the shark director its trigger back; if its schedule clock is
  // already past the interval an attack will fire on the next tick.
  setSharkAttacksSuppressed(false)
}

// --- geometry + motion ---

// Mirrors the shark director's "approach the most exposed platform"
// pattern (sharkDirector.ts:selectAttack / biteAnchorFor):
//   1. Score every platform by its 4-connected neighbour count.
//   2. Filter to the most-exposed tier (fewest neighbours).
//   3. Random pick within that tier — keeps successive visits varied.
//   4. From that platform, pick a random cardinal side with NO
//      neighbour in that direction (i.e. an outward-facing edge).
//   5. Dock perpendicular to that edge at PLATFORM_HALF + DOCK_GAP.
//
// The arrival heading is INWARD (bow toward the platform centre); the
// departure heading is back OUTWARD, so the boat U-turns at the dock
// during LINGER. Returns null when no platforms exist yet (game world
// still loading) — the caller re-tries in a second.
interface PlatformCandidate {
  entity: Entity
  pos: { x: number; z: number }
  gridX: number
  gridZ: number
  freeSides: ReadonlyArray<readonly [number, number]>
}

function computeDockGeometry(): DockGeometry | null {
  const occupied = new Set<string>()
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    const p = Platform.get(entity)
    occupied.add(`${p.gridX},${p.gridZ}`)
  }
  const candidates: PlatformCandidate[] = []
  for (const [entity] of engine.getEntitiesWith(Platform, Transform)) {
    const p = Platform.get(entity)
    const free: Array<readonly [number, number]> = []
    for (const [dx, dz] of NEIGHBOUR_DELTAS) {
      if (!occupied.has(`${p.gridX + dx},${p.gridZ + dz}`)) free.push([dx, dz])
    }
    // A platform fully surrounded by neighbours has no outward face
    // for the boat to dock against — skip it.
    if (free.length === 0) continue
    const pos = Transform.get(entity).position
    candidates.push({
      entity,
      pos: { x: pos.x, z: pos.z },
      gridX: p.gridX,
      gridZ: p.gridZ,
      freeSides: free
    })
  }
  if (candidates.length === 0) return null

  // Most exposed tier first — fewest occupied neighbours = highest free count.
  let maxFree = 0
  for (const c of candidates) if (c.freeSides.length > maxFree) maxFree = c.freeSides.length
  const exposed = candidates.filter((c) => c.freeSides.length === maxFree)
  const target = exposed[Math.floor(Math.random() * exposed.length)]
  const side = target.freeSides[Math.floor(Math.random() * target.freeSides.length)]

  // The cardinal side is in grid units; convert to a unit world vector
  // and use the per-axis platform half-extent for the edge offset (so
  // a future non-square footprint still parks the boat at the right
  // distance per face).
  const sideX = side[0]
  const sideZ = side[1]
  const halfX = PLATFORM_SIZE_X / 2
  const halfZ = PLATFORM_SIZE_Z / 2
  const edgeOffset = sideX !== 0 ? halfX : halfZ
  const y = WATER_LEVEL + BOAT_Y_OFFSET

  const dockX = target.pos.x + sideX * (edgeOffset + DOCK_GAP)
  const dockZ = target.pos.z + sideZ * (edgeOffset + DOCK_GAP)
  const spawnX = target.pos.x + sideX * (edgeOffset + SPAWN_GAP)
  const spawnZ = target.pos.z + sideZ * (edgeOffset + SPAWN_GAP)
  const despawnX = target.pos.x + sideX * (edgeOffset + DESPAWN_GAP)
  const despawnZ = target.pos.z + sideZ * (edgeOffset + DESPAWN_GAP)

  const arrivalYawDeg = boatYawForVelocity(dockX - spawnX, dockZ - spawnZ)
  return {
    dock: Vector3.create(dockX, y, dockZ),
    spawn: Vector3.create(spawnX, y, spawnZ),
    despawn: Vector3.create(despawnX, y, despawnZ),
    arrivalYawDeg,
    // Keep the bow pointing at the raft once parked — chef sits at
    // the back of the boat facing the bow, so this orients the chef
    // toward the player on the deck. No rotation through DOCKING.
    dockYawDeg: arrivalYawDeg,
    departureYawDeg: boatYawForVelocity(despawnX - dockX, despawnZ - dockZ)
  }
}

// Constant-speed XZ-plane motion toward a target. Returns true once
// the boat is within `ARRIVE_THRESHOLD` of the target (snapped to it).
// Yaw is re-derived from the step vector each frame so the bow always
// points along the direction of travel.
function moveBoatToward(boat: Entity, target: Vector3, dt: number): boolean {
  const t = Transform.getMutable(boat)
  const dx = target.x - t.position.x
  const dz = target.z - t.position.z
  const distSq = dx * dx + dz * dz
  if (distSq <= ARRIVE_THRESHOLD * ARRIVE_THRESHOLD) {
    t.position = Vector3.create(target.x, t.position.y, target.z)
    return true
  }
  const dist = Math.sqrt(distSq)
  const step = Math.min(dist, TRAVEL_SPEED * dt)
  const nx = t.position.x + (dx / dist) * step
  const nz = t.position.z + (dz / dist) * step
  t.position = Vector3.create(nx, t.position.y, nz)
  t.rotation = Quaternion.fromEulerDegrees(0, boatYawForVelocity(dx, dz), 0)
  return false
}
