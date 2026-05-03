import { Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  getHeldItemEntity,
  getHeldItemKind,
  getHeldItemRest
} from '../factories/heldItem'
import { getThrowChargeT, isHookInFlight } from './hookThrower'

// Wind-up offset relative to the rest pose, expressed in camera-local space.
// At full charge the hook is pulled up-back-right (over the shoulder) and
// rotated so the head faces backward, ready to be released forward.
const SHOULDER_OFFSET = Vector3.create(0.11, 0.18, -0.18)
const SHOULDER_ROT_PITCH_DEG = -18
const SHOULDER_ROT_YAW_DEG = 25
const SHOULDER_ROT_ROLL_DEG = 0

// Easing for the wind-up motion. Quadratic ease-out so the hook snaps toward
// the shoulder fast at the start and settles into position as the charge bar
// fills.
function easeOutQuad(t: number): number {
  return t * (2 - t)
}

export function hookThrowAnimSystem(_dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  const isHookHeld = getHeldItemKind() === 'hook'
  const inFlight = isHookInFlight()

  // Hide the viewmodel while the hook projectile is out — the player threw
  // it. Visible again once the projectile despawns (reeled back in).
  const shouldHide = isHookHeld && inFlight
  setVisible(entity, !shouldHide)

  if (!isHookHeld || inFlight) return

  const charge = getThrowChargeT()
  if (charge === 0) return

  const t = easeOutQuad(charge)
  const rest = getHeldItemRest()

  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    rest.offset.x + SHOULDER_OFFSET.x * t,
    rest.offset.y + SHOULDER_OFFSET.y * t,
    rest.offset.z + SHOULDER_OFFSET.z * t
  )
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(
      SHOULDER_ROT_PITCH_DEG * t,
      SHOULDER_ROT_YAW_DEG * t,
      SHOULDER_ROT_ROLL_DEG * t
    ),
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
