import {
  Entity,
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { FloatingGarbage, Hook } from '../components'
import {
  HOOK_FORWARD_ROTATION,
  createHookEntity,
  createRopeEntity,
  hideRope,
  updateRopeBetween
} from '../factories'
import { WATER_LEVEL } from '../factories/sceneLevels'
import {
  actionButtonJustPressed,
  isActionButtonPressed
} from '../ui/actionButton'
import {
  addCollected,
  getSelectedSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'

const HOOK_SLOT = 0

// Initial speed bounds along the aim direction. Charge ramps the throw from
// MIN (instant tap) up to MAX (held two full seconds). Combined with GRAVITY
// the max throw covers ~10–11 m on flat water; min is a short chest-height
// dribble.
const MIN_THROW_SPEED = 6
const MAX_THROW_SPEED = 18
// Hold the pointer for this long to fill the charge bar all the way. At the
// instant the bar fills the throw fires automatically — releasing earlier
// throws at the partial strength.
const CHARGE_DURATION_S = 0.5
// Slightly stronger than real gravity so the arc resolves quickly and reads
// as a "throw" rather than a slow lob.
const GRAVITY = 18
// Constant horizontal speed of the hook while floating back toward the
// player. Tuned so a max-distance throw reels in over ~1.5 s.
const REEL_SPEED = 7
// Despawn when the hook is this close to the player on the XZ plane.
const REEL_DESPAWN_RADIUS_XZ = 1.2
// Safety: if a throw never crosses water level (e.g. player throws into a
// wall), force-transition into floating after this much airtime.
const MAX_FLIGHT_TIME_S = 6
// Lateral (XZ) capture radius around the throw line. Anything within this
// distance of the path on the water surface gets reeled in on splashdown.
// Tuned generous so a "close enough" throw still rewards the player.
const COLLECT_RADIUS_XZ = 1.8

const PHASE_FLYING = 0
const PHASE_FLOATING = 1

// Mid-air wobble. Three independent sine waves on each axis at detuned
// frequencies give an irregular tumble that reads as drag/wind resistance.
// Smaller-than-instinctive amplitudes look right because the heading is
// already snapping toward the player — the wobble is a quiver on top, not
// a tumble.
const SHAKE_AMPLITUDE_DEG = 9
const SHAKE_FREQ = 22

const RAD_TO_DEG = 180 / Math.PI

const CAMERA_FORWARD = Vector3.create(0, 0, 1)
// Player "hand" anchor in camera-local space: slightly below + forward of
// the camera origin so the rope visibly emerges from in front of the chest
// instead of clipping through the camera.
const HAND_OFFSET_LOCAL = Vector3.create(0.25, -0.45, 0.4)

let hookEntity: Entity | null = null
let ropeEntity: Entity | null = null
// XZ origin of the active throw — used to build the swept line segment for
// the splashdown collector. Set in `spawnAndThrow`, cleared on despawn.
let throwStartX = 0
let throwStartZ = 0
// Items attached to the hook between splashdown and despawn. They ride the
// hook back to the player by having their world position copied from the
// hook each frame plus a small offset. We deliberately do NOT use
// Transform.parent because the hook's GLB is rendered at scale 0.35, which
// would multiplicatively shrink any child's world scale. Tracked outside
// of components so we don't need an extra ECS query each frame.
type GrabbedItem = {
  entity: Entity
  kind: string
  offsetX: number
  offsetY: number
  offsetZ: number
}
let grabbedItems: GrabbedItem[] = []
// 0 → 1 charge fraction. Non-zero only while the player is holding the
// pointer with slot 0 selected and no hook in flight. Read by the UI to
// render the charge meter at the crosshair.
let chargeT = 0
let charging = false

export function getThrowChargeT(): number {
  return chargeT
}

export function isHookInFlight(): boolean {
  return hookEntity !== null
}

export function hookThrowerSystem(dt: number): void {
  // Inventory open or just closed: cancel any in-flight charge and skip
  // input handling. The action button is hidden while open, but the click
  // that closed the inventory also fires IA_POINTER, so we keep ignoring
  // input for a brief lockout window after close.
  if (isInventoryActionLocked()) {
    cancelCharge()
    return
  }

  const selected = getSelectedSlot()
  const handPos = computeHandPos()

  if (selected !== HOOK_SLOT) {
    if (hookEntity !== null) despawnHook()
    cancelCharge()
    return
  }

  if (handPos === null) return

  if (hookEntity === null) {
    tickCharge(dt, handPos)
  } else {
    cancelCharge()
    advanceHook(dt, handPos)
  }
}

// Charge state machine: PET_DOWN starts charging; held → bar fills; full
// bar auto-throws; release before full throws at the partial strength. On
// mobile the on-screen action button is the canonical fire input — touches
// elsewhere also fire IA_POINTER but we ignore them so the player can still
// look around with one finger and throw with the other.
function tickCharge(dt: number, handPos: Vector3): void {
  const mobile = isMobile()
  const justPressed = mobile
    ? actionButtonJustPressed()
    : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
  const stillHeld = mobile
    ? isActionButtonPressed()
    : inputSystem.isPressed(InputAction.IA_POINTER)

  if (!charging) {
    // Skip the press that selected this slot — otherwise the equip-click
    // immediately starts a throw charge.
    if (justPressed && !isSelectionPointerLockoutActive()) {
      charging = true
      chargeT = 0
    }
    return
  }

  if (!stillHeld) {
    spawnAndThrow(handPos, chargeT)
    cancelCharge()
    return
  }

  chargeT = Math.min(1, chargeT + dt / CHARGE_DURATION_S)
  if (chargeT >= 1) {
    spawnAndThrow(handPos, 1)
    cancelCharge()
  }
}

function cancelCharge(): void {
  charging = false
  chargeT = 0
}

function spawnAndThrow(handPos: Vector3, strength: number): void {
  const aim = computeAimDir()
  if (aim === null) return
  const speed = MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * strength
  hookEntity = createHookEntity()
  if (ropeEntity === null) ropeEntity = createRopeEntity()
  Hook.create(hookEntity, {
    phase: PHASE_FLYING,
    elapsed: 0,
    velocity: Vector3.create(aim.x * speed, aim.y * speed, aim.z * speed)
  })
  throwStartX = handPos.x
  throwStartZ = handPos.z
  const transform = Transform.getMutable(hookEntity)
  transform.position = Vector3.create(handPos.x, handPos.y, handPos.z)
  // Face the player on the XZ plane (consistent with flight + reeling).
  // The aim direction points away from the player on spawn, so heading
  // toward the player is just `-aim` projected to XZ.
  transform.rotation = composeHeading(-aim.x, 0, -aim.z, 0, 0, 0)
  updateRopeBetween(ropeEntity, handPos, handPos)
}

// Builds the world rotation for the hook: heading × HOOK_FORWARD_ROTATION ×
// wobble. `dx,dy,dz` is the direction the hook is pointing (its velocity
// vector while flying, the reel direction while floating). `wx,wy,wz` are
// per-axis wobble offsets in degrees (zeroed when not flying).
function composeHeading(
  dx: number,
  dy: number,
  dz: number,
  wx: number,
  wy: number,
  wz: number
): Quaternion {
  const horiz = Math.sqrt(dx * dx + dz * dz)
  const yawDeg = Math.atan2(dx, dz) * RAD_TO_DEG
  const pitchDeg = -Math.atan2(dy, horiz) * RAD_TO_DEG
  const heading = Quaternion.fromEulerDegrees(pitchDeg, yawDeg, 0)
  // Mirrors the previously-working `multiply(REST, wobble)` shape: rest
  // pose with wobble layered on the right; the heading is applied on the
  // outside so the wobbling rest-pose tilts to align with the flight vector.
  const headingForward = Quaternion.multiply(heading, HOOK_FORWARD_ROTATION)
  const wobble = Quaternion.fromEulerDegrees(wx, wy, wz)
  return Quaternion.multiply(headingForward, wobble)
}

function advanceHook(dt: number, handPos: Vector3): void {
  if (hookEntity === null) return
  const state = Hook.getMutable(hookEntity)
  state.elapsed += dt

  const transform = Transform.getMutable(hookEntity)
  const pos = transform.position

  if (state.phase === PHASE_FLYING) {
    state.velocity = Vector3.create(
      state.velocity.x,
      state.velocity.y - GRAVITY * dt,
      state.velocity.z
    )
    const nextY = pos.y + state.velocity.y * dt
    if (nextY <= WATER_LEVEL || state.elapsed > MAX_FLIGHT_TIME_S) {
      const nextX = pos.x + state.velocity.x * dt
      const nextZ = pos.z + state.velocity.z * dt
      transform.position = Vector3.create(nextX, WATER_LEVEL, nextZ)
      state.phase = PHASE_FLOATING
      // Splashdown — sweep every floating-garbage entity whose XZ position
      // lies within COLLECT_RADIUS_XZ of the throw's straight-line path
      // (handPos → splash). The XZ projection of a ballistic throw is a
      // straight line because gravity only affects Y, so a single segment
      // captures the whole "path" without any per-frame history.
      collectGarbageAlongPath(throwStartX, throwStartZ, nextX, nextZ)
      // Keep `elapsed` ticking across the phase boundary so the wobble
      // sine waves carry on without a visual reset on splashdown.
      // (Rotation will be set by the FLOATING branch on the next frame.)
    } else {
      const nextX = pos.x + state.velocity.x * dt
      const nextZ = pos.z + state.velocity.z * dt
      transform.position = Vector3.create(nextX, nextY, nextZ)
      // Always face the player (eye toward player, tip trailing away). With
      // the same heading used during reeling, the hook stays oriented
      // consistently from throw release through splash through retrieval.
      // A small detuned-axis wobble layers on top to read as flight drag.
      const t = state.elapsed
      const wx = Math.sin(t * SHAKE_FREQ) * SHAKE_AMPLITUDE_DEG
      const wy =
        Math.sin(t * SHAKE_FREQ * 1.31 + 1.7) * SHAKE_AMPLITUDE_DEG * 0.7
      const wz =
        Math.sin(t * SHAKE_FREQ * 0.79 + 0.5) * SHAKE_AMPLITUDE_DEG * 1.1
      transform.rotation = composeHeading(
        handPos.x - nextX,
        0,
        handPos.z - nextZ,
        wx,
        wy,
        wz
      )
    }
  } else if (state.phase === PHASE_FLOATING) {
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const distXZ = Math.sqrt(dx * dx + dz * dz)
    if (distXZ < REEL_DESPAWN_RADIUS_XZ) {
      despawnHook()
      return
    }
    const step = Math.min(REEL_SPEED * dt, distXZ)
    const nx = dx / distXZ
    const nz = dz / distXZ
    transform.position = Vector3.create(
      pos.x + nx * step,
      WATER_LEVEL,
      pos.z + nz * step
    )
    // Reel direction changes as the player moves; keep the hook visually
    // aimed at the player so the line of action stays readable. Wobble
    // continues — same sine pattern as flight, dialled down so the hook
    // looks like it's bobbing on water rather than fighting wind.
    const t = state.elapsed
    const REEL_WOBBLE_SCALE = 0.45
    const wx =
      Math.sin(t * SHAKE_FREQ) * SHAKE_AMPLITUDE_DEG * REEL_WOBBLE_SCALE
    const wy =
      Math.sin(t * SHAKE_FREQ * 1.31 + 1.7) *
      SHAKE_AMPLITUDE_DEG *
      0.7 *
      REEL_WOBBLE_SCALE
    const wz =
      Math.sin(t * SHAKE_FREQ * 0.79 + 0.5) *
      SHAKE_AMPLITUDE_DEG *
      1.1 *
      REEL_WOBBLE_SCALE
    transform.rotation = composeHeading(dx, 0, dz, wx, wy, wz)
  }

  if (ropeEntity !== null) {
    const hookPos = Transform.get(hookEntity).position
    updateRopeBetween(ropeEntity, handPos, hookPos)
  }

  followGrabbedItems()
}

function despawnHook(): void {
  // Hook reached the player (or the throw was cancelled) — bank everything
  // it was dragging and remove the entities. Done before the hook itself
  // is removed so we don't leave orphaned children behind for one frame.
  for (const item of grabbedItems) {
    addCollected(item.kind, 1)
    engine.removeEntity(item.entity)
  }
  grabbedItems = []
  if (hookEntity !== null) {
    engine.removeEntity(hookEntity)
    hookEntity = null
  }
  if (ropeEntity !== null) hideRope(ropeEntity)
}

// Aim direction with a 45° upward cap. Without the cap, the player can stand
// on a tall raft and aim near-vertical, sailing the hook up and out for a
// long horizontal distance because the tall starting height keeps the
// projectile aloft long enough for even a small XZ velocity to travel far.
// Capping at 45° elevation locks the launch angle at the natural max-range
// sweet spot regardless of how high the camera is pitched.
function computeAimDir(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const forward = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  const MAX_UP_Y = Math.SQRT1_2 // sin(45°)
  if (forward.y <= MAX_UP_Y) return forward
  const horiz = Math.sqrt(forward.x * forward.x + forward.z * forward.z)
  if (horiz < 0.0001) {
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player === null) return null
    const playerFwd = Vector3.rotate(CAMERA_FORWARD, player.rotation as Quaternion)
    return Vector3.create(playerFwd.x * MAX_UP_Y, MAX_UP_Y, playerFwd.z * MAX_UP_Y)
  }
  const scale = MAX_UP_Y / horiz // remap horizontal magnitude to cos(45°)
  return Vector3.create(forward.x * scale, MAX_UP_Y, forward.z * scale)
}

function computeHandPos(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const localOffset = Vector3.rotate(HAND_OFFSET_LOCAL, cam.rotation as Quaternion)
  return Vector3.create(
    cam.position.x + localOffset.x,
    cam.position.y + localOffset.y,
    cam.position.z + localOffset.z
  )
}

// Sweep all FloatingGarbage entities and attach every one whose XZ position
// lies within COLLECT_RADIUS_XZ of the throw's path segment to the hook.
// Items hang off the hook (via Transform.parent) so they ride back to the
// player as the hook reels in; the inventory credit happens in `despawnHook`
// when the hook actually reaches the player.
function collectGarbageAlongPath(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
): void {
  if (hookEntity === null) return
  const radiusSq = COLLECT_RADIUS_XZ * COLLECT_RADIUS_XZ
  for (const [entity] of engine.getEntitiesWith(FloatingGarbage, Transform)) {
    const pos = Transform.get(entity).position
    if (
      distanceSqPointToSegmentXZ(pos.x, pos.z, startX, startZ, endX, endZ) >
      radiusSq
    ) {
      continue
    }
    const kind = FloatingGarbage.get(entity).kind
    // Detach from the drift system — the item is no longer floating; it's
    // hooked. Without this the float system would keep advancing its world
    // position and fight the per-frame follow we apply below.
    FloatingGarbage.deleteFrom(entity)
    const offset = computeGrabOffset(grabbedItems.length)
    grabbedItems.push({
      entity,
      kind,
      offsetX: offset.x,
      offsetY: offset.y,
      offsetZ: offset.z
    })
  }
  // Snap items onto the hook position immediately so they don't show one
  // frame at their old water position before the next advanceHook runs.
  followGrabbedItems()
}

// Cluster offset around the hook in WORLD-space metres, staggered by index
// so multiple items don't overlap perfectly. Kept in world space (not
// parented) because the hook GLB is rendered at scale 0.35 — parenting
// would multiplicatively shrink every grabbed item.
function computeGrabOffset(index: number): { x: number; y: number; z: number } {
  const GOLDEN_ANGLE = 2.39996
  const angle = index * GOLDEN_ANGLE
  const radius = 0.6 + (index % 3) * 0.25
  return {
    x: Math.cos(angle) * radius,
    y: -0.1 - (index % 4) * 0.08,
    z: Math.sin(angle) * radius
  }
}

// Each frame: copy the hook's world position to every grabbed item, plus
// the per-item cluster offset. Rotation and scale are left untouched, so
// each item keeps the look it had while floating.
function followGrabbedItems(): void {
  if (hookEntity === null || grabbedItems.length === 0) return
  const hookPos = Transform.get(hookEntity).position
  for (const item of grabbedItems) {
    const tr = Transform.getMutable(item.entity)
    tr.position = Vector3.create(
      hookPos.x + item.offsetX,
      hookPos.y + item.offsetY,
      hookPos.z + item.offsetZ
    )
  }
}

// Squared distance from (px, pz) to the line segment [(ax, az), (bx, bz)]
// on the XZ plane. Squared because all callers compare against r² — saves
// a sqrt per garbage entity per throw.
function distanceSqPointToSegmentXZ(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  let cx = ax
  let cz = az
  if (lenSq > 1e-6) {
    let t = ((px - ax) * dx + (pz - az) * dz) / lenSq
    if (t < 0) t = 0
    else if (t > 1) t = 1
    cx = ax + t * dx
    cz = az + t * dz
  }
  const ex = px - cx
  const ez = pz - cz
  return ex * ex + ez * ez
}
