import { Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { SharkAttack, SharkOrbit } from '../components'

const TAU = Math.PI * 2
const RAD_TO_DEG = 180 / Math.PI
// Half-range of the spacing speed multiplier; range becomes [0.7, 1.3].
const SPACING_MULT_RANGE = 0.3

// Per-frame circular motion + adaptive spacing.
//
// `orbit.speed` is a *linear* swim speed (m/s). We convert to angular
// velocity each frame as `speed / radius` so the shark's apparent speed
// stays constant as the ring grows or shrinks with the raft. The result
// is then modulated by a spacing multiplier in [0.7, 1.3] computed from
// each shark's forward and backward gaps to the other on-ring sharks. The multiplier is positive (speed up) when
// the behind-neighbour is closer than the forward-neighbour and negative
// (slow down) in the opposite case. The formation continuously self-
// organises into evenly spaced slots without any shark ever overtaking
// another — the one ahead always outpaces the one behind.
//
// Sharks currently in an attack cycle (carrying SharkAttack) are skipped:
// the director drives their transform directly. They are also excluded
// from the spacing computation, so the on-ring sharks redistribute among
// themselves while one is away. When the attacker rejoins the ring the
// same rule pulls everyone back to even spacing.
export function sharkOrbitSystem(dt: number): void {
  // Snapshot the orbiting (non-attacking) sharks for spacing math.
  const orbiting: { entity: Entity; phase: number }[] = []
  for (const [entity] of engine.getEntitiesWith(SharkOrbit)) {
    if (SharkAttack.getOrNull(entity) !== null) continue
    orbiting.push({ entity, phase: wrapAngle(SharkOrbit.get(entity).phase) })
  }
  if (orbiting.length === 0) return
  const targetGap = TAU / orbiting.length

  for (const [entity] of engine.getEntitiesWith(SharkOrbit, Transform)) {
    if (SharkAttack.getOrNull(entity) !== null) continue
    const orbit = SharkOrbit.getMutable(entity)
    const myPhase = wrapAngle(orbit.phase)

    // Forward gap = smallest positive CCW distance from me to another
    // orbiter. Backward gap = TAU minus the largest such distance,
    // i.e. the smallest CCW distance from another to me.
    let minFwd = TAU
    let maxFwd = 0
    for (const other of orbiting) {
      if (other.entity === entity) continue
      const fwd = wrapAngle(other.phase - myPhase)
      if (fwd > 0 && fwd < minFwd) minFwd = fwd
      if (fwd > maxFwd) maxFwd = fwd
    }
    const forwardGap = orbiting.length > 1 ? minFwd : TAU
    const backwardGap = orbiting.length > 1 ? TAU - maxFwd : TAU

    const adj = clamp((forwardGap - backwardGap) / targetGap, -1, 1)
    const mult = 1 + SPACING_MULT_RANGE * adj

    // speed is linear (m/s); angular = speed / radius. Guard against a
    // near-zero radius so we don't spin wildly during a transient.
    const angular = orbit.speed / Math.max(orbit.radius, 1)
    orbit.phase = wrapAngle(orbit.phase + angular * mult * dt)

    const transform = Transform.getMutable(entity)
    transform.position = Vector3.create(
      orbit.centerX + orbit.radius * Math.cos(orbit.phase),
      orbit.y,
      orbit.centerZ + orbit.radius * Math.sin(orbit.phase)
    )

    // Tangent for a CCW orbit on XZ is (-sin θ, 0, cos θ); the yaw that
    // aligns the model's +Z forward with that vector is -θ. We add a
    // configurable offset for models whose default forward axis differs.
    const yawDeg = -orbit.phase * RAD_TO_DEG + orbit.headingOffsetDeg
    transform.rotation = Quaternion.fromEulerDegrees(0, yawDeg, 0)
  }
}

function wrapAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
