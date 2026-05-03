import {
  ColliderLayer,
  Entity,
  InputAction,
  RaycastQueryType,
  Transform,
  engine,
  pointerEventsSystem,
  raycastSystem
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import {
  MainPlatform,
  PlacementMarker,
  Platform,
  PlatformUnderAttack
} from '../components'
import { actionButtonJustPressed } from '../ui/actionButton'
import { getSelectedSlot, getSlotPressCount } from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import {
  GRID_ORIGIN,
  PLATFORM_COLOR,
  PLATFORM_DESTROY_TINT,
  RAFT_SIZE,
  applyPlatformMaterial,
  createPlatform,
  gridCellToWorld
} from '../factories/platform'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { createPlacementClickArea } from '../factories/placementClickArea'
import { triggerHammerSwing } from './hammerSwing'
import {
  createSpectralPlatform,
  hideSpectral,
  showSpectralAt,
  tickSpectralBlink
} from '../factories/spectralPlatform'

type Mode = 'idle' | 'placing' | 'destroying'

// Inventory slot index for the hammer. Selecting it enters placing mode;
// pressing it again while already selected toggles to destroying, and again
// back to placing. Selecting any other slot returns to idle.
const HAMMER_SLOT = 1

// Half-extent of the playable grid in cells. The scene is 50x50 parcels
// (800m), and the main raft sits at parcel center; ±50 cells from origin
// keeps placements inside the parcel boundary with a healthy margin.
const GRID_HALF_EXTENT = 50

// Minimum gap between successful placements to keep clicks from firing twice
// on the same frame and to give a small "casting" beat.
const PLACE_COOLDOWN_MS = 1500

// Player must be standing on (or right at the edge of) the raft cell that's
// adjacent to the marker — i.e. at most one platform away. The camera sits
// ~1.8m above the deck, so the ray to a neighbour marker measures roughly
// √(RAFT_SIZE² + 1.8²) ≈ 6.3m; a small buffer over RAFT_SIZE keeps the
// hover/click reliable without letting the player reach two cells away.
const PLACE_MAX_DISTANCE = RAFT_SIZE + 2

// onPointerDown opts. CL_POINTER colliders + IA_POINTER make the click work
// regardless of which mouse button DCL is currently mapping to action.
const PLACE_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'Place raft',
  maxDistance: PLACE_MAX_DISTANCE
}

const DESTROY_OPTS = {
  button: InputAction.IA_POINTER,
  hoverText: 'DELETE PLATFORM',
  maxDistance: 32
}

// Red palette for the cursor-following "invalid placement" hologram. Stays
// solid red — no blink — so it reads clearly as a "not here" indicator vs
// the pulsing green "valid placement" preview.
const RED_GHOST_DIM = Color4.create(1, 0.2, 0.2, 0.55)
const RED_GHOST_BRIGHT = Color4.create(1, 0.2, 0.2, 0.55)

// Camera-forward continuous raycast tuning for PLACING mode. CL_POINTER hits
// the placement click areas (valid spots) and existing platforms (block the
// preview). Open water has no collider, so we project the camera ray onto
// the water plane in the no-hit case.
const PLACE_RAY_MAX_DISTANCE = 64
const PLACE_RAY_FALLBACK_DISTANCE = 8
const CAMERA_FORWARD = Vector3.create(0, 0, 1)

let mode: Mode = 'idle'
// Green "valid placement" preview, snapped to the hovered click-area cell.
let validGhost: Entity | null = null
// Red "invalid placement" preview, follows the camera-forward cursor.
let cursorGhost: Entity | null = null
// Latest placement target derived from the camera raycast, refreshed each
// frame by handlePlaceRaycast. Either a valid grid cell or a free-form world
// point on the water plane / surface the cursor is pointing at.
let placeHoverCell: { gx: number; gz: number } | null = null
let placeCursorWorld: Vector3 | null = null
let lastPlaceMs = 0
// Last hammer-slot press count we acted on. Lets us detect re-presses
// (selection unchanged but slot pressed again) to toggle place ↔ destroy.
let lastHammerPressCount = 0
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

export function raftBuilderSystem(dt: number): void {
  syncModeToInventory()

  if (mode === 'placing') {
    const snapshot = computeOccupancySnapshot()
    if (snapshot !== lastPlacingOccupancy) {
      removeAllMarkers()
      spawnMarkersForVacantNeighbours()
      lastPlacingOccupancy = snapshot
    }
    updatePlacementPreview(dt)
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

  // Mobile: the action button is the canonical commit input. Desktop wires
  // place/destroy to per-entity pointerEventsSystem callbacks already. Both
  // are gated on inventory state — see the click handlers below.
  if (isMobile() && !isInventoryActionLocked() && actionButtonJustPressed()) {
    if (mode === 'placing') commitPlaceFromHover()
    else if (mode === 'destroying') commitDestroyFromHover()
  }
}

function commitPlaceFromHover(): void {
  if (placeHoverCell === null) return
  const now = Date.now()
  if (now - lastPlaceMs < PLACE_COOLDOWN_MS) return
  lastPlaceMs = now
  placeRaft(placeHoverCell.gx, placeHoverCell.gz)
}

function commitDestroyFromHover(): void {
  if (destroyHoverEntity === null) return
  if (MainPlatform.getOrNull(destroyHoverEntity) !== null) return
  if (PlatformUnderAttack.getOrNull(destroyHoverEntity) !== null) return
  const target = destroyHoverEntity
  destroyHoverEntity = null
  engine.removeEntity(target)
  triggerHammerSwing()
}

// Drive mode transitions from inventory selection: hammer slot enters/toggles
// place/destroy, any other slot returns to idle. Re-presses of the hammer
// slot (counter delta) flip placing ↔ destroying without leaving the slot.
function syncModeToInventory(): void {
  const pressCount = getSlotPressCount(HAMMER_SLOT)
  const newPress = pressCount > lastHammerPressCount
  lastHammerPressCount = pressCount

  if (getSelectedSlot() !== HAMMER_SLOT) {
    if (mode !== 'idle') setMode('idle')
    return
  }

  if (!newPress) return
  setMode(mode === 'placing' ? 'destroying' : 'placing')
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
  if (validGhost === null) {
    validGhost = createSpectralPlatform()
  }
  if (cursorGhost === null) {
    cursorGhost = createSpectralPlatform({
      dim: RED_GHOST_DIM,
      bright: RED_GHOST_BRIGHT
    })
  }
  hideSpectral(validGhost)
  hideSpectral(cursorGhost)
  placeHoverCell = null
  placeCursorWorld = null
  spawnMarkersForVacantNeighbours()
  lastPlacingOccupancy = computeOccupancySnapshot()
  raycastSystem.registerLocalDirectionRaycast(
    {
      entity: engine.CameraEntity,
      opts: {
        queryType: RaycastQueryType.RQT_HIT_FIRST,
        maxDistance: PLACE_RAY_MAX_DISTANCE,
        direction: CAMERA_FORWARD,
        continuous: true,
        collisionMask: ColliderLayer.CL_POINTER
      }
    },
    handlePlaceRaycast
  )
}

function exitPlacing(): void {
  raycastSystem.removeRaycasterEntity(engine.CameraEntity)
  removeAllMarkers()
  if (validGhost !== null) hideSpectral(validGhost)
  if (cursorGhost !== null) hideSpectral(cursorGhost)
  placeHoverCell = null
  placeCursorWorld = null
  lastPlacingOccupancy = ''
}

// Updates the green/red ghost positioning each frame from the latest raycast
// state captured by handlePlaceRaycast. Green wins when the camera ray hits
// a valid placement click area; red follows the cursor's world position
// otherwise.
function updatePlacementPreview(dt: number): void {
  if (validGhost === null || cursorGhost === null) return
  if (placeHoverCell !== null) {
    showSpectralAt(validGhost, gridCellToWorld(placeHoverCell.gx, placeHoverCell.gz))
    tickSpectralBlink(validGhost, dt)
    hideSpectral(cursorGhost)
    return
  }
  hideSpectral(validGhost)
  if (placeCursorWorld !== null) {
    showSpectralAt(cursorGhost, placeCursorWorld)
  } else {
    hideSpectral(cursorGhost)
  }
}

function handlePlaceRaycast(result: { hits: ReadonlyArray<{ entityId?: number; position?: { x: number; y: number; z: number } }> }): void {
  if (mode !== 'placing') return
  const firstHit = result.hits[0]
  if (firstHit !== undefined && firstHit.entityId !== undefined) {
    const entity = firstHit.entityId as Entity
    const marker = PlacementMarker.getOrNull(entity)
    if (marker !== null) {
      placeHoverCell = { gx: marker.gridX, gz: marker.gridZ }
      placeCursorWorld = null
      return
    }
    placeHoverCell = null
    if (firstHit.position !== undefined) {
      placeCursorWorld = Vector3.create(
        firstHit.position.x,
        firstHit.position.y,
        firstHit.position.z
      )
      return
    }
  }
  placeHoverCell = null
  placeCursorWorld = projectCameraToWaterPlane()
}

// Computes where the camera-forward ray crosses the water plane (or lands at
// a fallback distance in front of the camera if the ray doesn't slope down).
// Used to anchor the red cursor ghost when the ray hits no collider — open
// water and the seabed have none, so most "looking out across the sea" rays
// land here.
function projectCameraToWaterPlane(): Vector3 | null {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (cam === null) return null
  const forward = Vector3.rotate(CAMERA_FORWARD, cam.rotation as Quaternion)
  const downward = forward.y < -0.01
  const t = downward
    ? (WATER_LEVEL - cam.position.y) / forward.y
    : PLACE_RAY_FALLBACK_DISTANCE
  const clampedT = downward && (t < 0 || t > PLACE_RAY_MAX_DISTANCE)
    ? PLACE_RAY_FALLBACK_DISTANCE
    : t
  return Vector3.create(
    cam.position.x + forward.x * clampedT,
    downward ? WATER_LEVEL : cam.position.y + forward.y * clampedT,
    cam.position.z + forward.z * clampedT
  )
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
    const clickArea = createPlacementClickArea(gx, gz)
    attachPlacementClick(clickArea, gx, gz)
  }
}

// Hover state is driven by the camera-forward raycast in handlePlaceRaycast,
// so the click area only carries the onPointerDown to register the placement
// action — no hoverEnter/Leave callbacks needed.
function attachPlacementClick(clickArea: Entity, gx: number, gz: number): void {
  pointerEventsSystem.onPointerDown(
    { entity: clickArea, opts: PLACE_OPTS },
    () => {
      if (isInventoryActionLocked()) return
      const now = Date.now()
      if (now - lastPlaceMs < PLACE_COOLDOWN_MS) return
      lastPlaceMs = now
      placeRaft(gx, gz)
    }
  )
}

function placeRaft(gridX: number, gridZ: number): void {
  createPlatform(gridCellToWorld(gridX, gridZ), { gridX, gridZ })
  triggerHammerSwing()
  removeAllMarkers()
  if (validGhost !== null) hideSpectral(validGhost)
  placeHoverCell = null
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
      if (isInventoryActionLocked()) return
      if (MainPlatform.getOrNull(entity) !== null) return
      // Locked while a shark is committed to this platform.
      if (PlatformUnderAttack.getOrNull(entity) !== null) return
      if (destroyHoverEntity === entity) destroyHoverEntity = null
      engine.removeEntity(entity)
      triggerHammerSwing()
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
