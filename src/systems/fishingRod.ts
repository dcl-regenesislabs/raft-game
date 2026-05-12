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
  FISH_BITE_DELAY_MAX_S,
  FISH_BITE_DELAY_MIN_S,
  FISH_BITE_PULSE_HZ,
  FISH_REACT_WINDOW_S,
  HOOK_CHARGE_DURATION_S,
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
import { FishingLine, FishingPhase } from '../components'
import {
  HOOK_FORWARD_ROTATION,
  createFishingCatchSprite,
  createFishingWarningSprite,
  createHookEntity,
  createRopeEntity,
  destroyFishingCatchSprite,
  destroyFishingWarningSprite,
  hideRope,
  setFishingWarningVisible,
  updateFishingCatchSprite,
  updateFishingWarningSprite,
  updateRopeBetween
} from '../factories'
import { Platform } from '../components'
import { GRID_ORIGIN, RAFT_SIZE } from '../factories'
import { getItem } from '../ui/items'
import { WATER_LEVEL } from '../factories/sceneLevels'
import {
  actionButtonJustPressed,
  isActionButtonPressed
} from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import {
  addCollected,
  getSelectedSlot,
  getSlotItem,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isHookInFlight } from './hookThrower'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { RAD_TO_DEG } from '../utils/math'
import { computeWobble } from '../utils/wobble'

// Fishing-rod gameplay system. Mirrors the hook thrower (cast → flight
// → splashdown) but the line stays floating until the player explicitly
// retracts it. After a random idle delay a fish bites; the player has
// FISH_REACT_WINDOW_S to press the action button (mobile) or fire
// (desktop) to land the catch. Missing the window re-rolls the next
// bite without retracting.

const ROD_ITEM_ID = 'fishingRod'
const FISH_POOL = ['sardines', 'squid', 'crab'] as const

const LINE_THICKNESS = 0.008
const CAMERA_FORWARD = Vector3.create(0, 0, 1)
const HAND_OFFSET_LOCAL = Vector3.create(0.25, 0.25, 0.4)
// Anchor while reeling: centered on screen, slightly below crosshair
const HAND_OFFSET_REEL = Vector3.create(0.18, -0.15, 0.75)

let lineEntity: Entity | null = null
let ropeEntity: Entity | null = null
let warningEntity: Entity | null = null
// Blink clock for the in-world warning sprite. Runs while a fish is
// biting; reset when the line despawns or leaves the bite phase.
let warningBlinkT = 0
// Frequency of the on/off blink — 4 Hz = visible 4 times per second.
const WARNING_BLINK_HZ = 4
// 3D billboard sprites of the freshly-caught items, hung on the hook
// so the player sees what they reeled in as the line travels home.
// Cleared at despawn (catch reaches the player) or on missed retract.
let catchSprites: Entity[] = []
// 0 → 1 charge fraction. Non-zero only while the player is charging the
// next cast (no line in flight). Read by the UI to render the same
// charge meter the hook uses, so the visual is shared.
let chargeT = 0
let charging = false
// Sine clock used for the screaming-bite pulse. Driven from the line's
// reactElapsed so the pulse only animates while a fish is biting.
let biteIntensity = 0

export function getFishingChargeT(): number {
  return chargeT
}

export function isFishingLineActive(): boolean {
  return lineEntity !== null
}

export function isFishingLineReeling(): boolean {
  if (lineEntity === null) return false
  return FishingLine.get(lineEntity).phase === FishingPhase.Reeling
}

// Drops every cached entity reference without removing the entities —
// the BACK TO LOBBY sweep is what actually destroys them. Mirrors
// `resetHookThrowerState` so the post-sweep view of the world stays
// internally consistent.
export function resetFishingRodState(): void {
  lineEntity = null
  ropeEntity = null
  warningEntity = null
  warningBlinkT = 0
  catchSprites = []
  chargeT = 0
  charging = false
  biteIntensity = 0
}

// 0..1 sine pulse exposed to the UI. Non-zero only while a fish is
// biting; the action button reads this each render to drive the
// "scream" animation (scale + texture flash).
export function getFishingBiteIntensity(): number {
  return biteIntensity
}

// True only while the line is actively in the Biting phase. The UI
// uses this for the brighter texture / color flash; the regular pulse
// scale animation is gated on `getFishingBiteIntensity` directly.
export function isFishingBiting(): boolean {
  if (lineEntity === null) return false
  return FishingLine.get(lineEntity).phase === FishingPhase.Biting
}

export function fishingRodSystem(dt: number): void {
  const locked = isInventoryActionLocked()

  // Force-retract the moment the player switches off the rod slot —
  // we don't want an orphaned line floating while the hammer / spear
  // is equipped. Idle/Biting stages can transition to Reeling cleanly;
  // Flying gets converted on splashdown anyway, so leave that alone.
  if (lineEntity !== null && !rodEquipped()) {
    const phase = FishingLine.get(lineEntity).phase
    if (phase === FishingPhase.Idle || phase === FishingPhase.Biting) {
      const state = FishingLine.getMutable(lineEntity)
      state.phase = FishingPhase.Reeling
      biteIntensity = 0
    }
  }

  if (lineEntity !== null) {
    cancelCharge()
    const phase = FishingLine.get(lineEntity).phase
    const offset = phase === FishingPhase.Reeling ? HAND_OFFSET_REEL : HAND_OFFSET_LOCAL
    const handPos = computeHandPos(offset)
    if (handPos === null) return
    advanceLine(dt, handPos)
    return
  }

  // No line in flight — same charge gating as the hook thrower.
  if (locked) {
    cancelCharge()
    return
  }
  if (!isMobile() && !isPointerLocked()) {
    cancelCharge()
    return
  }
  if (!rodEquipped()) {
    cancelCharge()
    return
  }

  if (isHookInFlight()) {
    cancelCharge()
    return
  }

  const handPos = computeHandPos(HAND_OFFSET_LOCAL)
  if (handPos === null) return
  tickCharge(dt, handPos)
}

function rodEquipped(): boolean {
  return getSlotItem(getSelectedSlot())?.id === ROD_ITEM_ID
}

function tickCharge(dt: number, handPos: Vector3): void {
  const mobile = isMobile()
  const justPressed = mobile
    ? actionButtonJustPressed()
    : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
  const stillHeld = mobile
    ? isActionButtonPressed()
    : inputSystem.isPressed(InputAction.IA_POINTER)

  if (!charging) {
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
  lineEntity = createHookEntity()
  if (ropeEntity === null) ropeEntity = createRopeEntity()
  if (warningEntity === null) warningEntity = createFishingWarningSprite()
  FishingLine.create(lineEntity, {
    phase: FishingPhase.Flying,
    elapsed: 0,
    velocity: Vector3.create(aim.x * speed, aim.y * speed, aim.z * speed),
    idleElapsed: 0,
    nextBiteIn: rollBiteDelay(),
    reactElapsed: 0
  })
  const transform = Transform.getMutable(lineEntity)
  transform.position = Vector3.create(handPos.x, handPos.y, handPos.z)
  transform.rotation = composeHeading(-aim.x, 0, -aim.z, 0, 0, 0)
  updateRopeBetween(ropeEntity, handPos, handPos, LINE_THICKNESS)
}

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
  const headingForward = Quaternion.multiply(heading, HOOK_FORWARD_ROTATION)
  const wobble = Quaternion.fromEulerDegrees(wx, wy, wz)
  return Quaternion.multiply(headingForward, wobble)
}

function advanceLine(dt: number, handPos: Vector3): void {
  if (lineEntity === null) return
  const state = FishingLine.getMutable(lineEntity)
  state.elapsed += dt

  const transform = Transform.getMutable(lineEntity)
  const pos = transform.position

  if (state.phase === FishingPhase.Flying) {
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
      if (isOnRaft(nextX, nextZ)) {
        state.phase = FishingPhase.Reeling
      } else {
        state.phase = FishingPhase.Idle
        state.idleElapsed = 0
        state.reactElapsed = 0
      }
    } else {
      const nextX = pos.x + state.velocity.x * dt
      const nextZ = pos.z + state.velocity.z * dt
      transform.position = Vector3.create(nextX, nextY, nextZ)
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
  } else if (state.phase === FishingPhase.Idle) {
    biteIntensity = 0
    state.idleElapsed += dt
    transform.position = Vector3.create(pos.x, WATER_LEVEL, pos.z)
    // Aim back at the player; gentle bob wobble while floating.
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const w = computeWobble(
      state.elapsed,
      HOOK_WOBBLE_FREQ,
      HOOK_WOBBLE_AMPLITUDE_DEG,
      HOOK_REEL_WOBBLE_SCALE
    )
    transform.rotation = composeHeading(dx, 0, dz, w.x, w.y, w.z)
    if (state.idleElapsed >= state.nextBiteIn) {
      state.phase = FishingPhase.Biting
      state.reactElapsed = 0
    } else if (firePressedThisFrame()) {
      // Player retracts before any bite — no catch, just go home.
      state.phase = FishingPhase.Reeling
    }
  } else if (state.phase === FishingPhase.Biting) {
    state.reactElapsed += dt
    const t = state.reactElapsed
    biteIntensity = 0.5 + 0.5 * Math.sin(2 * Math.PI * FISH_BITE_PULSE_HZ * t)
    // Hold position; jitter the rotation to sell the "fish tugging line"
    // micro-shake. Amplitude stays small so the visual emphasis is on
    // the action button highlight rather than the entity itself.
    transform.position = Vector3.create(pos.x, WATER_LEVEL, pos.z)
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const shake = computeWobble(
      state.elapsed,
      HOOK_WOBBLE_FREQ * 1.5,
      HOOK_WOBBLE_AMPLITUDE_DEG * 1.6
    )
    transform.rotation = composeHeading(dx, 0, dz, shake.x, shake.y, shake.z)
    if (firePressedThisFrame()) {
      // Successful catch — bank a fish from the sea pool, then reel.
      catchFish()
      state.phase = FishingPhase.Reeling
      biteIntensity = 0
    } else if (state.reactElapsed >= FISH_REACT_WINDOW_S) {
      // Fish escaped — return to Idle and roll a fresh delay so the
      // player can keep waiting on the same cast.
      state.phase = FishingPhase.Idle
      state.idleElapsed = 0
      state.nextBiteIn = rollBiteDelay()
      biteIntensity = 0
    }
  } else if (state.phase === FishingPhase.Reeling) {
    biteIntensity = 0
    const dx = handPos.x - pos.x
    const dz = handPos.z - pos.z
    const distXZ = Math.sqrt(dx * dx + dz * dz)
    if (distXZ < HOOK_REEL_DESPAWN_RADIUS_XZ) {
      despawnLine()
      return
    }
    const step = Math.min(HOOK_REEL_SPEED * dt, distXZ)
    const nx = dx / distXZ
    const nz = dz / distXZ
    const reeledX = pos.x + nx * step
    const reeledZ = pos.z + nz * step
    transform.position = Vector3.create(reeledX, WATER_LEVEL, reeledZ)
    const w = computeWobble(
      state.elapsed,
      HOOK_WOBBLE_FREQ,
      HOOK_WOBBLE_AMPLITUDE_DEG,
      HOOK_REEL_WOBBLE_SCALE
    )
    transform.rotation = composeHeading(dx, 0, dz, w.x, w.y, w.z)
  }

  if (ropeEntity !== null) {
    const linePos = Transform.get(lineEntity).position
    updateRopeBetween(ropeEntity, handPos, linePos, LINE_THICKNESS)
  }

  // Catch sprites ride along with the hook. They only exist after a
  // successful catch (spawned in `catchFish`), so an empty array is
  // the common case and the loop costs nothing.
  if (catchSprites.length > 0) {
    const linePos = Transform.get(lineEntity).position
    for (let i = 0; i < catchSprites.length; i++) {
      updateFishingCatchSprite(catchSprites[i], linePos, i, catchSprites.length)
    }
  }

  // In-world bite warning sprite. Visible only during Biting; pulses
  // on the same intensity as the action button and blinks on/off at
  // WARNING_BLINK_HZ so it reads as urgent rather than static.
  if (warningEntity !== null) {
    const phase = FishingLine.get(lineEntity).phase
    if (phase === FishingPhase.Biting) {
      warningBlinkT += dt
      const blink = Math.sin(2 * Math.PI * WARNING_BLINK_HZ * warningBlinkT) > 0
      const linePos = Transform.get(lineEntity).position
      updateFishingWarningSprite(warningEntity, linePos, biteIntensity)
      setFishingWarningVisible(warningEntity, blink)
    } else {
      warningBlinkT = 0
      setFishingWarningVisible(warningEntity, false)
    }
  }
}

// Bite-window catch press OR Idle-state retract press. Mobile reads the
// on-screen action button edge; desktop accepts EITHER the action
// button edge (the HUD button is also clickable on desktop while the
// line is out) or IA_POINTER PET_DOWN (the standard click-to-fire).
// Either way, the press only counts when the player isn't still
// holding over from the slot-selection click.
function firePressedThisFrame(): boolean {
  if (isSelectionPointerLockoutActive()) return false
  if (actionButtonJustPressed()) return true
  if (isMobile()) return false
  return inputSystem.isTriggered(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN
  )
}

function catchFish(): void {
  // Roll 1 or 2 catches per bite — the plural lets the hook visibly
  // dangle a small fan of fish on the way back instead of a single
  // floating sprite. Each catch can be a different species.
  const count = 1 + Math.floor(Math.random() * 2)
  clearCatchSprites()
  for (let i = 0; i < count; i++) {
    const pick = FISH_POOL[Math.floor(Math.random() * FISH_POOL.length)]
    addCollected(pick, 1)
    notifyItemReceived(pick, 1)
    const texture = getItem(pick)?.texture
    if (texture !== undefined) {
      catchSprites.push(createFishingCatchSprite(texture))
    }
  }
}

function clearCatchSprites(): void {
  for (const e of catchSprites) destroyFishingCatchSprite(e)
  catchSprites = []
}

function rollBiteDelay(): number {
  return (
    FISH_BITE_DELAY_MIN_S +
    Math.random() * (FISH_BITE_DELAY_MAX_S - FISH_BITE_DELAY_MIN_S)
  )
}

function despawnLine(): void {
  if (lineEntity !== null) {
    engine.removeEntity(lineEntity)
    lineEntity = null
  }
  if (ropeEntity !== null) hideRope(ropeEntity)
  if (warningEntity !== null) {
    destroyFishingWarningSprite(warningEntity)
    warningEntity = null
  }
  clearCatchSprites()
  warningBlinkT = 0
  biteIntensity = 0
}

// Higher arc than the hook (~45°) so the rod cast reads as an overhead
// lob rather than a flat throw.
const AIM_ELEVATION_BIAS = Math.sin(45 * Math.PI / 180) // ~0.707

function computeAimDir(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const forward = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  const biased = Vector3.create(forward.x, forward.y + AIM_ELEVATION_BIAS, forward.z)
  const len = Math.sqrt(biased.x * biased.x + biased.y * biased.y + biased.z * biased.z)
  const aim = Vector3.create(biased.x / len, biased.y / len, biased.z / len)
  const MAX_UP_Y = Math.SQRT1_2
  if (aim.y <= MAX_UP_Y) return aim
  const horiz = Math.sqrt(aim.x * aim.x + aim.z * aim.z)
  if (horiz < 0.0001) {
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (player === null) return null
    const playerFwd = Vector3.rotate(CAMERA_FORWARD, player.rotation as Quaternion)
    return Vector3.create(playerFwd.x * MAX_UP_Y, MAX_UP_Y, playerFwd.z * MAX_UP_Y)
  }
  const scale = MAX_UP_Y / horiz
  return Vector3.create(aim.x * scale, MAX_UP_Y, aim.z * scale)
}

function computeHandPos(offset: Vector3): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const localOffset = Vector3.rotate(offset, cam.rotation as Quaternion)
  return Vector3.create(
    cam.position.x + localOffset.x,
    cam.position.y + localOffset.y,
    cam.position.z + localOffset.z
  )
}

// Returns true when the world XZ position falls inside any placed raft cell.
function isOnRaft(wx: number, wz: number): boolean {
  const half = RAFT_SIZE / 2
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    const p = Platform.get(entity)
    const cx = GRID_ORIGIN.x + p.gridX * RAFT_SIZE
    const cz = GRID_ORIGIN.z + p.gridZ * RAFT_SIZE
    if (wx >= cx - half && wx <= cx + half && wz >= cz - half && wz <= cz + half) {
      return true
    }
  }
  return false
}
