import {
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { FloatingIsland, IslandChest } from '../components'
import { playChestOpenAnimation } from '../factories/islandChest'
import { addCollected } from '../ui/inventoryState'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { randInt } from '../utils/math'

const CHEST_POOL = [
  'wood', 'metal', 'plastic', 'rope', 'plants',
  'mussels', 'clams', 'seaweed', 'tomatoes', 'garlic',
  'olive_oil', 'potato', 'crab'
] as const

function rollChestLoot(): void {
  const ropeCount = randInt(1, 2)
  addCollected('rope', ropeCount)
  notifyItemReceived('rope', ropeCount)

  const drops = randInt(2, 4)
  for (let i = 0; i < drops; i++) {
    const pick = CHEST_POOL[Math.floor(Math.random() * CHEST_POOL.length)]
    addCollected(pick, 1)
    notifyItemReceived(pick, 1)
  }
}

export function islandChestSystem(_dt: number): void {
  // Pool model: the chest entity is created once and reused. Activation
  // state (open/closed, loot eligibility) is reset in
  // activateFloatingIsland — we only need to handle click here, and gate
  // by the parent island being active so a stray pointer event on the
  // hidden chest can't roll loot.
  for (const [entity] of engine.getEntitiesWith(IslandChest, Transform)) {
    const chest = IslandChest.get(entity)
    const island = FloatingIsland.getOrNull(chest.island)
    if (island === null || !island.active) continue

    const cmd = inputSystem.getInputCommand(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      entity
    )
    if (!cmd) continue
    if (chest.opened) continue

    IslandChest.getMutable(entity).opened = true
    playChestOpenAnimation(entity)
    rollChestLoot()
  }
}
