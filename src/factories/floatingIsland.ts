import {
  ColliderLayer,
  Entity,
  GltfContainer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { FloatingIsland } from '../components'
import { createIslandChest } from './islandChest'

const ISLAND_COUNT = 4
const ISLAND_SCALE_XZ = 5.0
const ISLAND_SCALE_Y = 2.0
// How far below water level the island mesh sits so it looks partially submerged
const Y_SUBMERSION = -0.3

// Palm tree tunables
const PALM_COUNT = 2
const PALM_BASE_SCALE = 4.5
const PALM_SCALE_JITTER = 1.0
const PALM_RADIUS_MIN = 1.5
const PALM_RADIUS_MAX = 3.0
// Y for palm base and chest — island surface in world units above the root
const SURFACE_Y = 0.5

export interface FloatingIslandParams {
  position: Vector3
  velocity: Vector3
  maxLifetime: number
}

export interface IslandContentConfig {
  chest: boolean
}

const DEFAULT_CONTENT: IslandContentConfig = {
  chest: true
}

export function createFloatingIsland(
  params: FloatingIslandParams,
  content: IslandContentConfig = DEFAULT_CONTENT
): Entity {
  const { position, velocity, maxLifetime } = params
  const variant = Math.floor(Math.random() * ISLAND_COUNT) + 1
  const yawDeg = Math.random() * 360

  // Root entity: no scale, no rotation. This is the "loot island" entity
  // that drifts. All children (mesh, chest, palms) move with it.
  const root = engine.addEntity()
  Transform.create(root, {
    position: Vector3.create(position.x, position.y, position.z),
    rotation: Quaternion.Identity(),
    scale: Vector3.One()
  })

  FloatingIsland.create(root, {
    velocityX: velocity.x,
    velocityZ: velocity.z,
    baseVelocityX: velocity.x,
    baseVelocityZ: velocity.z,
    lifetime: 0,
    maxLifetime,
    deflecting: false
  })

  // Child: island visual mesh (scaled, rotated, submerged)
  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: root,
    position: Vector3.create(0, Y_SUBMERSION, 0),
    rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
    scale: Vector3.create(ISLAND_SCALE_XZ, ISLAND_SCALE_Y, ISLAND_SCALE_XZ)
  })
  GltfContainer.create(visual, {
    src: `assets/scene/island-v2-${variant}.glb`,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: 0
  })

  // Child: chest at center, on the surface
  if (content.chest) {
    createIslandChest(root)
  }

  // Children: palm trees
  spawnPalmTrees(root)

  return root
}

function spawnPalmTrees(root: Entity): void {
  for (let variant = 1; variant <= PALM_COUNT; variant++) {
    for (let instance = 0; instance < 2; instance++) {
      const angle = Math.random() * Math.PI * 2
      const radius = PALM_RADIUS_MIN + Math.random() * (PALM_RADIUS_MAX - PALM_RADIUS_MIN)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius

      const s = PALM_BASE_SCALE + (Math.random() * 2 - 1) * PALM_SCALE_JITTER
      const yawDeg = Math.random() * 360
      const leanDeg = Math.random() * 8
      const leanAxisRad = Math.random() * Math.PI * 2

      const palm = engine.addEntity()
      Transform.create(palm, {
        parent: root,
        // Raise palms so the trunk is visible above the island surface
        position: Vector3.create(x, SURFACE_Y + 1.75, z),
        rotation: Quaternion.fromEulerDegrees(
          leanDeg * Math.cos(leanAxisRad),
          yawDeg,
          leanDeg * Math.sin(leanAxisRad)
        ),
        scale: Vector3.create(s, s, s)
      })
      GltfContainer.create(palm, {
        src: `assets/scene/palm-${variant}.glb`
      })
    }
  }
}
