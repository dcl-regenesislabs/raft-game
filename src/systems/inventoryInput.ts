import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

import { SLOT_COUNT, selectSlot, tickInventoryAnim } from '../ui/inventoryState'

// SDK only exposes IA_ACTION_3..IA_ACTION_6 (keys 1–4) — there is no native
// "key 5" mapping. Slot 5 falls back to IA_PRIMARY (E key), which is also
// surfaced as a button on the mobile client.
const SLOT_KEYS: InputAction[] = [
  InputAction.IA_ACTION_3,
  InputAction.IA_ACTION_4,
  InputAction.IA_ACTION_5,
  InputAction.IA_ACTION_6,
  InputAction.IA_PRIMARY
]

export function inventoryInputSystem(dt: number): void {
  tickInventoryAnim(dt)
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (inputSystem.isTriggered(SLOT_KEYS[i], PointerEventType.PET_DOWN)) {
      selectSlot(i)
    }
  }
}
