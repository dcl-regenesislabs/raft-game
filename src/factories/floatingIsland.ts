import {
  ColliderLayer,
  Entity,
  GltfContainer,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { FloatingIsland, IslandChest } from '../components'
import { createIslandChest, playChestCloseAnimation } from './islandChest'

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

// Pool state — populated by createFloatingIslandPool() once at scene boot.
// Every spawn reuses these entities by flipping visibility + collider mask.
let pooledRoot: Entity | null = null
let pooledVisual: Entity | null = null
let pooledChest: Entity | null = null
const pooledPalms: Entity[] = []

// One-time setup: builds the island hierarchy (root + visual + chest + palms)
// in its hidden/inactive state. Must be called from main() before any system
// that activates the island runs. Idempotent.
export function createFloatingIslandPool(): void {
  if (pooledRoot !== null) return

  const root = engine.addEntity()
  Transform.create(root, {
    position: Vector3.create(0, 0, 0),
    rotation: Quaternion.Identity(),
    scale: Vector3.One()
  })
  FloatingIsland.create(root, {
    velocityX: 0,
    velocityZ: 0,
    baseVelocityX: 0,
    baseVelocityZ: 0,
    lifetime: 0,
    maxLifetime: 0,
    deflecting: false,
    active: false
  })
  // Single visibility toggle for the whole hierarchy. Children inherit
  // because they have no own VisibilityComponent.
  VisibilityComponent.create(root, {
    visible: false,
    propagateToChildren: true
  })

  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: root,
    position: Vector3.create(0, Y_SUBMERSION, 0),
    rotation: Quaternion.Identity(),
    scale: Vector3.create(ISLAND_SCALE_XZ, ISLAND_SCALE_Y, ISLAND_SCALE_XZ)
  })
  GltfContainer.create(visual, {
    src: `assets/scene/island-v2-1.glb`,
    // Collider off until activation so the player can't stand on the
    // hidden island. Re-enabled in activateFloatingIsland.
    visibleMeshesCollisionMask: 0,
    invisibleMeshesCollisionMask: 0
  })

  const chest = createIslandChest(root)

  pooledRoot = root
  pooledVisual = visual
  pooledChest = chest
  spawnPalmPool(root)
}

// Activates the pooled island: re-rolls visual variant + palm transforms,
// re-enables visibility + collider, and stamps the spawn parameters onto
// the FloatingIsland component.
export function activateFloatingIsland(params: FloatingIslandParams): void {
  if (pooledRoot === null || pooledVisual === null || pooledChest === null) {
    return
  }
  const { position, velocity, maxLifetime } = params

  const rootTransform = Transform.getMutable(pooledRoot)
  rootTransform.position.x = position.x
  rootTransform.position.y = position.y
  rootTransform.position.z = position.z

  const island = FloatingIsland.getMutable(pooledRoot)
  island.velocityX = velocity.x
  island.velocityZ = velocity.z
  island.baseVelocityX = velocity.x
  island.baseVelocityZ = velocity.z
  island.lifetime = 0
  island.maxLifetime = maxLifetime
  island.deflecting = false
  island.active = true

  const variant = Math.floor(Math.random() * ISLAND_COUNT) + 1
  GltfContainer.createOrReplace(pooledVisual, {
    src: `assets/scene/island-v2-${variant}.glb`,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: 0
  })
  const visualTransform = Transform.getMutable(pooledVisual)
  visualTransform.rotation = Quaternion.fromEulerDegrees(0, Math.random() * 360, 0)

  // Re-randomize palm transforms each activation so repeat appearances
  // don't read as the same island.
  rerollPalmTransforms()

  // Reset chest interaction state and visual.
  const chestState = IslandChest.getMutableOrNull(pooledChest)
  if (chestState !== null) {
    chestState.opened = false
  }
  playChestCloseAnimation(pooledChest)

  VisibilityComponent.createOrReplace(pooledRoot, {
    visible: true,
    propagateToChildren: true
  })
}

// Hides the pooled island and disables its collider. Gameplay queries
// gate on FloatingIsland.active; this also strips the collider mask so the
// player can't stand on the invisible shell.
export function deactivateFloatingIsland(): void {
  if (pooledRoot === null || pooledVisual === null) return

  const island = FloatingIsland.getMutable(pooledRoot)
  island.active = false
  island.velocityX = 0
  island.velocityZ = 0
  island.baseVelocityX = 0
  island.baseVelocityZ = 0
  island.deflecting = false

  const gltf = GltfContainer.getMutableOrNull(pooledVisual)
  if (gltf !== null) {
    gltf.visibleMeshesCollisionMask = 0
  }

  VisibilityComponent.createOrReplace(pooledRoot, {
    visible: false,
    propagateToChildren: true
  })
}

function spawnPalmPool(root: Entity): void {
  for (let variant = 1; variant <= PALM_COUNT; variant++) {
    for (let instance = 0; instance < 2; instance++) {
      const palm = engine.addEntity()
      Transform.create(palm, {
        parent: root,
        position: Vector3.create(0, SURFACE_Y + 1.75, 0),
        rotation: Quaternion.Identity(),
        scale: Vector3.One()
      })
      GltfContainer.create(palm, {
        src: `assets/scene/palm-${variant}.glb`
      })
      pooledPalms.push(palm)
    }
  }
}

function rerollPalmTransforms(): void {
  for (const palm of pooledPalms) {
    const angle = Math.random() * Math.PI * 2
    const radius = PALM_RADIUS_MIN + Math.random() * (PALM_RADIUS_MAX - PALM_RADIUS_MIN)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius

    const s = PALM_BASE_SCALE + (Math.random() * 2 - 1) * PALM_SCALE_JITTER
    const yawDeg = Math.random() * 360
    const leanDeg = Math.random() * 8
    const leanAxisRad = Math.random() * Math.PI * 2

    const t = Transform.getMutable(palm)
    t.position.x = x
    t.position.y = SURFACE_Y + 1.75
    t.position.z = z
    t.rotation = Quaternion.fromEulerDegrees(
      leanDeg * Math.cos(leanAxisRad),
      yawDeg,
      leanDeg * Math.sin(leanAxisRad)
    )
    t.scale.x = s
    t.scale.y = s
    t.scale.z = s
  }
}
