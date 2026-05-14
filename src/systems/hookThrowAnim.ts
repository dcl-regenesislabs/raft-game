import { Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  getHeldItemEntity,
  getHeldItemKind,
  getHeldItemRest,
  isHeldViewmodelHidden
} from '../factories/heldItem'
import { getThrowChargeT, isHookInFlight } from './hookThrower'
import { getFishingChargeT, isFishingLineActive, isFishingLineReeling } from './fishingRod'

// Wind-up offset relative to the rest pose, expressed in camera-local space.
// At full charge the hook is pulled up-back-right (over the shoulder) and
// rotated so the head faces backward, ready to be released forward.
const SHOULDER_OFFSET = Vector3.create(0.11, 0.18, -0.18)
const SHOULDER_ROT_PITCH_DEG = -18
const SHOULDER_ROT_YAW_DEG = 25
const SHOULDER_ROT_ROLL_DEG = 0

// Fishing rod wind-up: the rod rotates far back over the shoulder until
// it disappears from view, mimicking a real casting windup. On release
// it snaps forward to rest (handled by charge dropping to 0 instantly).
const ROD_BACK_OFFSET = Vector3.create(0.15, 0.4, -0.5)
const ROD_ROT_PITCH_DEG = -120
const ROD_ROT_YAW_DEG = 30
const ROD_ROT_ROLL_DEG = 0

// Easing for the wind-up motion. Quadratic ease-out so the hook snaps toward
// the shoulder fast at the start and settles into position as the charge bar
// fills.
function easeOutQuad(t: number): number {
  return t * (2 - t)
}

export function hookThrowAnimSystem(_dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  // While the lobby gate keeps the viewmodel stashed, leave visibility
  // alone — we'd otherwise re-show the hidden hook every frame.
  if (isHeldViewmodelHidden()) return

  const kind = getHeldItemKind()
  const isHookHeld = kind === 'hook'
  const isRodHeld = kind === 'fishingRod'
  const hookFlight = isHookInFlight()
  const lineFlight = isFishingLineActive()

  // Hide the viewmodel while the projectile is out. The rod only
  // reappears once reeling starts (player pulls it back).
  const shouldHide = (isHookHeld && hookFlight) || (isRodHeld && lineFlight && !isFishingLineReeling())
  setVisible(entity, !shouldHide)

  // Hook charge wind-up
  if (isHookHeld && !hookFlight) {
    const charge = getThrowChargeT()
    if (charge > 0) {
      applyWindup(entity, charge, SHOULDER_OFFSET, SHOULDER_ROT_PITCH_DEG, SHOULDER_ROT_YAW_DEG, SHOULDER_ROT_ROLL_DEG)
    }
    return
  }

  // Rod charge wind-up — larger rotation to send it behind the player
  if (isRodHeld && !lineFlight) {
    const charge = getFishingChargeT()
    if (charge > 0) {
      applyWindup(entity, charge, ROD_BACK_OFFSET, ROD_ROT_PITCH_DEG, ROD_ROT_YAW_DEG, ROD_ROT_ROLL_DEG)
    }
    return
  }
}

function applyWindup(
  entity: NonNullable<ReturnType<typeof getHeldItemEntity>>,
  charge: number,
  offset: Vector3,
  pitchDeg: number,
  yawDeg: number,
  rollDeg: number
): void {
  const t = easeOutQuad(charge)
  const rest = getHeldItemRest()
  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    rest.offset.x + offset.x * t,
    rest.offset.y + offset.y * t,
    rest.offset.z + offset.z * t
  )
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(pitchDeg * t, yawDeg * t, rollDeg * t),
    rest.rotation
  )
}

function setVisible(entity: ReturnType<typeof getHeldItemEntity>, visible: boolean): void {
  if (entity === null) return
  const cur = VisibilityComponent.getOrNull(entity)
  if (cur === null) {
    if (!visible) VisibilityComponent.create(entity, { visible: false })
    return
  }
  if (cur.visible === visible) return
  VisibilityComponent.getMutable(entity).visible = visible
}
