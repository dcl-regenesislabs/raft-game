import { Vec } from './types'
export type MotionSample = { position: Vec; velocity: Vec; age: number }
// Bounded extrapolation hides update cadence; exponential correction is frame-rate independent.
export function advanceMotion(current: Vec, sample: MotionSample, dt: number): Vec {
  const step = Math.max(0, Math.min(dt, 0.1))
  sample.age += step
  const horizon = Math.min(sample.age, 0.5)
  const target = {
    x: sample.position.x + sample.velocity.x * horizon,
    y: sample.position.y + sample.velocity.y * horizon,
    z: sample.position.z + sample.velocity.z * horizon
  }
  const factor =
    Math.hypot(target.x - current.x, target.y - current.y, target.z - current.z) > 8 ? 1 : 1 - Math.exp(-20 * step)
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
    z: current.z + (target.z - current.z) * factor
  }
}
