import {
  Entity,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

import { PlacementMarker, Platform, PlatformUnderAttack } from '../../components'
import {
  createPlatform,
  gridCellToWorld
} from '../../factories/platform'
import { createPlacementClickArea } from '../../factories/placementClickArea'
import {
  createSpectralPlatform,
  hideSpectral,
  showSpectralAt,
  tickSpectralBlink
} from '../../factories/spectralPlatform'
import { isInventoryActionLocked } from '../../ui/inventoryToggle'
import { showNotification } from '../../ui/notification'
import {
  getPlacementRotationDeg,
  resetPlacementRotation
} from '../../ui/placementRotation'
import { playSfx } from '../../audio/sfx'
import { triggerHammerSwing } from '../hammerSwing'
import { publishLookAtHit } from '../lookAtTarget'
import { canAffordPlatform, spendPlatformCost } from './platformCost'
import {
  GRID_HALF_EXTENT,
  NEIGHBOUR_DELTAS,
  PLACE_COOLDOWN_MS,
  PLACE_OPTS,
  PLACE_RAY_MAX_DISTANCE,
  cellKey,
  computeOccupancySnapshot,
  parseCellKey,
  projectCameraToWaterPlane,
  registerCameraForwardRaycast,
  unregisterCameraForwardRaycast,
  type RaycastHandler
} from './shared'

// Red palette for the cursor-following "invalid placement" hologram. Stays
// solid red — no blink — so it reads clearly as a "not here" indicator vs
// the pulsing green "valid placement" preview.
const RED_GHOST_DIM = Color4.create(1, 0.2, 0.2, 0.55)
const RED_GHOST_BRIGHT = Color4.create(1, 0.2, 0.2, 0.55)

// Yellow palette for the "valid spot but you're out of platforms" preview.
// Same pulse shape as the green ghost; the colour swap is the player's cue
// that they need to craft more platforms before clicking will commit.
const YELLOW_GHOST_DIM = Color4.create(0.9, 0.7, 0.05, 1)
const YELLOW_GHOST_BRIGHT = Color4.create(1.0, 0.95, 0.3, 1)

// --- module-local placement state ---
// Green "valid placement" preview, snapped to the hovered click-area cell.
let validGhost: Entity | null = null
// Yellow "valid spot but no platform in inventory" preview. Replaces the
// green ghost when the player has zero platforms; same hover cell, different
// colour so the lack-of-stock reads at a glance.
let noStockGhost: Entity | null = null
// Red "invalid placement" preview, follows the camera-forward cursor.
let cursorGhost: Entity | null = null
// Latest placement target derived from the camera raycast, refreshed each
// frame by handlePlaceRaycast. Either a valid grid cell or a free-form
// world point on the water plane the cursor is pointing at.
let placeHoverCell: { gx: number; gz: number } | null = null
let placeCursorWorld: Vector3 | null = null
let lastPlaceMs = 0
// Sorted occupancy hash captured the last time markers were synced. Lets
// the system detect external changes — sharks eating a platform, players
// destroying one — and refresh markers without coupling to those callers.
let lastPlacingOccupancy = ''

export function enterPlacing(): void {
  resetPlacementRotation()
  if (validGhost === null) {
    validGhost = createSpectralPlatform()
  }
  if (noStockGhost === null) {
    noStockGhost = createSpectralPlatform({
      dim: YELLOW_GHOST_DIM,
      bright: YELLOW_GHOST_BRIGHT
    })
  }
  if (cursorGhost === null) {
    cursorGhost = createSpectralPlatform({
      dim: RED_GHOST_DIM,
      bright: RED_GHOST_BRIGHT
    })
  }
  hideSpectral(validGhost)
  hideSpectral(noStockGhost)
  hideSpectral(cursorGhost)
  placeHoverCell = null
  placeCursorWorld = null
  spawnMarkersForVacantNeighbours()
  lastPlacingOccupancy = computeOccupancySnapshot()
  registerCameraForwardRaycast(PLACE_RAY_MAX_DISTANCE, handlePlaceRaycast)
}

export function exitPlacing(): void {
  unregisterCameraForwardRaycast()
  removeAllMarkers()
  if (validGhost !== null) hideSpectral(validGhost)
  if (noStockGhost !== null) hideSpectral(noStockGhost)
  if (cursorGhost !== null) hideSpectral(cursorGhost)
  placeHoverCell = null
  placeCursorWorld = null
  lastPlacingOccupancy = ''
  resetPlacementRotation()
}

// Drops cached spectral-ghost entity refs without removing them — the
// BACK TO LOBBY sweep destroys the underlying entities, and the next
// enterPlacing() will lazy-create fresh ghosts. Without this, the next
// enter would call hideSpectral on dead entity ids and crash.
export function resetRaftPlacementState(): void {
  unregisterCameraForwardRaycast()
  validGhost = null
  noStockGhost = null
  cursorGhost = null
  placeHoverCell = null
  placeCursorWorld = null
  lastPlaceMs = 0
  lastPlacingOccupancy = ''
}

// Each frame while in placing mode: sync the marker set against current
// occupancy and update the preview ghost positioning.
export function tickPlacing(dt: number): void {
  const snapshot = computeOccupancySnapshot()
  if (snapshot !== lastPlacingOccupancy) {
    removeAllMarkers()
    spawnMarkersForVacantNeighbours()
    lastPlacingOccupancy = snapshot
  }
  updatePlacementPreview(dt)
}

export function commitPlaceFromHover(): boolean {
  if (placeHoverCell === null) return false
  const now = Date.now()
  if (now - lastPlaceMs < PLACE_COOLDOWN_MS) return false
  lastPlaceMs = now
  placeRaft(placeHoverCell.gx, placeHoverCell.gz)
  return true
}

// --- internals ---

function updatePlacementPreview(dt: number): void {
  if (validGhost === null || noStockGhost === null || cursorGhost === null) return
  const yawDeg = getPlacementRotationDeg()
  if (placeHoverCell !== null) {
    const hasStock = canAffordPlatform()
    const active = hasStock ? validGhost : noStockGhost
    const inactive = hasStock ? noStockGhost : validGhost
    showSpectralAt(active, gridCellToWorld(placeHoverCell.gx, placeHoverCell.gz), yawDeg)
    tickSpectralBlink(active, dt)
    hideSpectral(inactive)
    hideSpectral(cursorGhost)
    return
  }
  hideSpectral(validGhost)
  hideSpectral(noStockGhost)
  if (placeCursorWorld !== null) {
    showSpectralAt(cursorGhost, placeCursorWorld, yawDeg)
  } else {
    hideSpectral(cursorGhost)
  }
}

const handlePlaceRaycast: RaycastHandler = (result) => {
  const firstHit = result.hits[0]
  // Keep lookAtTarget's classification fresh while we own the camera
  // raycaster, so the action button still recognises a grill/purifier
  // the player aims at while the hammer is in placing mode.
  publishLookAtHit(firstHit?.entityId)
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
      if (Math.abs(nx) > GRID_HALF_EXTENT || Math.abs(nz) > GRID_HALF_EXTENT) {
        continue
      }
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

// Hover state is driven by the camera-forward raycast, so the click area
// only carries the onPointerDown to register the placement action — no
// hoverEnter/Leave callbacks needed.
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
  // Each placement spends the raw-material recipe (PLATFORM_COST). Bail
  // when any material is short — the yellow preview is the at-rest cue,
  // this notification is the on-action cue.
  if (!canAffordPlatform()) {
    showNotification('Not enough materials to build a platform.')
    return
  }
  spendPlatformCost()
  createPlatform(gridCellToWorld(gridX, gridZ), {
    gridX,
    gridZ,
    yawDeg: getPlacementRotationDeg()
  })
  triggerHammerSwing()
  playSfx('hammerPlace')
  removeAllMarkers()
  if (validGhost !== null) hideSpectral(validGhost)
  if (noStockGhost !== null) hideSpectral(noStockGhost)
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
