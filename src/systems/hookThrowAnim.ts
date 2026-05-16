import { Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  getHeldItemEntity,
  getHeldItemKind,
  getHeldItemRest,
  isHeldViewmodelHidden
} from '../factories/heldItem'
import { getAnchorChargeT, isAnchorInFlight } from './anchorThrower'
import { getThrowChargeT, isHookInFlight } from './hookThrower'
import { getFishingChargeT, isFishingLineActive } from './fishingRod'

// Wind-up offset relative to the rest pose, expressed in camera-local space.
// At full charge the hook is pulled up-back-right (over the shoulder) and
// rotated so the head faces backward, ready to be released forward.
const SHOULDER_OFFSET = Vector3.create(0.11, 0.18, -0.18)
const SHOULDER_ROT_PITCH_DEG = -18
const SHOULDER_ROT_YAW_DEG = 25
const SHOULDER_ROT_ROLL_DEG = 0

// Fishing rod wind-up: combined sidearm + back-load. The rod leans right
// (negative roll) so the line clears the player's body, AND tips back
// (negative pitch) so the tip cocks behind the right shoulder. Position
// offset slides the whole rig slightly right and back. Hook+line are
// children of the rod and follow this motion through the windup tween.
const ROD_BACK_OFFSET = Vector3.create(0.15, -0.05, -0.2)
const ROD_ROT_PITCH_DEG = -30
const ROD_ROT_YAW_DEG = 15
const ROD_ROT_ROLL_DEG = -55

// Easing for the wind-up motion. Quadratic ease-out so the hook snaps toward
// the shoulder fast at the start and settles into position as the charge bar
// fills.
function easeOutQuad(t: number): number {
  return t * (2 - t)
}

// Time taken for the viewmodel to ease back from the windup pose to rest after
// the player releases the cast. Without this the rod snaps instantly, which
// reads as a glitch rather than a follow-through.
const RELEASE_EASE_S = 0.25

// Tracks the in-flight ease-out of the windup → rest snap-back. We capture
// the charge level at release and decay it across RELEASE_EASE_S so the
// transform interpolates smoothly instead of jumping.
interface ReleaseAnim {
  capturedT: number
  elapsed: number
}
let hookRelease: ReleaseAnim | null = null
let anchorRelease: ReleaseAnim | null = null
let rodRelease: ReleaseAnim | null = null
let lastHookCharge = 0
let lastAnchorCharge = 0
let lastRodCharge = 0

export function hookThrowAnimSystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  // While the lobby gate keeps the viewmodel stashed, leave visibility
  // alone — we'd otherwise re-show the hidden hook every frame.
  if (isHeldViewmodelHidden()) return

  const kind = getHeldItemKind()
  const isHookHeld = kind === 'hook'
  const isAnchorHeld = kind === 'anchor'
  const isRodHeld = kind === 'fishingRod'
  const hookFlight = isHookInFlight()
  const anchorFlight = isAnchorInFlight()
  const lineFlight = isFishingLineActive()

  // Hide the viewmodel while it's the projectile in flight.
  const shouldHide = (isHookHeld && hookFlight) || (isAnchorHeld && anchorFlight)
  setVisible(entity, !shouldHide)

  // Anchor charge wind-up — same motion as the hook.
  if (isAnchorHeld && !anchorFlight) {
    const charge = getAnchorChargeT()
    if (charge === 0 && lastAnchorCharge > 0) {
      anchorRelease = { capturedT: lastAnchorCharge, elapsed: 0 }
    }
    lastAnchorCharge = charge
    if (charge > 0) {
      anchorRelease = null
      applyWindup(entity, charge, SHOULDER_OFFSET, SHOULDER_ROT_PITCH_DEG, SHOULDER_ROT_YAW_DEG, SHOULDER_ROT_ROLL_DEG)
    } else if (anchorRelease !== null) {
      anchorRelease.elapsed += dt
      const k = 1 - Math.min(1, anchorRelease.elapsed / RELEASE_EASE_S)
      applyWindup(entity, anchorRelease.capturedT * k, SHOULDER_OFFSET, SHOULDER_ROT_PITCH_DEG, SHOULDER_ROT_YAW_DEG, SHOULDER_ROT_ROLL_DEG)
      if (k <= 0) anchorRelease = null
    }
    return
  }

  // Hook charge wind-up + release tween.
  if (isHookHeld && !hookFlight) {
    const charge = getThrowChargeT()
    if (charge === 0 && lastHookCharge > 0) {
      hookRelease = { capturedT: lastHookCharge, elapsed: 0 }
    }
    lastHookCharge = charge
    if (charge > 0) {
      hookRelease = null
      applyWindup(entity, charge, SHOULDER_OFFSET, SHOULDER_ROT_PITCH_DEG, SHOULDER_ROT_YAW_DEG, SHOULDER_ROT_ROLL_DEG)
    } else if (hookRelease !== null) {
      hookRelease.elapsed += dt
      const k = 1 - Math.min(1, hookRelease.elapsed / RELEASE_EASE_S)
      applyWindup(entity, hookRelease.capturedT * k, SHOULDER_OFFSET, SHOULDER_ROT_PITCH_DEG, SHOULDER_ROT_YAW_DEG, SHOULDER_ROT_ROLL_DEG)
      if (k <= 0) hookRelease = null
    }
    return
  }

  // Rod charge wind-up + release tween. Unlike the hook, the rod stays in
  // the player's hand during line flight, so the release tween must play
  // even after the cast spawns the line — capture happens on the same
  // frame charge resets.
  if (isRodHeld) {
    const charge = lineFlight ? 0 : getFishingChargeT()
    if (charge === 0 && lastRodCharge > 0) {
      rodRelease = { capturedT: lastRodCharge, elapsed: 0 }
    }
    lastRodCharge = charge
    if (charge > 0) {
      rodRelease = null
      applyWindup(entity, charge, ROD_BACK_OFFSET, ROD_ROT_PITCH_DEG, ROD_ROT_YAW_DEG, ROD_ROT_ROLL_DEG)
    } else if (rodRelease !== null) {
      rodRelease.elapsed += dt
      const k = 1 - Math.min(1, rodRelease.elapsed / RELEASE_EASE_S)
      applyWindup(entity, rodRelease.capturedT * k, ROD_BACK_OFFSET, ROD_ROT_PITCH_DEG, ROD_ROT_YAW_DEG, ROD_ROT_ROLL_DEG)
      if (k <= 0) rodRelease = null
    }
    return
  }

  // Held kind has no windup (e.g. hammer/spear) — clear any stale release
  // state so a swap back to rod/hook/anchor starts clean.
  hookRelease = null
  anchorRelease = null
  rodRelease = null
  lastHookCharge = 0
  lastAnchorCharge = 0
  lastRodCharge = 0
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
