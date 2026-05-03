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

import { SharkHittable } from '../components'
import { getHeldItemEntity, getHeldItemKind } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isSelectionPointerLockoutActive } from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { tryHitShark } from './sharkAttack'

// Spear stab: a quick forward thrust + slight downward pitch, then ease back
// to rest. Total animation length is short; cooldown locks out re-fire.
const ATTACK_DURATION_S = 0.4
const COOLDOWN_S = 1.4
// Time within the swing where the strike "lands". Aligned with the half-sine
// peak (intensity = 1) so the visible thrust-extreme lines up with damage.
const STRIKE_FRAME_S = ATTACK_DURATION_S * 0.5
// Reach of the strike, measured from the camera. Sharks within this
// distance and roughly in front of the camera at the strike frame take the
// hit.
const STRIKE_REACH_M = 4.0
// Cosine of the half-cone angle the strike covers — 0.5 ≈ 60° to either
// side, generous enough that the player doesn't have to pixel-aim a moving
// shark.
const STRIKE_CONE_DOT = 0.5
const CAMERA_FORWARD = Vector3.create(0, 0, 1)

// Camera-local thrust offsets, applied additively on top of the rest pose +
// sway delta. Rotation deltas are PRE-multiplied so they happen in camera
// space (not the spear's local frame) — that way the stab pitches toward
// the camera's forward axis regardless of the rest-pose rotation.
const THRUST_FORWARD_M = 0.3
// Negative pitch in camera-space brings the spear tip from its angled rest
// pose (45° pitch) toward camera-forward — i.e. the tip dips into the stab.
const THRUST_PITCH_DEG = 0
const THRUST_YAW_DEG = 0

// 0 while idle. > 0 once an attack is in flight; counts up to ATTACK_DURATION_S.
let attackElapsed = 0
let cooldownRemaining = 0
// Guard so a single swing only registers one hit, even if multiple frames
// land inside the strike window.
let hitResolvedThisSwing = false

export function spearAttackSystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  const heldKind = getHeldItemKind()

  if (cooldownRemaining > 0) {
    cooldownRemaining = Math.max(0, cooldownRemaining - dt)
  }

  const isSpearHeld = heldKind === 'spear'

  // Trigger a new stab when the spear is held, no animation is in flight,
  // and the cooldown has elapsed. On mobile the on-screen action button is
  // the canonical fire input — taps elsewhere also fire IA_POINTER but we
  // ignore them so the button is the only way to stab. IA_POINTER is shared
  // across tools — gating on held kind keeps clicks scoped to the active
  // item.
  // Block new triggers while the inventory is up — and for a moment after
  // close, since the click that closed the panel also fires IA_POINTER.
  // In-flight stabs are allowed to finish their animation/cooldown so the
  // state machine clears cleanly when the player closes the panel.
  const firePressed =
    !isInventoryActionLocked() &&
    (isMobile()
      ? actionButtonJustPressed()
      : inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN))
  if (
    isSpearHeld &&
    attackElapsed === 0 &&
    cooldownRemaining === 0 &&
    !isSelectionPointerLockoutActive() &&
    firePressed
  ) {
    attackElapsed = dt > 0 ? dt : 1e-6
    cooldownRemaining = COOLDOWN_S
    hitResolvedThisSwing = false
  }

  if (attackElapsed === 0) return

  const previousElapsed = attackElapsed
  attackElapsed += dt

  // Resolve a hit the frame the swing crosses STRIKE_FRAME_S — locks the
  // damage to the visible thrust peak, and keeps "swing into thin air"
  // working because nothing here depends on a click target.
  if (
    !hitResolvedThisSwing &&
    previousElapsed < STRIKE_FRAME_S &&
    attackElapsed >= STRIKE_FRAME_S
  ) {
    hitResolvedThisSwing = true
    resolveStrike()
  }

  if (attackElapsed >= ATTACK_DURATION_S) {
    attackElapsed = 0
    return
  }

  // Half-sine intensity: 0 at start → 1 at midpoint → 0 at end. Gives a
  // smooth out-and-back motion in a single curve.
  const u = attackElapsed / ATTACK_DURATION_S
  const intensity = Math.sin(u * Math.PI)
  const fwdDelta = THRUST_FORWARD_M * intensity
  const pitchDelta = THRUST_PITCH_DEG * intensity
  const yawDelta = THRUST_YAW_DEG * intensity

  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    m.position.x,
    m.position.y,
    m.position.z + fwdDelta
  )
  // Pre-multiply: rotation happens in the parent (camera) frame, so pitch =
  // dip toward camera-forward, yaw = swing across the screen.
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(pitchDelta, yawDelta, 0),
    m.rotation
  )
}

// Pick the closest hittable shark inside a forward cone from the camera and
// route it to tryHitShark. tryHitShark itself filters to PHASE_BITE + the
// per-shark cooldown, so this can stay simple.
function resolveStrike(): void {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return
  const fwd = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  let bestEntity: Entity | null = null
  let bestDist = Infinity
  for (const [entity] of engine.getEntitiesWith(SharkHittable)) {
    const t = Transform.getOrNull(entity)
    if (t === null) continue
    const dx = t.position.x - cam.position.x
    const dy = t.position.y - cam.position.y
    const dz = t.position.z - cam.position.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist > STRIKE_REACH_M || dist < 1e-4) continue
    const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist
    if (dot < STRIKE_CONE_DOT) continue
    if (dist < bestDist) {
      bestDist = dist
      bestEntity = entity
    }
  }
  if (bestEntity !== null) tryHitShark(bestEntity)
}
