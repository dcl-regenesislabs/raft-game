import {
  ColliderLayer,
  Entity,
  Material,
  MeshCollider,
  MeshRenderer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

const PLATFORM_SIZE_X = 6
const PLATFORM_SIZE_Y = 0.3
const PLATFORM_SIZE_Z = 6
const PLATFORM_COLOR = Color4.create(0.45, 0.30, 0.18, 1) // walnut wood

export function createPlatform(center: Vector3): Entity {
  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(center.x, center.y + PLATFORM_SIZE_Y / 2, center.z),
    scale: Vector3.create(PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z)
  })
  MeshRenderer.setBox(platform)
  MeshCollider.setBox(platform, ColliderLayer.CL_PHYSICS)
  Material.setPbrMaterial(platform, {
    albedoColor: PLATFORM_COLOR,
    roughness: 0.85,
    metallic: 0
  })

  return platform
}
