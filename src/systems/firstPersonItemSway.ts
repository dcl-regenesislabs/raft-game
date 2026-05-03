import { Transform } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { getHeldItemEntity, getHeldItemRest } from '../factories/heldItem'

// Breathing pulse of the held item. Two sine waves at slightly different
// frequencies on the major axes so the motion never lines up into a clean
// loop — reads as an organic "the hand holding it is alive" sway.
const BOB_AMP_Y = 0.012
const BOB_AMP_X = 0.006
const BOB_AMP_Z = 0.004
const BOB_FREQ_Y = 0.28 // Hz
const BOB_FREQ_X = 0.18
const BOB_FREQ_Z = 0.22

const ROT_AMP_PITCH_DEG = 1.2
const ROT_AMP_YAW_DEG = 0.8
const ROT_AMP_ROLL_DEG = 0.5
const ROT_FREQ_PITCH = 0.28
const ROT_FREQ_YAW = 0.18
const ROT_FREQ_ROLL = 0.12

const TWO_PI = Math.PI * 2

let t = 0

export function firstPersonItemSwaySystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  t += dt

  const rest = getHeldItemRest()

  const dx = BOB_AMP_X * Math.sin(t * BOB_FREQ_X * TWO_PI)
  const dy = BOB_AMP_Y * Math.sin(t * BOB_FREQ_Y * TWO_PI)
  const dz = BOB_AMP_Z * Math.sin(t * BOB_FREQ_Z * TWO_PI)

  const pitch = ROT_AMP_PITCH_DEG * Math.sin(t * ROT_FREQ_PITCH * TWO_PI)
  const yaw = ROT_AMP_YAW_DEG * Math.sin(t * ROT_FREQ_YAW * TWO_PI)
  const roll = ROT_AMP_ROLL_DEG * Math.sin(t * ROT_FREQ_ROLL * TWO_PI)

  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    rest.offset.x + dx,
    rest.offset.y + dy,
    rest.offset.z + dz
  )
  m.rotation = Quaternion.multiply(
    rest.rotation,
    Quaternion.fromEulerDegrees(pitch, yaw, roll)
  )
}
