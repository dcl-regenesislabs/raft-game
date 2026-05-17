import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

const ANCHOR_SRC = 'assets/scene/items/anchor-v2.glb'
const ANCHOR_SCALE = Vector3.create(0.35, 0.35, 0.35)
export const ANCHOR_FORWARD_ROTATION = Quaternion.fromEulerDegrees(-90, 0, 0)

export function createAnchorEntity(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.Zero(),
    rotation: ANCHOR_FORWARD_ROTATION,
    scale: ANCHOR_SCALE
  })
  GltfContainer.create(entity, { src: ANCHOR_SRC })
  GltfNodeModifiers.create(entity, {
    modifiers: [{ path: '', castShadows: false }]
  })
  return entity
}
