import {
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

const HOOK_SRC = 'assets/scene/items/hook.glb'
const HOOK_SCALE = Vector3.create(0.35, 0.35, 0.35)
// Local model rotation that re-aligns the GLB's native axes so its "forward"
// (the direction the hook tip points along its flight path) maps to world
// +Z. The hookThrower then composes a heading rotation on top of this so the
// thrown hook visibly faces its direction of motion.
export const HOOK_FORWARD_ROTATION = Quaternion.fromEulerDegrees(90, 0, 0)

export function createHookEntity(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(0, 0, 0),
    rotation: HOOK_FORWARD_ROTATION,
    scale: HOOK_SCALE
  })
  GltfContainer.create(entity, { src: HOOK_SRC })
  GltfNodeModifiers.create(entity, {
    modifiers: [{ path: '', castShadows: false }]
  })
  return entity
}

// Stationary reference hook for tuning HOOK_REST_ROTATION. Rendered with
// identity rotation so the GLB's native axes are visible — walk around it
// and call out which way the shaft / point faces.
export function createReferenceHook(position: Vector3): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position,
    rotation: HOOK_FORWARD_ROTATION,
    scale: HOOK_SCALE
  })
  GltfContainer.create(entity, { src: HOOK_SRC })
  GltfNodeModifiers.create(entity, {
    modifiers: [{ path: '', castShadows: false }]
  })
  return entity
}
