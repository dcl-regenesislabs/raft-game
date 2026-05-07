import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

import { SLOT_COUNT, selectSlot, tickInventoryAnim } from '../ui/inventoryState'
import { getConstructionPlacementMode } from './constructionPlacement'
import { getRaftBuilderMode } from './raftBuilder'

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
  // While in any placement mode (raft hammer or construction), E
  // (IA_PRIMARY) is reused as the rotate-left key. Suppress slot 5
  // selection on E for that frame so a rotate press doesn't also
  // kick the player out of placement mode by jumping them to slot 5.
  const placing =
    getConstructionPlacementMode() !== 'idle' ||
    getRaftBuilderMode() === 'placing'
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (placing && SLOT_KEYS[i] === InputAction.IA_PRIMARY) continue
    if (inputSystem.isTriggered(SLOT_KEYS[i], PointerEventType.PET_DOWN)) {
      selectSlot(i)
    }
  }
}
