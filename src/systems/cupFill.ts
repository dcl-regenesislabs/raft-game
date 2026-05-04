import {
  Entity,
  InputAction,
  PointerEventType,
  PointerEvents,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { WaterScroll } from '../components'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import {
  getSelectedSlot,
  isSelectionPointerLockoutActive,
  transmuteContainerSlot
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { consumeWorldClick } from '../ui/worldClickGate'
import {
  registerCameraForwardRaycast,
  unregisterCameraForwardRaycast
} from './raft/shared'

// Manages the empty-cup → salt-water-cup transition. Three things each
// frame:
//   1. Toggle PointerEvents on the water plane so the SDK only shows
//      the "FILL CUP" hover prompt when the player is actually holding
//      an empty cup. Other times the water surface stays inert.
//   2. Track whether the camera is currently aimed at water via a
//      continuous CL_POINTER raycast, registered only while the empty
//      cup is held. The action-button HUD reads this so the button
//      only surfaces (and only fires) when there's water in front.
//   3. On fire — either a direct entity-targeted click on the water,
//      or the mobile action button while looking at water — transmute
//      the equipped cup slot to a salt-water cup.

const HOVER_TEXT = 'FILL CUP'
// Pointer reach matches the construction prompt — player has to lean
// over the edge of the raft, not click from anywhere on the deck.
const HOVER_MAX_DISTANCE = 8

let waterEntityCached: Entity | null = null
let raycasterActive = false
let lookingAtWater = false

export function cupFillSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return

  const cupHeld = getHeldItemKind() === 'cup' && getHeldFoodId() === 'cup'
  syncWaterPointer(water, cupHeld)
  syncRaycaster(water, cupHeld)

  if (!cupHeld) {
    lookingAtWater = false
    return
  }
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  if (!isPointerLocked()) return

  // Two fire paths:
  //   - Entity-targeted IA_POINTER PET_DOWN on water — the player
  //     clicked/tapped the water plane directly. Works on both desktop
  //     and direct mobile taps.
  //   - The mobile action button — only valid when the camera is
  //     currently aimed at water (so the button effectively means
  //     "fill the cup with what I'm pointing at").
  const tappedWater = inputSystem.isTriggered(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN,
    water
  )
  const actionButtonFire = isMobile() && actionButtonJustPressed() && lookingAtWater
  if (!tappedWater && !actionButtonFire) return

  const slot = getSelectedSlot()
  if (transmuteContainerSlot(slot, 'saltWater')) {
    showNotification('Cup filled with salt water.')
  }
  // Mark the click handled so other systems (e.g. food-eat) don't
  // double-process it.
  consumeWorldClick()
}

// True when the camera-forward raycast is currently hitting the water
// plane AND an empty cup is held. Read by the HUD so the action button
// can hide itself when there's nothing to fill from.
export function isCupFillTargetActive(): boolean {
  return lookingAtWater
}

function findWaterEntity(): Entity | null {
  if (waterEntityCached !== null) return waterEntityCached
  for (const [entity] of engine.getEntitiesWith(WaterScroll)) {
    waterEntityCached = entity
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

function syncRaycaster(water: Entity, shouldRaycast: boolean): void {
  if (shouldRaycast === raycasterActive) return
  if (shouldRaycast) {
    registerCameraForwardRaycast(HOVER_MAX_DISTANCE, (result) => {
      const firstId = result.hits[0]?.entityId
      lookingAtWater = firstId !== undefined && (firstId as Entity) === water
    })
    raycasterActive = true
  } else {
    unregisterCameraForwardRaycast()
    raycasterActive = false
    lookingAtWater = false
  }
}
