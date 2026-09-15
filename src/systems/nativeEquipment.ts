import { InputAction } from '@dcl/sdk/ecs'
import { INVENTORY_TOTAL_SLOTS } from '../ui/items'
import { HANDS_SLOT, isSlotSelectable, selectSlot } from '../ui/inventoryState'
import { setInventoryOpen } from '../ui/inventoryToggle'
import { beginUiTouch } from '../ui/mobileControlsState'
import { cancelFishingForEquipmentChange } from './fishingRod'
import { cancelHookCharge } from './hookThrower'
import { cancelAnchorCharge } from './anchorThrower'
import { cancelConstructionPreview } from './constructionPlacement'
import { cancelRaftPreview } from './raftBuilder'

export const NATIVE_SLOT_ACTIONS = [
  InputAction.IA_ACTION_3,
  InputAction.IA_ACTION_4,
  InputAction.IA_ACTION_5,
  InputAction.IA_ACTION_6
]
// Equip from either the tool dropdown or the backpack.
export function equipInventorySlot(slot: number): boolean {
  if (!Number.isInteger(slot) || (slot !== HANDS_SLOT && (slot < 0 || slot >= INVENTORY_TOTAL_SLOTS || !isSlotSelectable(slot)))) return false
  beginUiTouch()
  setInventoryOpen(false)
  cancelHookCharge()
  cancelAnchorCharge()
  cancelFishingForEquipmentChange()
  cancelConstructionPreview()
  cancelRaftPreview()
  selectSlot(slot)
  return true
}
