import {
  Entity,
  InputAction,
  PointerEventType,
  PointerEvents,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { WaterScroll } from '../components'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { isPointerLocked } from '../ui/cursorLock'
import {
  getSelectedSlot,
  isSelectionPointerLockoutActive,
  transmuteContainerSlot
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { consumeWorldClick } from '../ui/worldClickGate'

// Manages the empty-cup → salt-water-cup transition. Two responsibilities
// each frame:
//   1. Toggle PointerEvents on the water plane so the SDK only shows the
//      "FILL CUP" hover prompt when the player is actually holding an
//      empty cup. Other times the water surface stays inert.
//   2. Detect a click that landed on the water plane and, if an empty
//      cup is equipped, transmute the slot in place to a salt-water cup.

const HOVER_TEXT = 'FILL CUP'
// Pointer reach matches the construction prompt — player has to lean
// over the edge of the raft, not click from anywhere on the deck.
const HOVER_MAX_DISTANCE = 8

export function cupFillSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return

  const cupHeld = getHeldItemKind() === 'cup' && getHeldFoodId() === 'cup'
  syncWaterPointer(water, cupHeld)

  if (!cupHeld) return
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  if (!isPointerLocked()) return

  // Entity-targeted check — only fires when the click landed on the
  // water plane, not on the raft, a placed construction, or a shark.
  if (
    !inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      water
    )
  ) {
    return
  }

  const slot = getSelectedSlot()
  if (transmuteContainerSlot(slot, 'saltWater')) {
    showNotification('Cup filled with salt water.')
  }
  // Mark the click handled so other systems (e.g. food-eat for any
  // future overlap, or a default drink path) don't double-process it.
  consumeWorldClick()
}

function findWaterEntity(): Entity | null {
  for (const [entity] of engine.getEntitiesWith(WaterScroll)) {
    return entity
  }
  return null
}

function syncWaterPointer(entity: Entity, shouldHavePointer: boolean): void {
  const existing = PointerEvents.getOrNull(entity)
  if (shouldHavePointer) {
    if (existing === null) {
      PointerEvents.create(entity, {
        pointerEvents: [
          {
            eventType: PointerEventType.PET_DOWN,
            eventInfo: {
              button: InputAction.IA_POINTER,
              hoverText: HOVER_TEXT,
              maxDistance: HOVER_MAX_DISTANCE,
              showFeedback: true
            }
          }
        ]
      })
    }
  } else if (existing !== null) {
    PointerEvents.deleteFrom(entity)
  }
}
