import {
  InputAction,
  PointerEventType,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { ActiveCook, CookStatus, PlatformConstruction, PurifierState } from '../components'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { grabCookOutput } from '../ui/cookGrab'
import { openCookMenu } from '../ui/cookToggle'
import {
  getCollectedCount,
  getSelectedSlot,
  isSelectionPointerLockoutActive,
  subtractCollected,
  transmuteContainerSlot
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { restoreStat } from '../ui/statsBars'
import { openStorageMenu } from '../ui/storageToggle'
import { consumeWorldClick } from '../ui/worldClickGate'
import { getLookAtTarget } from './lookAtTarget'
import { addFuelToPurifier } from './purifierProcess'

// Handles E-key (or mobile action button) presses landing on a placed
// PURIFIER / GRILL / STORAGE via two paths each frame:
//   - Direct entity-targeted IA_PRIMARY PET_DOWN on the construction's
//     child mesh (desktop E press while hovering, mobile direct tap).
//     Switched off IA_POINTER (mouse click) so left-click stays free
//     for the held-tool primary action.
//   - Mobile action button press while the camera-forward raycast is
//     currently aimed at a construction of that kind. This is what
//     lets the contextual icon swap on the action button (e.g. salt
//     water + purifier in view → button shows the purifier icon and
//     pressing it kicks off the purify session; aiming at a grill
//     swaps the button to the grill icon and opens the cook menu).
//
// Per-kind behaviour:
//   purifier — E drinks directly from the fresh bowl (restoring
//     thirst by its fill %), OR pours a salt-water cup into the
//     centre bowl when the fresh bowl is empty. F adds wood.
//   grill    — opens the cook menu.
//
// Either way the click is marked consumed so a global handler (e.g.
// the food-eat drink path) doesn't also fire on the same press.

export function constructionInteractSystem(_dt: number): void {
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  // No `isPointerLocked()` gate here on purpose. The entity-targeted
  // `isTriggered(IA_PRIMARY, PET_DOWN, child)` below is the source of
  // truth — it only fires when the SDK has actually delivered an
  // E-press (desktop) or direct tap (mobile) to that specific entity,
  // which inherently requires the hover prompt to be visible.

  const actionButton = actionButtonJustPressed()
  const lookTarget = getLookAtTarget()

  for (const [platform, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    const child = pc.child
    const tapped = inputSystem.isTriggered(
      InputAction.IA_PRIMARY,
      PointerEventType.PET_DOWN,
      child
    )
    // F-key fuels a purifier with wood. Only the purifier listens; grills
    // and storage stay E-only so a stray F-press while facing them does
    // nothing.
    const fueled =
      pc.kind === 'purifier' &&
      inputSystem.isTriggered(
        InputAction.IA_SECONDARY,
        PointerEventType.PET_DOWN,
        child
      )
    if (fueled) {
      handlePurifierFuel(platform)
      consumeWorldClick()
      return
    }
    const buttonHits =
      actionButton &&
      ((pc.kind === 'purifier' && lookTarget === 'purifier') ||
        (pc.kind === 'grill' && lookTarget === 'grill') ||
        (pc.kind === 'storage' && lookTarget === 'storage'))
    if (!tapped && !buttonHits) continue

    if (pc.kind === 'grill') {
      // Route by cook state: empty grill opens the menu, ready /
      // burned grill grabs the output, cooking grill is a no-op
      // (the ingredient sprites already communicate "in progress").
      const cook = ActiveCook.getOrNull(platform)
      if (cook === null) {
        openCookMenu(platform)
        consumeWorldClick()
        return
      }
      if (cook.status === CookStatus.Ready) {
        grabCookOutput(platform, cook.recipeId)
        consumeWorldClick()
        return
      }
      if (cook.status === CookStatus.Burned) {
        grabCookOutput(platform, 'coal')
        consumeWorldClick()
        return
      }
      consumeWorldClick()
      return
    }

    if (pc.kind === 'purifier') {
      handlePurifierPrimary(platform)
      consumeWorldClick()
      return
    }

    if (pc.kind === 'storage') {
      openStorageMenu(platform)
      consumeWorldClick()
      return
    }
  }
}

// E-press routing for a purifier. Two operations share the same key:
//   - freshAmount > 0 → drink: restore thirst by freshAmount, drain bowl
//   - freshAmount == 0 + holding salt-water cup → pour: cup becomes empty,
//     salt bowl fills to 100%
function handlePurifierPrimary(platform: import('@dcl/sdk/ecs').Entity): void {
  const state = PurifierState.getMutableOrNull(platform)
  if (state === null) return

  if (state.freshAmount > 0) {
    const FULL_CUP_RESTORE = 0.30
    restoreStat('thirst', state.freshAmount * FULL_CUP_RESTORE)
    showNotification('Drank purified water.')
    state.freshAmount = 0
    return
  }

  const heldKind = getHeldItemKind()
  const heldId = getHeldFoodId()
  const slot = getSelectedSlot()
  const holdingSaltCup = heldKind === 'cup' && heldId === 'saltWater'

  if (holdingSaltCup) {
    if (state.saltAmount >= 1) {
      showNotification('Centre bowl is full — light the fire.')
      return
    }
    state.saltAmount = Math.min(1, state.saltAmount + 1)
    transmuteContainerSlot(slot, 'cup')
    return
  }

  showNotification('Equip a salt-water cup to pour in.')
}

// F-press handler for a purifier. Requires the player to have at least
// 1 wood in inventory; consumes one log and adds FUEL_PER_WOOD_SEC of
// burn time. Lights the flame sprite via `addFuelToPurifier`.
function handlePurifierFuel(platform: import('@dcl/sdk/ecs').Entity): void {
  if (PurifierState.getOrNull(platform) === null) return
  if (getCollectedCount('wood') < 1) {
    showNotification('Need wood to add fuel.')
    return
  }
  if (!addFuelToPurifier(platform)) {
    showNotification('Fire is already burning.')
    return
  }
  subtractCollected('wood', 1)
}
