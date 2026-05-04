import {
  Entity,
  InputAction,
  PointerEventType,
  PointerEvents,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { PlatformConstruction, WaterScroll } from '../components'
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

// Manages everything cup-related that depends on what the camera is
// currently aimed at:
//   1. Toggles a "FILL CUP" PointerEvents prompt on the water plane
//      so the SDK only shows the hover cue while an empty cup is held.
//   2. Runs a continuous CL_POINTER raycast whenever any cup-kind
//      item is held and classifies the first hit as 'water',
//      'purifier', 'grill', or null. The HUD reads this through
//      `getCupTarget()` to swap the action-button icon contextually
//      (e.g. salt-water cup + purifier target → purifier icon).
//   3. Fires an empty-cup fill when the player taps the water (direct
//      entity-targeted click) or presses the mobile action button
//      while looking at water.

const HOVER_TEXT = 'FILL CUP'
// Pointer reach matches the construction prompt — player has to lean
// over the edge of the raft, not click from anywhere on the deck.
const HOVER_MAX_DISTANCE = 8

export type CupTarget = 'water' | 'purifier' | 'grill' | null

let waterEntityCached: Entity | null = null
let raycasterActive = false
let currentTarget: CupTarget = null

export function cupFillSystem(_dt: number): void {
  const water = findWaterEntity()
  if (water === null) return

  const heldKind = getHeldItemKind()
  const heldId = getHeldFoodId()
  const cupKindHeld = heldKind === 'cup'
  const emptyCupHeld = cupKindHeld && heldId === 'cup'

  syncWaterPointer(water, emptyCupHeld)
  syncRaycaster(water, cupKindHeld)

  if (!cupKindHeld) {
    currentTarget = null
    return
  }
  if (!emptyCupHeld) return
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
  const actionButtonFire =
    isMobile() && actionButtonJustPressed() && currentTarget === 'water'
  if (!tappedWater && !actionButtonFire) return

  const slot = getSelectedSlot()
  if (transmuteContainerSlot(slot, 'saltWater')) {
    showNotification('Cup filled with salt water.')
  }
  // Mark the click handled so other systems (e.g. food-eat) don't
  // double-process it.
  consumeWorldClick()
}

// Current camera-forward target while a cup-kind item is held. Returns
// null whenever the player isn't holding a cup variant or the raycast
// hasn't landed on a recognised entity.
export function getCupTarget(): CupTarget {
  return currentTarget
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
      currentTarget = classifyHit(water, result.hits[0]?.entityId)
    })
    raycasterActive = true
  } else {
    unregisterCameraForwardRaycast()
    raycasterActive = false
    currentTarget = null
  }
}

function classifyHit(water: Entity, hitId: number | undefined): CupTarget {
  if (hitId === undefined) return null
  const hit = hitId as Entity
  if (hit === water) return 'water'
  // Map a placed-construction child entity back to its kind by scanning
  // PlatformConstruction. Cheap — there are at most a handful of placed
  // constructions on the raft, and the raycast handler runs once per
  // frame.
  for (const [, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    if (pc.child === hit) {
      if (pc.kind === 'purifier') return 'purifier'
      if (pc.kind === 'grill') return 'grill'
      return null
    }
  }
  return null
}
