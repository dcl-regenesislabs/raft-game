import { Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { getHeldItemEntity, getHeldItemKind } from '../factories/heldItem'

// Hammer swing: a quick downward arc + slight forward push, eased back to
// rest. Triggered externally by raftBuilder when a platform is placed or
// destroyed — no input handling here.
const SWING_DURATION_S = 0.28

// Camera-frame deltas applied additively on top of the rest pose + sway.
// Positive pitch = head dips downward in camera space; small forward push
// reads as the impact follow-through.
const SWING_PITCH_DEG = 35
const SWING_FORWARD_M = 0.12
const SWING_DOWN_M = 0.08

let swingElapsed = 0

// Called by external systems (raftBuilder) at the moment of place/destroy.
// Safe to call when hammer isn't held — the system gates on held kind.
export function triggerHammerSwing(): void {
  if (getHeldItemKind() !== 'hammer') return
  swingElapsed = 1e-6
}

export function hammerSwingSystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return
  if (swingElapsed === 0) return

  swingElapsed += dt
  if (swingElapsed >= SWING_DURATION_S) {
    swingElapsed = 0
    return
  }

  // Half-sine: 0 → 1 at midpoint → 0. Single curve handles strike + recover.
  const u = swingElapsed / SWING_DURATION_S
  const intensity = Math.sin(u * Math.PI)

  const pitchDelta = SWING_PITCH_DEG * intensity
  const fwdDelta = SWING_FORWARD_M * intensity
  const downDelta = SWING_DOWN_M * intensity

  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    m.position.x,
    m.position.y - downDelta,
    m.position.z + fwdDelta
  )
  // Pre-multiply: pitch happens in camera (parent) frame so the head dips
  // toward the screen regardless of the hammer's local rest rotation.
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(pitchDelta, 0, 0),
    m.rotation
  )
}
