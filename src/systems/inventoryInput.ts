import { isMobile } from '@dcl/sdk/platform'
import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

import { getEquippableSlots, selectSlot, tickInventoryAnim } from '../ui/inventoryState'

// Keys 1-4 equip the first four cells of the desktop tool bar, which lists the
// equippable tools in inventory order (see `ToolBar`).
const TOOL_KEYS: InputAction[] = [
  InputAction.IA_ACTION_3,
  InputAction.IA_ACTION_4,
  InputAction.IA_ACTION_5,
  InputAction.IA_ACTION_6
]

export function inventoryInputSystem(dt: number): void {
  tickInventoryAnim(dt)
  if (isMobile()) return
  for (let i = 0; i < TOOL_KEYS.length; i++) {
    if (!inputSystem.isTriggered(TOOL_KEYS[i], PointerEventType.PET_DOWN)) continue
    const slot = getEquippableSlots()[i]
    if (slot !== undefined) selectSlot(slot)
  }
}
