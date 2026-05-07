import {
  Entity,
  InputAction,
  PointerEventType,
  inputSystem
} from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { GRID_ORIGIN, RAFT_SIZE } from '../factories/platform'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import {
  getSelectedSlot,
  getSlotPressCount,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import {
  rotatePlacementLeft,
  rotatePlacementRight
} from '../ui/placementRotation'
import {
  commitDestroyFromHover,
  enterDestroying,
  exitDestroying,
  getDestroyHoverEntity,
  tickDestroying
} from './raft/destruction'
import {
  commitPlaceFromHover,
  enterPlacing,
  exitPlacing,
  tickPlacing
} from './raft/placement'

// Top-level orchestrator for the hammer tool's two modes.
//
// The hammer slot enters PLACING on first selection, toggles to DESTROYING
// on a re-press, and idles when any other slot is selected. Each mode owns
// its own state (markers, ghosts, hover entities) inside ./raft/placement
// and ./raft/destruction; this module only routes lifecycle calls and the
// global "fire" click each frame.

type Mode = 'idle' | 'placing' | 'destroying'

// Inventory slot index for the hammer.
const HAMMER_SLOT = 1

let mode: Mode = 'idle'
// Last hammer-slot press count we acted on. Lets us detect re-presses
// (selection unchanged but slot pressed again) to toggle place ↔ destroy.
let lastHammerPressCount = 0

export function getRaftBuilderMode(): Mode {
  return mode
}

export function getDestroyHoverTarget(): Entity | null {
  return getDestroyHoverEntity()
}

export function raftBuilderSystem(dt: number): void {
  syncModeToInventory()

  if (mode === 'placing') tickPlacing(dt)
  if (mode === 'destroying') tickDestroying()

  // Desktop E/F rotate the previewed raft. Mobile uses the top-middle
  // Left/Right buttons. Only active during placing — destroying doesn't
  // care about orientation.
  if (mode === 'placing' && !isMobile()) {
    if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
      rotatePlacementLeft()
    }
    if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
      rotatePlacementRight()
    }
  }

  // Commit from the global input each frame, mirroring how spear/hook fire:
  // mobile uses the on-screen action button, desktop reads IA_POINTER PET_DOWN
  // directly. Per-entity pointerEventsSystem.onPointerDown is also wired up
  // (inside placement/destruction) to drive hover text and as a fallback,
  // but the camera-forward raycast is the source of truth for the click.
  if (
    !isInventoryActionLocked() &&
    (mode === 'placing' || mode === 'destroying')
  ) {
    const firePressed = isMobile()
      ? actionButtonJustPressed()
      : isPointerLocked() &&
        !isSelectionPointerLockoutActive() &&
        inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)
    if (firePressed) {
      if (mode === 'placing') commitPlaceFromHover()
      else commitDestroyFromHover()
    }
  }
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

// Re-export so callers don't need to reach into the factory.
export { GRID_ORIGIN, RAFT_SIZE }
