import {
  ColliderLayer,
  Entity,
  InputAction,
  PointerEventType,
  RaycastQueryType,
  Transform,
  engine,
  inputSystem,
  raycastSystem
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { MainPlatform, Platform, PlatformConstruction } from '../components'
import {
  type ConstructionKind,
  CONSTRUCTION_KINDS,
  createConstruction,
  createSpectralConstruction,
  hideSpectralConstruction,
  showSpectralConstructionAt,
  tickSpectralConstructionBlink
} from '../factories'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import {
  getCollectedCount,
  getSelectedSlot,
  getSlotItem,
  isSelectionPointerLockoutActive,
  subtractCollected
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import {
  getPlacementRotationDeg,
  resetPlacementRotation,
  rotatePlacementLeft,
  rotatePlacementRight
} from '../ui/placementRotation'
import { publishLookAtHit } from './lookAtTarget'

// Camera-forward continuous raycast distance. Matches the placement reach
// used by raftBuilder so "what I can see I can place" stays consistent
// across all build modes.
const PLACE_RAY_MAX_DISTANCE = 64
const CAMERA_FORWARD = Vector3.create(0, 0, 1)

// Minimum gap between successful placements. Prevents a single click from
// firing twice on the same frame and gives a tiny "settle" beat.
const PLACE_COOLDOWN_MS = 1500

// Yellow palette mirrors raftBuilder's "valid spot but no stock" preview.
const YELLOW_GHOST_DIM = Color4.create(0.9, 0.7, 0.05, 1)
const YELLOW_GHOST_BRIGHT = Color4.create(1.0, 0.95, 0.3, 1)
// Red palette for invalid surfaces (main platform, already-occupied platform,
// non-platform hits).
const RED_GHOST_DIM = Color4.create(1, 0.2, 0.2, 0.55)
const RED_GHOST_BRIGHT = Color4.create(1, 0.2, 0.2, 0.55)

type Mode = ConstructionKind | 'idle'

type GhostSet = {
  green: Entity
  yellow: Entity
  red: Entity
}

let mode: Mode = 'idle'
const ghosts = new Map<ConstructionKind, GhostSet>()

export function getConstructionPlacementMode(): Mode {
  return mode
}

let lastPlaceMs = 0
// Latest hover state from the camera-forward raycast. `targetPlatform`
// is the platform entity under the cursor (or null); `valid` records
// whether that platform passes the placement filter (not main, not
// occupied). When targetPlatform is null we skip drawing any ghost
// (we don't have a meaningful surface to anchor to).
let hoverPlatform: Entity | null = null
let hoverValid = false

export function constructionPlacementSystem(dt: number): void {
  const next = computeMode()
  if (next !== mode) transitionMode(next)

  if (mode === 'idle') return

  // E rotates left, F rotates right. Desktop only — mobile uses the
  // top-middle Left/Right buttons. Edge-triggered so a held key doesn't
  // spin the preview.
  if (!isMobile()) {
    if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
      rotatePlacementLeft()
    }
    if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
      rotatePlacementRight()
    }
  }

  updatePreview(dt)

  if (
    !isInventoryActionLocked() &&
    !isSelectionPointerLockoutActive() &&
    firePressed()
  ) {
    commitPlacement()
  }
}

function firePressed(): boolean {
  if (isMobile()) return actionButtonJustPressed()
  return (
    isPointerLocked() &&
    inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
  )
}

function computeMode(): Mode {
  const item = getSlotItem(getSelectedSlot())
  if (item === null) return 'idle'
  for (const k of CONSTRUCTION_KINDS) {
    if (item.id === k) return k
  }
  return 'idle'
}

function transitionMode(next: Mode): void {
  // Always wipe ghost visibility on transition so leftover previews from
  // the previous mode don't stay parked in the world.
  for (const set of ghosts.values()) {
    hideSpectralConstruction(set.green)
    hideSpectralConstruction(set.yellow)
    hideSpectralConstruction(set.red)
  }

  if (mode !== 'idle' && next === 'idle') {
    raycastSystem.removeRaycasterEntity(engine.CameraEntity)
    hoverPlatform = null
    hoverValid = false
    resetPlacementRotation()
  }

  if (mode === 'idle' && next !== 'idle') {
    resetPlacementRotation()
    ensureGhostsFor(next)
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
      handleRaycast
    )
  } else if (mode !== 'idle' && next !== 'idle') {
    // Switching between grill ↔ purifier — re-use the existing raycast,
    // just make sure the new kind has its ghosts allocated.
    ensureGhostsFor(next)
  }

  mode = next
}

function ensureGhostsFor(kind: ConstructionKind): void {
  if (ghosts.has(kind)) return
  ghosts.set(kind, {
    green: createSpectralConstruction(kind),
    yellow: createSpectralConstruction(kind, {
      dim: YELLOW_GHOST_DIM,
      bright: YELLOW_GHOST_BRIGHT
    }),
    red: createSpectralConstruction(kind, {
      dim: RED_GHOST_DIM,
      bright: RED_GHOST_BRIGHT
    })
  })
}

function handleRaycast(result: {
  hits: ReadonlyArray<{ entityId?: number }>
}): void {
  if (mode === 'idle') return
  const firstId = result.hits[0]?.entityId
  // Mirror the hit into lookAtTarget so the action button's "what am I
  // pointing at" classification stays fresh while we own the raycaster
  // (lookAtTargetSystem itself defers to us during placement).
  publishLookAtHit(firstId)
  if (firstId === undefined) {
    hoverPlatform = null
    hoverValid = false
    return
  }
  const candidate = firstId as Entity
  if (Platform.getOrNull(candidate) === null) {
    // Hit something else (e.g. a placement marker, the seabed proxy, etc.).
    hoverPlatform = null
    hoverValid = false
    return
  }
  hoverPlatform = candidate
  hoverValid =
    MainPlatform.getOrNull(candidate) === null &&
    PlatformConstruction.getOrNull(candidate) === null
}

function updatePreview(dt: number): void {
  if (mode === 'idle') return
  const set = ghosts.get(mode)
  if (set === undefined) return

  // No platform under the cursor → hide all previews. We don't draw a
  // free-floating cursor ghost for constructions because they only make
  // sense anchored to a platform deck.
  if (hoverPlatform === null) {
    hideSpectralConstruction(set.green)
    hideSpectralConstruction(set.yellow)
    hideSpectralConstruction(set.red)
    return
  }

  const platformTransform = Transform.getOrNull(hoverPlatform)
  if (platformTransform === null) {
    hideSpectralConstruction(set.green)
    hideSpectralConstruction(set.yellow)
    hideSpectralConstruction(set.red)
    return
  }
  const anchor = platformTransform.position

  if (!hoverValid) {
    // Invalid surface — main platform or already-occupied. Pulse red on
    // the platform centre so the player sees exactly which one they
    // can't build on.
    showSpectralConstructionAt(set.red, anchor, getPlacementRotationDeg())
    tickSpectralConstructionBlink(set.red, dt)
    hideSpectralConstruction(set.green)
    hideSpectralConstruction(set.yellow)
    return
  }

  const hasStock = getCollectedCount(mode) > 0
  const active = hasStock ? set.green : set.yellow
  const inactive = hasStock ? set.yellow : set.green
  showSpectralConstructionAt(active, anchor, getPlacementRotationDeg())
  tickSpectralConstructionBlink(active, dt)
  hideSpectralConstruction(inactive)
  hideSpectralConstruction(set.red)
}

function commitPlacement(): void {
  if (mode === 'idle') return
  if (hoverPlatform === null) return
  const platform = hoverPlatform

  if (!hoverValid) {
    if (MainPlatform.getOrNull(platform) !== null) {
      showNotification("Can't build on the main platform.")
    } else if (PlatformConstruction.getOrNull(platform) !== null) {
      showNotification('Platform already has a construction.')
    }
    return
  }

  if (getCollectedCount(mode) <= 0) {
    showNotification(
      mode === 'grill'
        ? 'No grills in inventory. Craft a GRILL to build.'
        : 'No water purifiers in inventory. Craft one to build.'
    )
    return
  }

  const now = Date.now()
  if (now - lastPlaceMs < PLACE_COOLDOWN_MS) return
  lastPlaceMs = now

  subtractCollected(mode, 1)
  createConstruction(platform, mode, getPlacementRotationDeg())
  // Hover stays the same target; the platform now carries a
  // PlatformConstruction so the next frame's raycast result will mark
  // hoverValid = false and the green ghost will swap to red.
}
