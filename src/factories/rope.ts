import { Entity, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

const ROPE_COLOR = Color4.create(0.55, 0.45, 0.15, 1)
const ROPE_THICKNESS = 0.03

const RAD_TO_DEG = 180 / Math.PI

export function createRopeEntity(color: Color4 = ROPE_COLOR, parent?: Entity): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    parent,
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  MeshRenderer.setCylinder(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    metallic: 0,
    roughness: 1,
    castShadows: false
  })
  return entity
}

// Stretches a thin cylinder between `from` and `to`. The default cylinder's
// long axis is local +Y, so we scale Y to the segment length and compose two
// rotations: a +90° pitch around X to remap local +Y onto the old +Z, then
// the same yaw+pitch the box version used to align +Z with the direction.
const Y_TO_Z = Quaternion.fromEulerDegrees(90, 0, 0)
export function updateRopeBetween(entity: Entity, from: Vector3, to: Vector3, thickness: number = ROPE_THICKNESS): void {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const transform = Transform.getMutable(entity)
  if (distance < 0.0001) {
    transform.scale = Vector3.create(0, 0, 0)
    return
  }
  const horizontal = Math.sqrt(dx * dx + dz * dz)
  const yawDeg = Math.atan2(dx, dz) * RAD_TO_DEG
  const pitchDeg = -Math.atan2(dy, horizontal) * RAD_TO_DEG
  transform.position = Vector3.create(
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    (from.z + to.z) / 2
  )
  transform.scale = Vector3.create(thickness, distance, thickness)
  const aim = Quaternion.fromEulerDegrees(pitchDeg, yawDeg, 0)
  transform.rotation = Quaternion.multiply(aim, Y_TO_Z)
}

export function hideRope(entity: Entity): void {
  Transform.getMutable(entity).scale = Vector3.create(0, 0, 0)
}
