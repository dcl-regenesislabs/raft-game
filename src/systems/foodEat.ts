import {
  InputAction,
  PointerEventType,
  Transform,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import {
  getHeldFoodId,
  getHeldItemEntity,
  getHeldItemKind,
  getHeldItemRest
} from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import {
  consumeFoodById,
  getCollectedCount,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'

// Eat gesture: pull the food sprite up toward the camera (mouth) and tilt it
// briefly, then ease back to the rest pose. Effects (hunger / thirst) apply
// on the gesture's peak frame so the visible "bite" lines up with the stat
// bump. A short cooldown prevents auto-fire from an held button.
const EAT_DURATION_S = 0.5
const COOLDOWN_S = 0.35
// Time within the gesture where the bite lands. Matches the half-sine peak
// (intensity = 1) so the visible bring-to-mouth aligns with consumption.
const EAT_BITE_FRAME_S = EAT_DURATION_S * 0.5

// Camera-frame deltas applied additively on top of the rest pose + sway.
// Negative Z brings the sprite closer to the camera, +Y raises it toward
// the mouth, -X pulls it from the right hand toward screen center.
const EAT_FORWARD_M = -0.3
const EAT_UP_M = 0.18
const EAT_SIDE_M = -0.22
const EAT_PITCH_DEG = -25
// Slight scale-up at the bite peak so the food reads as held close to the
// camera rather than just translating in.
const EAT_SCALE_BONUS = 0.25

// 0 while idle. > 0 once a bite is in flight; counts up to EAT_DURATION_S.
let eatElapsed = 0
let cooldownRemaining = 0
// Guard so a single bite consumes one food, even if multiple frames land
// inside the bite window.
let consumedThisBite = false

export function foodEatSystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  if (cooldownRemaining > 0) {
    cooldownRemaining = Math.max(0, cooldownRemaining - dt)
  }

  const isFoodHeld = getHeldItemKind() === 'food'

  // Trigger a new bite when food is equipped, no animation is in flight,
  // and the cooldown has elapsed. Mirrors the spear gating: action button
  // on mobile, IA_POINTER on desktop with the pointer captured. Inventory
  // / craft panels block the trigger; in-flight bites are allowed to
  // finish so the state machine clears cleanly.
  const firePressed =
    !isInventoryActionLocked() &&
    (isMobile()
      ? actionButtonJustPressed()
      : isPointerLocked() &&
        inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN))

  if (
    isFoodHeld &&
    eatElapsed === 0 &&
    cooldownRemaining === 0 &&
    !isSelectionPointerLockoutActive() &&
    firePressed &&
    hasFoodInStack()
  ) {
    eatElapsed = dt > 0 ? dt : 1e-6
    cooldownRemaining = COOLDOWN_S
    consumedThisBite = false
  }

  if (eatElapsed === 0) return

  const previousElapsed = eatElapsed
  eatElapsed += dt

  // Apply the food's effects the frame the bite crosses EAT_BITE_FRAME_S —
  // locks the stat bump to the visible peak, and prevents a long frame
  // from skipping the consume entirely.
  if (
    !consumedThisBite &&
    previousElapsed < EAT_BITE_FRAME_S &&
    eatElapsed >= EAT_BITE_FRAME_S
  ) {
    consumedThisBite = true
    const foodId = getHeldFoodId()
    if (foodId !== null) consumeFoodById(foodId)
  }

  if (eatElapsed >= EAT_DURATION_S) {
    eatElapsed = 0
    return
  }

  // Half-sine intensity: 0 at start → 1 at midpoint → 0 at end. Single
  // curve handles bring-to-mouth and recover.
  const u = eatElapsed / EAT_DURATION_S
  const intensity = Math.sin(u * Math.PI)

  const fwdDelta = EAT_FORWARD_M * intensity
  const upDelta = EAT_UP_M * intensity
  const sideDelta = EAT_SIDE_M * intensity
  const pitchDelta = EAT_PITCH_DEG * intensity
  const scaleBonus = 1 + EAT_SCALE_BONUS * intensity

  const rest = getHeldItemRest()
  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    m.position.x + sideDelta,
    m.position.y + upDelta,
    m.position.z + fwdDelta
  )
  // Pre-multiply: pitch in camera (parent) frame so the food tilts toward
  // the screen regardless of the sprite's local rotation.
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(pitchDelta, 0, 0),
    m.rotation
  )
  // Anchor the scale bump to the rest-pose scale (not the previous frame's
  // scale) — otherwise the multiplier compounds across frames and the
  // sprite balloons.
  m.scale = Vector3.create(
    rest.scale.x * scaleBonus,
    rest.scale.y * scaleBonus,
    rest.scale.z * scaleBonus
  )
}

function hasFoodInStack(): boolean {
  const id = getHeldFoodId()
  if (id === null) return false
  return getCollectedCount(id) > 0
}
