import {
  ColliderLayer,
  Entity,
  InputAction,
  PointerEventType,
  RaycastQueryType,
  engine,
  inputSystem,
  pointerEventsSystem,
  raycastSystem
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import {
  MainPlatform,
  PlacementMarker,
  Platform,
  PlatformUnderAttack
} from '../components'
import {
  GRID_ORIGIN,
  PLATFORM_COLOR,
  PLATFORM_DESTROY_TINT,
  RAFT_SIZE,
  applyPlatformMaterial,
  createPlatform,
  gridCellToWorld
} from '../factories/platform'
import { createPlacementMarker } from '../factories/placementMarker'
import {
  createSpectralPlatform,
  hideSpectral,
  showSpectralAt
} from '../factories/spectralPlatform'

type Mode = 'idle' | 'placing' | 'destroying'

// Half-extent of the playable grid in cells. The scene is 50x50 parcels
// (800m), and the main raft sits at parcel center; ±50 cells from origin
// keeps placements inside the parcel boundary with a healthy margin.
const GRID_HALF_EXTENT = 50

// Minimum gap between successful placements to keep clicks from firing twice
// on the same frame and to give a small "casting" beat.
const PLACE_COOLDOWN_MS = 1500

// onPointerDown opts. CL_POINTER colliders + IA_POINTER make the click work
// regardless of which mouse button DCL is currently mapping to action.
const PLACE_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'Place raft',
  maxDistance: 32
}

const DESTROY_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'DELETE PLATFORM',
  maxDistance: 32
}

let mode: Mode = 'idle'
let spectralEntity: Entity | null = null
let lastPlaceMs = 0
// The non-main raft the cursor is currently over while in DESTROYING mode.
// Drives the in-world tint and the on-screen "DELETE PLATFORM" banner.
let destroyHoverEntity: Entity | null = null
// Sorted occupancy hash ("gx,gz|gx,gz|…") captured the last time placement
// markers were synced. Lets the system detect external changes — sharks
// eating a platform, players destroying one — and refresh markers in
// PLACING mode without coupling raftBuilder to those callers.
let lastPlacingOccupancy = ''

export function getRaftBuilderMode(): Mode {
  return mode
}

export function getDestroyHoverTarget(): Entity | null {
  return destroyHoverEntity
}

export function raftBuilderSystem(): void {
  const togglePlacing = inputSystem.isTriggered(
    InputAction.IA_ACTION_3,
    PointerEventType.PET_DOWN
  )
  const toggleDestroying = inputSystem.isTriggered(
    InputAction.IA_ACTION_4,
    PointerEventType.PET_DOWN
  )

  if (togglePlacing) {
    setMode(mode === 'placing' ? 'idle' : 'placing')
  } else if (toggleDestroying) {
    setMode(mode === 'destroying' ? 'idle' : 'destroying')
  }

  if (mode === 'placing') {
    const snapshot = computeOccupancySnapshot()
    if (snapshot !== lastPlacingOccupancy) {
      removeAllMarkers()
      spawnMarkersForVacantNeighbours()
      lastPlacingOccupancy = snapshot
    }
  }

  if (mode === 'destroying') {
    // A platform may become shark-locked AFTER we entered destroy mode.
    // Strip its onPointerDown so the "DELETE PLATFORM" hover text and
    // cursor feedback disappear — the runtime guard inside the click
    // callback already blocks the destroy action itself.
    for (const [entity] of engine.getEntitiesWith(Platform, PlatformUnderAttack)) {
      pointerEventsSystem.removeOnPointerDown(entity)
    }
  }
}

function setMode(next: Mode): void {
  if (next === mode) return
  exitMode(mode)
  mode = next
  enterMode(next)
}

function enterMode(next: Mode): void {
  if (next === 'placing') enterPlacing()
  else if (next === 'destroying') enterDestroying()
}

function exitMode(prev: Mode): void {
  if (prev === 'placing') exitPlacing()
  else if (prev === 'destroying') exitDestroying()
}

// ---------- PLACING ----------

function enterPlacing(): void {
  if (spectralEntity === null) {
    spectralEntity = createSpectralPlatform()
  }
  hideSpectral(spectralEntity)
  spawnMarkersForVacantNeighbours()
  lastPlacingOccupancy = computeOccupancySnapshot()
}

function exitPlacing(): void {
  removeAllMarkers()
  if (spectralEntity !== null) hideSpectral(spectralEntity)
  lastPlacingOccupancy = ''
}

function spawnMarkersForVacantNeighbours(): void {
  // Occupancy still includes under-attack platforms so we don't spawn a
  // marker on top of one — but we expand the perimeter only from
  // platforms that are NOT shark-locked. A cell adjacent only to a
  // doomed platform stays unmarkable; a cell adjacent to any healthy
  // platform is still extendable.
  const occupied = new Set<string>()
  for (const [, p] of engine.getEntitiesWith(Platform)) {
    occupied.add(cellKey(p.gridX, p.gridZ))
  }

  const vacant = new Set<string>()
  for (const [entity, p] of engine.getEntitiesWith(Platform)) {
    if (PlatformUnderAttack.getOrNull(entity) !== null) continue
    for (const [dx, dz] of NEIGHBOUR_DELTAS) {
      const nx = p.gridX + dx
      const nz = p.gridZ + dz
      if (Math.abs(nx) > GRID_HALF_EXTENT || Math.abs(nz) > GRID_HALF_EXTENT) continue
      const nkey = cellKey(nx, nz)
      if (occupied.has(nkey)) continue
      vacant.add(nkey)
    }
  }

  for (const key of vacant) {
    const [gx, gz] = parseCellKey(key)
    const marker = createPlacementMarker(gx, gz)
    attachPlacementCallbacks(marker, gx, gz)
  }
}

function attachPlacementCallbacks(marker: Entity, gx: number, gz: number): void {
  pointerEventsSystem.onPointerHoverEnter(
    { entity: marker, opts: PLACE_OPTS },
    () => {
      if (spectralEntity === null) return
      showSpectralAt(spectralEntity, gridCellToWorld(gx, gz))
    }
  )
  pointerEventsSystem.onPointerHoverLeave(
    { entity: marker, opts: PLACE_OPTS },
    () => {
      if (spectralEntity === null) return
      hideSpectral(spectralEntity)
    }
  )
  pointerEventsSystem.onPointerDown(
    { entity: marker, opts: PLACE_OPTS },
    () => {
      const now = Date.now()
      if (now - lastPlaceMs < PLACE_COOLDOWN_MS) return
      lastPlaceMs = now
      placeRaft(gx, gz)
    }
  )
}

function placeRaft(gridX: number, gridZ: number): void {
  createPlatform(gridCellToWorld(gridX, gridZ), { gridX, gridZ })
  removeAllMarkers()
  if (spectralEntity !== null) hideSpectral(spectralEntity)
  // Re-spawn around the new occupancy set so the perimeter keeps growing.
  spawnMarkersForVacantNeighbours()
  lastPlacingOccupancy = computeOccupancySnapshot()
}

function removeAllMarkers(): void {
  const toRemove: Entity[] = []
  for (const [entity] of engine.getEntitiesWith(PlacementMarker)) {
    toRemove.push(entity)
  }
  for (const entity of toRemove) engine.removeEntity(entity)
}

// ---------- DESTROYING ----------

// Hover detection runs as a continuous camera-forward raycast rather than via
// pointerEventsSystem hover callbacks. Hover-enter is edge-triggered, so if
// the cursor is already on a raft when the player presses 2, no enter event
// fires and the tint never appears. Polling each frame avoids that hole.
const DESTROY_RAY_MAX_DISTANCE = 64
const CAMERA_FORWARD = Vector3.create(0, 0, 1)

function enterDestroying(): void {
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    // Skip platforms a shark has already chosen — locked until the bite
    // resolves. Platforms targeted later are caught by the runtime check
    // inside attachDestroyClick's callback.
    if (PlatformUnderAttack.getOrNull(entity) !== null) continue
    attachDestroyClick(entity)
  }
  raycastSystem.registerLocalDirectionRaycast(
    {
      entity: engine.CameraEntity,
      opts: {
        queryType: RaycastQueryType.RQT_HIT_FIRST,
        maxDistance: DESTROY_RAY_MAX_DISTANCE,
        direction: CAMERA_FORWARD,
        continuous: true,
        collisionMask: ColliderLayer.CL_POINTER
      }
    },
    handleDestroyRaycast
  )
}

function exitDestroying(): void {
  raycastSystem.removeRaycasterEntity(engine.CameraEntity)
  if (destroyHoverEntity !== null) {
    if (Platform.getOrNull(destroyHoverEntity) !== null) {
      applyPlatformMaterial(destroyHoverEntity, PLATFORM_COLOR)
    }
    destroyHoverEntity = null
  }
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    pointerEventsSystem.removeOnPointerDown(entity)
  }
}

function attachDestroyClick(entity: Entity): void {
  pointerEventsSystem.onPointerDown(
    { entity, opts: DESTROY_OPTS },
    () => {
      if (MainPlatform.getOrNull(entity) !== null) return
      // Locked while a shark is committed to this platform.
      if (PlatformUnderAttack.getOrNull(entity) !== null) return
      if (destroyHoverEntity === entity) destroyHoverEntity = null
      engine.removeEntity(entity)
    }
  )
}

function handleDestroyRaycast(result: { hits: ReadonlyArray<{ entityId?: number }> }): void {
  if (mode !== 'destroying') return

  let next: Entity | null = null
  const firstId = result.hits[0]?.entityId
  if (firstId !== undefined) {
    const candidate = firstId as Entity
    if (
      Platform.getOrNull(candidate) !== null &&
      MainPlatform.getOrNull(candidate) === null &&
      // Don't paint the destroy tint on a shark-locked platform — it's
      // already pulsing red from the bite, and it can't be destroyed.
      PlatformUnderAttack.getOrNull(candidate) === null
    ) {
      next = candidate
    }
  }

  if (next === destroyHoverEntity) return

  if (
    destroyHoverEntity !== null &&
    Platform.getOrNull(destroyHoverEntity) !== null
  ) {
    applyPlatformMaterial(destroyHoverEntity, PLATFORM_COLOR)
  }
  destroyHoverEntity = next
  if (destroyHoverEntity !== null) {
    applyPlatformMaterial(destroyHoverEntity, PLATFORM_DESTROY_TINT)
  }
}

// ---------- helpers ----------

const NEIGHBOUR_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`
}

function parseCellKey(key: string): [number, number] {
  const [gx, gz] = key.split(',')
  return [Number(gx), Number(gz)]
}

// Snapshot includes whether each platform is shark-locked, so the marker
// refresh fires when a platform becomes/stops being under attack — not
// just when one is added or removed.
function computeOccupancySnapshot(): string {
  const keys: string[] = []
  for (const [entity, p] of engine.getEntitiesWith(Platform)) {
    const lock = PlatformUnderAttack.getOrNull(entity) !== null ? 'L' : ''
    keys.push(`${cellKey(p.gridX, p.gridZ)}${lock}`)
  }
  keys.sort()
  return keys.join('|')
}

// Re-export so callers don't need to reach into the factory.
export { GRID_ORIGIN, RAFT_SIZE }
