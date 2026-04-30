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

import { PlacementMarker } from '../components'
import { gridCellToWorld } from './platform'

const MARKER_RADIUS = 0.6
const MARKER_HEIGHT = 0.1
// Sit just above the water surface so it pokes through visibly.
const MARKER_Y_OFFSET = 0.05
const MARKER_COLOR = Color4.create(0.2, 1, 0.4, 1)

// Small clickable "place here" pip rendered around an existing raft. The
// builder system attaches hover + click callbacks via pointerEventsSystem so a
// MeshCollider is required for the cursor to register. Tagged with
// PlacementMarker so the system can wipe all of them when leaving PLACING mode.
export function createPlacementMarker(gridX: number, gridZ: number): Entity {
  const cell = gridCellToWorld(gridX, gridZ)
  const marker = engine.addEntity()
  Transform.create(marker, {
    position: Vector3.create(cell.x, cell.y + MARKER_Y_OFFSET, cell.z),
    scale: Vector3.create(MARKER_RADIUS * 2, MARKER_HEIGHT, MARKER_RADIUS * 2)
  })
  MeshRenderer.setCylinder(marker)
  MeshCollider.setCylinder(marker, undefined, undefined, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(marker, {
    albedoColor: MARKER_COLOR,
    emissiveColor: { r: 0.1, g: 0.6, b: 0.2 },
    emissiveIntensity: 1.5,
    castShadows: false,
    roughness: 0.6,
    metallic: 0
  })
  PlacementMarker.create(marker, { gridX, gridZ })
  return marker
}
