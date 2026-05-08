import {
  InputAction,
  PointerEventType,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { ActiveCook, CookStatus, PlatformConstruction } from '../components'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { grabCookOutput } from '../ui/cookGrab'
import { openCookMenu } from '../ui/cookToggle'
import {
  getSelectedSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isPurifying, startPurify } from '../ui/purifySession'
import { showNotification } from '../ui/notification'
import { openStorageMenu } from '../ui/storageToggle'
import { consumeWorldClick } from '../ui/worldClickGate'
import { getLookAtTarget } from './lookAtTarget'

// Handles fire presses landing on a placed PURIFIER or GRILL via two
// paths each frame:
//   - Direct entity-targeted IA_POINTER PET_DOWN on the construction's
//     child mesh (desktop click, mobile direct tap).
//   - Mobile action button press while the camera-forward raycast is
//     currently aimed at a construction of that kind. This is what
//     lets the contextual icon swap on the action button (e.g. salt
//     water + purifier in view → button shows the purifier icon and
//     pressing it kicks off the purify session; aiming at a grill
//     swaps the button to the grill icon and opens the cook menu).
//
// Per-kind behaviour:
//   purifier — if the player is holding a salt-water cup, kick off the
//     4-second purify session (the slot transmutes to a fresh-water
//     cup on completion). Otherwise nudge the player toward salt water.
//   grill    — opens the cook menu.
//
// Either way the click is marked consumed so a global handler (e.g.
// the food-eat drink path) doesn't also fire on the same press.

export function constructionInteractSystem(_dt: number): void {
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  if (isPurifying()) return
  // No `isPointerLocked()` gate here on purpose. On desktop, every
  // inventory UI click (slot swap, close button) drops pointer-lock,
  // and the player's next world click on a grill/purifier is what
  // re-locks it. Gating on lock state ate that re-lock click and made
  // the construction look unresponsive after a swap. The
  // entity-targeted `isTriggered(IA_POINTER, PET_DOWN, child)` below
  // is the source of truth — it only fires when the SDK has actually
  // delivered a click to that specific entity. Mobile already
  // short-circuits the lock helper to true.

  const actionButton = isMobile() && actionButtonJustPressed()
  const lookTarget = getLookAtTarget()

  for (const [platform, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    const child = pc.child
    const tapped = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      child
    )
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
      const heldIsSaltWater =
        getHeldItemKind() === 'cup' && getHeldFoodId() === 'saltWater'
      if (!heldIsSaltWater) {
        showNotification('Equip a salt-water cup to purify.')
        consumeWorldClick()
        return
      }
      const slot = getSelectedSlot()
      if (startPurify(slot)) {
        consumeWorldClick()
      }
      return
    }

    if (pc.kind === 'storage') {
      openStorageMenu(platform)
      consumeWorldClick()
      return
    }
  }
}
