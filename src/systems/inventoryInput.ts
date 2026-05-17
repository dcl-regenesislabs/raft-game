import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

import { SLOT_COUNT, selectSlot, tickInventoryAnim } from '../ui/inventoryState'
import { getConstructionPlacementMode } from './constructionPlacement'
import { getLookAtGarbageEntity } from './lookAtTarget'
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
  // Same suppression applies while the player is aiming at a grabbable
  // floating item — E is the grab key in that context (see
  // `systems/garbageGrab.ts`), and we don't want the grab press to
  // also slam the inventory cursor onto slot 5.
  const grabbing = getLookAtGarbageEntity() !== null
  const placing =
    getConstructionPlacementMode() !== 'idle' ||
    getRaftBuilderMode() === 'placing'
  const suppressPrimary = placing || grabbing
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (suppressPrimary && SLOT_KEYS[i] === InputAction.IA_PRIMARY) continue
    if (inputSystem.isTriggered(SLOT_KEYS[i], PointerEventType.PET_DOWN)) {
      selectSlot(i)
    }
  }
}
