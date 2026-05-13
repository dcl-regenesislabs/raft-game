import {
  ColliderLayer,
  Entity,
  GltfContainer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { FloatingIsland } from '../components'

const ISLAND_COUNT = 4
const ISLAND_SCALE_XZ = 5.0
const ISLAND_SCALE_Y = 2.0
// How far below water level the island sits so it looks partially submerged
const Y_SUBMERSION = -0.3

export interface FloatingIslandParams {
  position: Vector3
  velocity: Vector3
  maxLifetime: number
}

export function createFloatingIsland(params: FloatingIslandParams): Entity {
  const { position, velocity, maxLifetime } = params
  const variant = Math.floor(Math.random() * ISLAND_COUNT) + 1
  const entity = engine.addEntity()
  const yawDeg = Math.random() * 360

  Transform.create(entity, {
    position: Vector3.create(position.x, position.y + Y_SUBMERSION, position.z),
    rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
    scale: Vector3.create(ISLAND_SCALE_XZ, ISLAND_SCALE_Y, ISLAND_SCALE_XZ)
  })

  // Use the visible mesh as physics collider (no _collider meshes in the GLB)
  GltfContainer.create(entity, {
    src: `assets/scene/island-${variant}.glb`,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: 0
  })

  FloatingIsland.create(entity, {
    velocityX: velocity.x,
    velocityZ: velocity.z,
    baseVelocityX: velocity.x,
    baseVelocityZ: velocity.z,
    lifetime: 0,
    maxLifetime,
    deflecting: false
  })

  return entity
}
