import { Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { BoatOrbit } from '../components'
import { RAD_TO_DEG, wrapAngle } from '../utils/math'

// Per-frame circular motion for boat NPCs. Lifted from `sharkOrbit` but
// stripped of the multi-shark spacing math + attack branching — the
// boat is a solo orbiter, so a constant angular velocity is all we
// need. Keeping it as its own system means a non-shark orbiter can't
// feed into the shark spacing average (which would skew the shark
// formation around the raft).
//
// `orbit.speed` is a linear swim speed (m/s); we convert to angular
// velocity each frame as `speed / radius` so the boat's apparent pace
// stays constant if the radius is tuned later.
export function boatOrbitSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(BoatOrbit, Transform)) {
    const orbit = BoatOrbit.getMutable(entity)
    const angular = orbit.speed / Math.max(orbit.radius, 1)
    orbit.phase = wrapAngle(orbit.phase + angular * dt)

    const transform = Transform.getMutable(entity)
    transform.position = Vector3.create(
      orbit.centerX + orbit.radius * Math.cos(orbit.phase),
      orbit.y,
      orbit.centerZ + orbit.radius * Math.sin(orbit.phase)
    )
    // Tangent for a CCW orbit on XZ is (-sin θ, 0, cos θ); the yaw
    // that aligns the model's +Z forward with that vector is -θ. We
    // add `headingOffsetDeg` so models whose default forward axis
    // isn't +Z can be aligned without a rebake.
    const yawDeg = -orbit.phase * RAD_TO_DEG + orbit.headingOffsetDeg
    transform.rotation = Quaternion.fromEulerDegrees(0, yawDeg, 0)
  }
}
