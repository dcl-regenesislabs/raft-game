import { Entity, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

const ROPE_COLOR = Color4.create(0.35, 0.22, 0.1, 1)
const ROPE_THICKNESS = 0.03
const RAD_TO_DEG = 180 / Math.PI

export function createRopeEntity(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: ROPE_COLOR,
    metallic: 0,
    roughness: 1,
    castShadows: false
  })
  return entity
}

// Stretches a thin box between `from` and `to`. Box default extent is 1m
// along each axis; we scale Z to the segment length and rotate so +Z aligns
// with the direction vector. Yaw + pitch (no roll) are sufficient for a
// straight rod; no dependency on Quaternion.lookRotation availability.
export function updateRopeBetween(entity: Entity, from: Vector3, to: Vector3): void {
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
  transform.scale = Vector3.create(ROPE_THICKNESS, ROPE_THICKNESS, distance)
  transform.rotation = Quaternion.fromEulerDegrees(pitchDeg, yawDeg, 0)
}

export function hideRope(entity: Entity): void {
  Transform.getMutable(entity).scale = Vector3.create(0, 0, 0)
}
