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

import {
  HOOK_CHARGE_DURATION_S,
  HOOK_COLLECT_RADIUS_XZ,
  HOOK_GRAVITY,
  HOOK_MAX_FLIGHT_TIME_S,
  HOOK_MAX_THROW_SPEED,
  HOOK_MIN_THROW_SPEED,
  HOOK_REEL_DESPAWN_RADIUS_XZ,
  HOOK_REEL_SPEED,
  HOOK_REEL_WOBBLE_SCALE,
  HOOK_WOBBLE_AMPLITUDE_DEG,
  HOOK_WOBBLE_FREQ
} from '../config/gameConfig'
import { FloatingGarbage, Hook, HookPhase } from '../components'
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
import { isPointerLocked } from '../ui/cursorLock'
import {
  addCollected,
  getSelectedSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { RAD_TO_DEG, randInt } from '../utils/math'
import { computeWobble } from '../utils/wobble'

const HOOK_SLOT = 0

const CAMERA_FORWARD = Vector3.create(0, 0, 1)
// Player "hand" anchor in camera-local space: slightly below + forward of
// the camera origin so the rope visibly emerges from in front of the chest
// instead of clipping through the camera.
const HAND_OFFSET_LOCAL = Vector3.create(0.25, -0.45, 0.4)

let hookEntity: Entity | null = null
let ropeEntity: Entity | null = null
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
  const locked = isInventoryActionLocked()
  const handPos = computeHandPos()

  // If a hook is already in flight (flying or reeling with grabbed items),
  // let it finish even when the menu opens — opening the inventory should
  // conclude the action, not freeze the rope mid-air with items dangling.
  if (hookEntity !== null) {
    cancelCharge()
    if (handPos === null) return
    advanceHook(dt, handPos)
    return
  }

  // No hook in flight: gate fresh charge input on inventory state. The
  // action button is hidden while open, but the click that closed the
  // inventory also fires IA_POINTER, so we keep ignoring input for a brief
  // lockout window after close. On desktop, also require the pointer to be
  // captured — without this, a charge that's mid-fill when the player hits
  // Esc would auto-release on the next stillHeld=false read and throw the
  // hook against the player's intent.
  if (locked) {
    cancelCharge()
    return
  }
  if (!isMobile() && !isPointerLocked()) {
    cancelCharge()
    return
  }

  if (getSelectedSlot() !== HOOK_SLOT) {
    cancelCharge()
    return
  }

  if (handPos === null) return
  tickCharge(dt, handPos)
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

  chargeT = Math.min(1, chargeT + dt / HOOK_CHARGE_DURATION_S)
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
  const speed =
    HOOK_MIN_THROW_SPEED + (HOOK_MAX_THROW_SPEED - HOOK_MIN_THROW_SPEED) * strength
  hookEntity = createHookEntity()
  if (ropeEntity === null) ropeEntity = createRopeEntity()
  Hook.create(hookEntity, {
    phase: HookPhase.Flying,
    elapsed: 0,
    velocity: Vector3.create(aim.x * speed, aim.y * speed, aim.z * speed)
  })
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

  if (state.phase === HookPhase.Flying) {
    state.velocity = Vector3.create(
      state.velocity.x,
      state.velocity.y - HOOK_GRAVITY * dt,
      state.velocity.z
    )
    const nextY = pos.y + state.velocity.y * dt
    if (nextY <= WATER_LEVEL || state.elapsed > HOOK_MAX_FLIGHT_TIME_S) {
      const nextX = pos.x + state.velocity.x * dt
      const nextZ = pos.z + state.velocity.z * dt
      transform.position = Vector3.create(nextX, WATER_LEVEL, nextZ)
      state.phase = HookPhase.Floating
      // Splashdown — snag any floating garbage already within reach. Anything
      // further out gets a chance every frame as the hook reels in (below),
      // so the throw plays as a moving capture rather than a one-shot sweep.
      collectGarbageNearHook(nextX, nextZ)
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
      const w = computeWobble(
        state.elapsed,
        HOOK_WOBBLE_FREQ,
        HOOK_WOBBLE_AMPLITUDE_DEG
      )
      transform.rotation = composeHeading(
        handPos.x - nextX,
        0,
        handPos.z - nextZ,
        w.x,
        w.y,
        w.z
      )
    }
  } else if (state.phase === HookPhase.Floating) {
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const distXZ = Math.sqrt(dx * dx + dz * dz)
    if (distXZ < HOOK_REEL_DESPAWN_RADIUS_XZ) {
      despawnHook()
      return
    }
    const step = Math.min(HOOK_REEL_SPEED * dt, distXZ)
    const nx = dx / distXZ
    const nz = dz / distXZ
    const reeledX = pos.x + nx * step
    const reeledZ = pos.z + nz * step
    transform.position = Vector3.create(reeledX, WATER_LEVEL, reeledZ)
    // Snag any floating garbage that drifted (or got reeled) into reach this
    // frame. Items collected mid-reel join the cluster and ride home with
    // the rest, so the hook keeps "fishing" for the entire trip back.
    collectGarbageNearHook(reeledX, reeledZ)
    // Reel direction changes as the player moves; keep the hook visually
    // aimed at the player so the line of action stays readable. Wobble
    // continues — same sine pattern as flight, dialled down so the hook
    // looks like it's bobbing on water rather than fighting wind.
    const w = computeWobble(
      state.elapsed,
      HOOK_WOBBLE_FREQ,
      HOOK_WOBBLE_AMPLITUDE_DEG,
      HOOK_REEL_WOBBLE_SCALE
    )
    transform.rotation = composeHeading(dx, 0, dz, w.x, w.y, w.z)
  }

  if (ropeEntity !== null) {
    const hookPos = Transform.get(hookEntity).position
    updateRopeBetween(ropeEntity, handPos, hookPos)
  }

  followGrabbedItems()
}

// Translate a hooked debris kind into inventory deposits. Most kinds map
// 1:1 to a material, but barrels are a "loot box" that breaks open into a
// random mix of crafting materials so they feel distinct from a plain log.
function bankGrabbedItem(kind: string): void {
  if (kind === 'barrel') {
    addCollected('wood', randInt(0, 1))
    addCollected('plants', randInt(0, 2))
    addCollected('plastic', randInt(0, 1))
    addCollected('rope', randInt(0, 1))
    return
  }
  addCollected(kind, 1)
}

function despawnHook(): void {
  // Hook reached the player (or the throw was cancelled) — bank everything
  // it was dragging and remove the entities. Done before the hook itself
  // is removed so we don't leave orphaned children behind for one frame.
  for (const item of grabbedItems) {
    bankGrabbedItem(item.kind)
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

// Attach every FloatingGarbage entity within HOOK_COLLECT_RADIUS_XZ of the
// hook's current XZ position. Called on splashdown and again every reel
// frame, so the hook keeps catching items as it slides home rather than
// only the ones it landed on. Inventory credit is deferred to `despawnHook`.
function collectGarbageNearHook(hookX: number, hookZ: number): void {
  if (hookEntity === null) return
  const radiusSq = HOOK_COLLECT_RADIUS_XZ * HOOK_COLLECT_RADIUS_XZ
  let collectedAny = false
  for (const [entity] of engine.getEntitiesWith(FloatingGarbage, Transform)) {
    const pos = Transform.get(entity).position
    const ex = pos.x - hookX
    const ez = pos.z - hookZ
    if (ex * ex + ez * ez > radiusSq) continue
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
    collectedAny = true
  }
  // Snap newly-grabbed items onto the hook so they don't render one frame
  // at their old water position. Skip when nothing was added — the regular
  // followGrabbedItems pass at the end of advanceHook covers prior items.
  if (collectedAny) followGrabbedItems()
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

