import {
  ColliderLayer,
  Entity,
  Material,
  MeshCollider,
  MeshRenderer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

import { MainPlatform, Platform } from '../components'
import { WATER_LEVEL } from './sceneLevels'

export const PLATFORM_SIZE_X = 6
export const PLATFORM_SIZE_Y = 0.3
export const PLATFORM_SIZE_Z = 6
export const PLATFORM_COLOR = Color4.create(0.45, 0.30, 0.18, 1) // walnut wood
export const PLATFORM_DESTROY_TINT = Color4.create(0.85, 0.18, 0.18, 1) // angry red

// World center of grid cell (0, 0). Every other raft sits at
// (GRID_ORIGIN.x + gridX * PLATFORM_SIZE_X, WATER_LEVEL, GRID_ORIGIN.z + gridZ * PLATFORM_SIZE_Z).
// Centered for a 50x50 parcel scene (50 * 16 / 2 = 400).
export const GRID_ORIGIN = Vector3.create(400, WATER_LEVEL, 400)
export const RAFT_SIZE = PLATFORM_SIZE_X

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
  MeshRenderer.setBox(platform)
  // CL_PHYSICS so the player can stand on it; CL_POINTER so hover/click events
  // (used by DESTROYING mode) register against the cursor.
  MeshCollider.setBox(platform, [ColliderLayer.CL_PHYSICS, ColliderLayer.CL_POINTER])
  applyPlatformMaterial(platform, PLATFORM_COLOR)

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
