import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

import { selectSlot, tickInventoryAnim } from '../ui/inventoryState'

const SLOT_KEYS: (InputAction | null)[] = [
  InputAction.IA_ACTION_3,
  InputAction.IA_ACTION_4,
  InputAction.IA_ACTION_5,
  InputAction.IA_ACTION_6,
  null
]

export function inventoryInputSystem(dt: number): void {
  tickInventoryAnim(dt)
  for (let i = 0; i < SLOT_KEYS.length; i++) {
    const key = SLOT_KEYS[i]
    if (key === null) continue
    if (inputSystem.isTriggered(key, PointerEventType.PET_DOWN)) {
      selectSlot(i)
    }
  }
}
