import {
  ColliderLayer,
  Entity,
  GltfContainer,
  Material,
  MeshCollider,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

import { MainPlatform, Platform } from '../components'
import { DEMO_PARCEL_GRID, PARCEL_SIZE_M, WATER_LEVEL } from './sceneLevels'

export const PLATFORM_SIZE_X = 3
export const PLATFORM_SIZE_Y = 0.3
export const PLATFORM_SIZE_Z = 3
export const PLATFORM_COLOR = Color4.create(0.45, 0.30, 0.18, 1) // walnut wood
export const PLATFORM_DESTROY_TINT = Color4.create(0.85, 0.18, 0.18, 1) // angry red

export function computeGridOrigin(parcelGrid: number): Vector3 {
  const halfExtent = (parcelGrid * PARCEL_SIZE_M) / 2
  return Vector3.create(halfExtent, WATER_LEVEL, halfExtent)
}

// Scene-local center of grid cell (0, 0). Every other raft sits at
// (GRID_ORIGIN.x + gridX * PLATFORM_SIZE_X, WATER_LEVEL, GRID_ORIGIN.z + gridZ * PLATFORM_SIZE_Z).
// Defaults to the 5x5 demo origin (40, _, 40); main() reconfigures it
// to (400, _, 400) when running on the 50x50 raft world. Exported as a
// `let` so ESM consumers see the live binding after configuration.
export let GRID_ORIGIN = computeGridOrigin(DEMO_PARCEL_GRID)
export const RAFT_SIZE = PLATFORM_SIZE_X

// Reconfigures the shared grid origin for the active scene mode. Must be
// called from main() before any factory or system that reads GRID_ORIGIN.
export function configureGridOrigin(parcelGrid: number): void {
  GRID_ORIGIN = computeGridOrigin(parcelGrid)
}

export type CreatePlatformOptions = {
  gridX?: number
  gridZ?: number
  isMain?: boolean
}

export function gridCellToWorld(gridX: number, gridZ: number): Vector3 {
  return Vector3.create(
    GRID_ORIGIN.x + gridX * RAFT_SIZE,
    GRID_ORIGIN.y,
    GRID_ORIGIN.z + gridZ * RAFT_SIZE
  )
}

export function createPlatform(
  center: Vector3,
  options: CreatePlatformOptions = {}
): Entity {
  const { gridX = 0, gridZ = 0, isMain = false } = options

  const platform = engine.addEntity()
  Transform.create(platform, {
    position: Vector3.create(center.x, center.y + PLATFORM_SIZE_Y / 2, center.z),
    scale: Vector3.create(PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z)
  })
  // CL_PHYSICS so the player can stand on it; CL_POINTER so hover/click events
  // (used by DESTROYING mode) register against the cursor. The collider
  // footprint is the authoritative raft hitbox — visual is a child GLB.
  MeshCollider.setBox(platform, [ColliderLayer.CL_PHYSICS, ColliderLayer.CL_POINTER])

  const visual = engine.addEntity()
  // Cancel the parent's non-uniform (X, Y, Z) = (3, 0.3, 3) scale, then apply
  // RAFT_VISUAL_SIZE so the model renders proportionally at the target world
  // size regardless of the parent's footprint scale.
  const visualSize = 1.7
  // World-space vertical nudge (meters). Negative = sink the raft slightly so
  // its deck flushes with the player walk surface. Divided by parent Y scale
  // because position is in the parent's local space.
  const visualYOffsetMeters = -0.15
  Transform.create(visual, {
    parent: platform,
    position: Vector3.create(0, visualYOffsetMeters / PLATFORM_SIZE_Y, 0),
    scale: Vector3.create(
      visualSize / PLATFORM_SIZE_X,
      visualSize / PLATFORM_SIZE_Y,
      visualSize / PLATFORM_SIZE_Z
    )
  })
  GltfContainer.create(visual, { src: 'assets/scene/items/raft.glb' })

  Platform.create(platform, { gridX, gridZ })
  if (isMain) MainPlatform.create(platform)

  return platform
}

// Re-applies the PBR material with the given albedo. Keeps roughness/metallic
// in lockstep with createPlatform so a tinted raft still looks like wood, just
// recoloured.
export function applyPlatformMaterial(entity: Entity, color: Color4): void {
  Material.setPbrMaterial(entity, {
    albedoColor: color,
    castShadows: false,
    roughness: 0.85,
    metallic: 0,
    // Kill skybox/IBL contribution so the wood reads the same regardless of
    // whatever sky the platform is floating against.
    specularIntensity: 0,
    reflectivityColor: Color3.Black()
  })
}

// Lerps the platform's albedo between PLATFORM_COLOR (t=0) and
// PLATFORM_DESTROY_TINT (t=1). Used by the shark director to pulse the
// targeted platform during the bite phase.
export function tintPlatform(entity: Entity, t: number): void {
  const u = t < 0 ? 0 : t > 1 ? 1 : t
  applyPlatformMaterial(
    entity,
    Color4.create(
      PLATFORM_COLOR.r + (PLATFORM_DESTROY_TINT.r - PLATFORM_COLOR.r) * u,
      PLATFORM_COLOR.g + (PLATFORM_DESTROY_TINT.g - PLATFORM_COLOR.g) * u,
      PLATFORM_COLOR.b + (PLATFORM_DESTROY_TINT.b - PLATFORM_COLOR.b) * u,
      1
    )
  )
}
