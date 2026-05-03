import {
  ColliderLayer,
  Entity,
  MeshCollider,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PlacementMarker } from '../components'
import {
  PLATFORM_SIZE_X,
  PLATFORM_SIZE_Y,
  PLATFORM_SIZE_Z,
  gridCellToWorld
} from './platform'

// Full-footprint invisible hitbox per vacant placement cell. No MeshRenderer
// (so it doesn't draw) but a CL_POINTER collider so the cursor registers
// anywhere across the candidate platform area, not just on the small marker
// pip. Tagged with PlacementMarker so the builder's wipe-all sweep removes
// it alongside the pip when leaving PLACING mode.
export function createPlacementClickArea(gridX: number, gridZ: number): Entity {
  const cell = gridCellToWorld(gridX, gridZ)
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(cell.x, cell.y + PLATFORM_SIZE_Y / 2, cell.z),
    scale: Vector3.create(PLATFORM_SIZE_X, PLATFORM_SIZE_Y, PLATFORM_SIZE_Z)
  })
  MeshCollider.setBox(entity, [ColliderLayer.CL_POINTER])
  PlacementMarker.create(entity, { gridX, gridZ })
  return entity
}
