import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  getRodIdleHookEntity,
  getRodIdleLineEntity,
  getRodIdleLineLength,
  getRodIdleLineThickness,
  getRodToolEntity,
  getRodTipModelLocal,
  isRodIdleDangleActive
} from '../factories/heldItem'
import { updateRopeBetween } from '../factories/rope'

// Drives a damped lateral swing on the dangling hook so it visibly lags
// behind camera motion. Hook is a child of the rod GLTF and inherits its
// camera-parented rotation; without this system the hook tracks the
// camera 1:1, which reads as glued to the rod rather than tethered.
// Each frame we measure the camera yaw delta, kick a virtual velocity
// against it, and decay back to neutral with a spring-damper. The
// dangle line is rebuilt to connect the rod tip to the swung position
// so the visual "string" stays attached.

// Magnitudes are in the rod's model-local frame; the rod's Z=-90 rest
// rotation maps camera +X (screen right) to rod +Y, so a yaw delta
// produces a +/-Y swing offset.
const SWING_KICK = 1.6 // amount of velocity per radian of camera rotation
const SWING_STIFFNESS = 12 // spring strength pulling offset toward 0
const SWING_DAMPING = 4 // velocity damping (higher = settles faster)
// Only yaw (left/right) drives the swing — a real fishing line is taut
// against gravity, so vertical camera movement (pitch) translates the
// whole rig together without changing the line's hang angle. We keep
// the hook glued to its rest-y when the player looks up/down.
// Hard caps so a violent flick of the camera can't sling the hook far
// past the rod. Both bounds are in the rod's model-local frame; the
// rod's 0.35 scale means a cap of 0.6 is ~21 cm in world space.
// Asymmetric: the rest position already sits left of center, so the
// left cap (negative swingY) is tighter than the right cap to keep the
// hook from drifting too far past the rod's body on a hard yaw.
const MAX_SWING_RIGHT = 0.6
const MAX_SWING_LEFT = 0.25
const MAX_SWING_VEL = 6

// No explicit hook charge offset — the rod's sidearm windup (in
// hookThrowAnim.ts) leans the rod to the right, and the line+hook
// follow as children, which already swings them clear of the player.

let prevYaw = 0
let swingY = 0
let velY = 0
let initialised = false

export function rodHookSwingSystem(dt: number): void {
  const hookEntity = getRodIdleHookEntity()
  const lineEntity = getRodIdleLineEntity()
  if (hookEntity === null || lineEntity === null) return

  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return

  const euler = Quaternion.toEulerAngles(cam.rotation as Quaternion)
  const yaw = (euler.y * Math.PI) / 180

  if (!initialised) {
    prevYaw = yaw
    initialised = true
  }

  let dYaw = yaw - prevYaw
  // Yaw wraps at ±π; unwrap so sudden 359°→0° flips don't kick the hook.
  if (dYaw > Math.PI) dYaw -= 2 * Math.PI
  if (dYaw < -Math.PI) dYaw += 2 * Math.PI
  prevYaw = yaw

  // While suppressed (live cast in flight) or the rod isn't held, freeze
  // the swing at rest so we don't accumulate offsets across the gap.
  if (!isRodIdleDangleActive()) {
    swingY = 0
    velY = 0
    return
  }

  // Camera turns produce an opposing impulse — the hook lags behind.
  velY -= dYaw * SWING_KICK
  velY = clamp(velY, -MAX_SWING_VEL, MAX_SWING_VEL)

  // Spring-damper integration. dt clamped so a long frame can't blow up.
  const stepDt = Math.min(dt, 1 / 30)
  const accelY = -SWING_STIFFNESS * swingY - SWING_DAMPING * velY
  velY += accelY * stepDt
  swingY += velY * stepDt
  // Hard-cap the offset and bleed velocity when we hit the wall so the
  // hook doesn't pile up energy by repeatedly slamming the cap.
  if (swingY > MAX_SWING_RIGHT) { swingY = MAX_SWING_RIGHT; if (velY > 0) velY = 0 }
  if (swingY < -MAX_SWING_LEFT) { swingY = -MAX_SWING_LEFT; if (velY < 0) velY = 0 }

  // The hook follows gravity in WORLD space — when the rod tilts (e.g.
  // sidearm windup), the line should keep hanging straight down rather
  // than rotating with the rod. Compute world-DOWN expressed in the
  // rod's local frame and place the hook that direction from the tip,
  // then add the lateral swing on top.
  const tool = getRodToolEntity()
  if (tool === null) return
  const rod = Transform.getOrNull(tool)
  if (rod === null) return
  const rodWorldRot = Quaternion.multiply(cam.rotation as Quaternion, rod.rotation as Quaternion)
  // SDK7's Quaternion namespace has no `invert` helper. For a unit quaternion
  // the inverse equals the conjugate: negate the imaginary parts.
  const rodWorldRotInv = Quaternion.create(
    -rodWorldRot.x,
    -rodWorldRot.y,
    -rodWorldRot.z,
    rodWorldRot.w
  )
  const downLocal = Vector3.rotate(WORLD_DOWN, rodWorldRotInv)
  const lineLen = getRodIdleLineLength()
  const tip = getRodTipModelLocal()
  const hookPos = Vector3.create(
    tip.x + downLocal.x * lineLen,
    tip.y + downLocal.y * lineLen + swingY,
    tip.z + downLocal.z * lineLen
  )
  const hookT = Transform.getMutable(hookEntity)
  hookT.position = hookPos

  // Rebuild the line so it connects the rod tip to the gravity-hung hook.
  updateRopeBetween(lineEntity, tip, hookPos, getRodIdleLineThickness())
}

const WORLD_DOWN = Vector3.create(0, -1, 0)

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}
