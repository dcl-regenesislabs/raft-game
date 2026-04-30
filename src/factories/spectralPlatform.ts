import {
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

import { PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z } from './platform'

const SPECTRAL_COLOR = Color4.create(0.2, 1, 0.4, 0.35)

// Singleton "ghost" raft used as a hover preview in PLACING mode. Created once
// at scene init and parked at scale 0; the builder system repositions it onto
// whichever placement marker the player is hovering and toggles scale to show
// or hide it. No collider — it must not block the click that lands on the
// underlying marker.
export function createSpectralPlatform(): Entity {
  const ghost = engine.addEntity()
  Transform.create(ghost, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(0, 0, 0)
  })
  MeshRenderer.setBox(ghost)
  Material.setPbrMaterial(ghost, {
    albedoColor: SPECTRAL_COLOR,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false,
    roughness: 1,
    metallic: 0
  })
  return ghost
}

export function showSpectralAt(ghost: Entity, world: Vector3): void {
  const transform = Transform.getMutable(ghost)
  transform.position = Vector3.create(world.x, world.y + PLATFORM_SIZE_Y / 2, world.z)
  transform.scale = Vector3.create(PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z)
}

export function hideSpectral(ghost: Entity): void {
  Transform.getMutable(ghost).scale = Vector3.create(0, 0, 0)
}
