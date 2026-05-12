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
  getSlotItem,
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
  resetRaftDestructionState,
  tickDestroying
} from './raft/destruction'
import {
  commitPlaceFromHover,
  enterPlacing,
  exitPlacing,
  resetRaftPlacementState,
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

const HAMMER_ITEM_ID = 'hammer'

let mode: Mode = 'idle'
// Last hammer-slot press tracking. Stored as (slot index, press count) so
// re-presses of the same slot AND moves of the hammer to a different slot
// are both treated as "press" events that toggle place ↔ destroy. -1 means
// the hammer isn't currently the equipped item.
let lastHammerSlot = -1
let lastHammerPressCount = 0

export function getRaftBuilderMode(): Mode {
  return mode
}

// External flip of the place ↔ destroy mode, driven by the mode-toggle
// button. Idempotent for any non-hammer state (the syncModeToInventory
// pass next frame would snap back to idle anyway). The internal slot-
// repress toggle in syncModeToInventory still works on top of this.
export function toggleRaftBuilderMode(): void {
  if (mode === 'placing') setMode('destroying')
  else if (mode === 'destroying') setMode('placing')
}

// Wipes builder/placement state so the BACK TO LOBBY flow can destroy
// the spectral ghosts and placement markers without leaving stale refs
// behind. Delegates the placement-side cache wipe to its owning module.
export function resetRaftBuilderState(): void {
  mode = 'idle'
  lastHammerSlot = -1
  lastHammerPressCount = 0
  resetRaftPlacementState()
  resetRaftDestructionState()
}

export function getDestroyHoverTarget(): Entity | null {
  return getDestroyHoverEntity()
}

export function raftBuilderSystem(dt: number): void {
  syncModeToInventory()

  if (mode === 'placing') tickPlacing(dt)
  if (mode === 'destroying') tickDestroying(dt)

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

// Drive mode transitions from inventory selection: selecting (or
// re-pressing) a slot whose item is the hammer enters/toggles
// place/destroy; any other equipped item returns to idle. Looking up the
// hammer by item id rather than a hardcoded slot index lets the player
// keep the hammer in any hot-bar position without other tools (e.g. the
// fishing rod) accidentally inheriting construction mode.
function syncModeToInventory(): void {
  const selected = getSelectedSlot()
  const isHammer = getSlotItem(selected)?.id === HAMMER_ITEM_ID

  if (!isHammer) {
    if (mode !== 'idle') setMode('idle')
    lastHammerSlot = -1
    lastHammerPressCount = 0
    return
  }

  // Press detected when the hammer's slot index changes (fresh selection,
  // including the very first time the player picks it) OR when the press
  // counter for the same slot ticks up (re-press to toggle modes).
  const pressCount = getSlotPressCount(selected)
  const newPress =
    selected !== lastHammerSlot || pressCount > lastHammerPressCount
  lastHammerSlot = selected
  lastHammerPressCount = pressCount

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
