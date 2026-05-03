import {
  ColliderLayer,
  Entity,
  InputAction,
  RaycastQueryType,
  Transform,
  engine,
  raycastSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  Platform,
  PlatformUnderAttack
} from '../../components'
import { WATER_LEVEL } from '../../factories/sceneLevels'
import { RAFT_SIZE } from '../../factories/platform'

// Shared raft-builder helpers used by both placement and destruction
// sub-modules. Keeping the cell-key encoding, occupancy snapshot, and
// camera-forward raycast wiring in one place avoids drift between the
// two modes.

// 4-connected grid neighbours, used both to score placement candidates
// and to enumerate adjacent cells when laying down placement markers.
export const NEIGHBOUR_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

// Half-extent of the playable grid in cells. The scene is up to 50x50
// parcels (800m), and the main raft sits at parcel center; ±50 cells
// from origin keeps placements inside the parcel boundary with margin.
export const GRID_HALF_EXTENT = 50

// Minimum gap between successful placements/destroys to keep clicks from
// firing twice on the same frame and to give a small "casting" beat.
export const PLACE_COOLDOWN_MS = 1500

// Player must be standing on (or right at the edge of) the raft cell
// adjacent to the marker — at most one platform away. The camera sits
// ~1.8m above the deck, so the ray to a neighbour marker measures roughly
// √(RAFT_SIZE² + 1.8²) ≈ 6.3m; a small buffer over RAFT_SIZE keeps the
// hover/click reliable without letting the player reach two cells away.
export const PLACE_MAX_DISTANCE = RAFT_SIZE + 2

// Camera-forward continuous raycast tuning. CL_POINTER hits the placement
// click areas and existing platforms; open water has no collider, so we
// project the camera ray onto the water plane in the no-hit case.
export const PLACE_RAY_MAX_DISTANCE = 64
export const PLACE_RAY_FALLBACK_DISTANCE = 8
export const DESTROY_RAY_MAX_DISTANCE = 64

export const CAMERA_FORWARD = Vector3.create(0, 0, 1)

export const PLACE_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'Place raft',
  maxDistance: PLACE_MAX_DISTANCE
}

export const DESTROY_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'DELETE PLATFORM',
  maxDistance: 32
}

export function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

export function parseCellKey(key: string): [number, number] {
  const [gx, gz] = key.split(',')
  return [Number(gx), Number(gz)]
}

// Snapshot includes whether each platform is shark-locked, so the marker
// refresh fires when a platform becomes/stops being under attack — not
// just when one is added or removed.
export function computeOccupancySnapshot(): string {
  const keys: string[] = []
  for (const [entity, p] of engine.getEntitiesWith(Platform)) {
    const lock = PlatformUnderAttack.getOrNull(entity) !== null ? 'L' : ''
    keys.push(`${cellKey(p.gridX, p.gridZ)}${lock}`)
  }
  keys.sort()
  return keys.join('|')
}

// Computes where the camera-forward ray crosses the water plane (or lands
// at a fallback distance in front of the camera if the ray doesn't slope
// down). Used to anchor a "no valid target" cursor ghost when the
// camera-forward raycast hits no collider.
export function projectCameraToWaterPlane(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const forward = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  const downward = forward.y < -0.01
  const t = downward
    ? (WATER_LEVEL - cam.position.y) / forward.y
    : PLACE_RAY_FALLBACK_DISTANCE
  const clampedT =
    downward && (t < 0 || t > PLACE_RAY_MAX_DISTANCE)
      ? PLACE_RAY_FALLBACK_DISTANCE
      : t
  return Vector3.create(
    cam.position.x + forward.x * clampedT,
    downward ? WATER_LEVEL : cam.position.y + forward.y * clampedT,
    cam.position.z + forward.z * clampedT
  )
}

// Raycast handler signature used by both placement and destruction modes.
export type RaycastHandler = (result: {
  hits: ReadonlyArray<{
    entityId?: number
    position?: { x: number; y: number; z: number }
  }>
}) => void

// Registers a continuous camera-forward raycast against pointer colliders
// at the given max distance. Both modes share the same shape — only the
// max distance and the handler differ.
export function registerCameraForwardRaycast(
  maxDistance: number,
  handler: RaycastHandler
): void {
  raycastSystem.registerLocalDirectionRaycast(
    {
      entity: engine.CameraEntity,
      opts: {
        queryType: RaycastQueryType.RQT_HIT_FIRST,
        maxDistance,
        direction: CAMERA_FORWARD,
        continuous: true,
        collisionMask: ColliderLayer.CL_POINTER
      }
    },
    handler
  )
}

export function unregisterCameraForwardRaycast(): void {
  raycastSystem.removeRaycasterEntity(engine.CameraEntity)
}

// Re-exports used downstream so the outer barrel doesn't need to import
// this module.
export { Entity }
