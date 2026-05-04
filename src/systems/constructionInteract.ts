import {
  InputAction,
  PointerEventType,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { PlatformConstruction } from '../components'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { isPointerLocked } from '../ui/cursorLock'
import {
  getSelectedSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { showNotification } from '../ui/notification'
import { isPurifying, startPurify } from '../ui/purifySession'
import { consumeWorldClick } from '../ui/worldClickGate'

// Handles fire presses landing on a placed PURIFIER or GRILL. Each
// frame it iterates every PlatformConstruction and asks the input
// system whether this frame's click landed on its child mesh.
//
//   purifier — if the player is holding a salt-water cup, kick off the
//     4-second purify session (the slot transmutes to a fresh-water cup
//     on completion). Otherwise nudge the player toward salt water.
//   grill    — placeholder. Cooking isn't wired up yet, so we just
//     surface a notification mirroring the hover prompt.
//
// Either way the click is marked consumed so a global handler (e.g. a
// future drink-on-air-click) doesn't also fire.

export function constructionInteractSystem(_dt: number): void {
  if (isInventoryActionLocked()) return
  if (isSelectionPointerLockoutActive()) return
  if (isPurifying()) return
  if (!isPointerLocked()) return

  for (const [, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    const child = pc.child
    if (
      !inputSystem.isTriggered(
        InputAction.IA_POINTER,
        PointerEventType.PET_DOWN,
        child
      )
    ) {
      continue
    }

    if (pc.kind === 'grill') {
      showNotification('Grill: WORK IN PROGRESS')
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
  }
}
