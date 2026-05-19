// Player picks up the cooked food (or coal) from a grill. Awards the
// item to the inventory and tears down the world-side sprites and the
// `ActiveCook` component on the grill, so the grill goes back to
// "empty, click to cook" state.

import { Entity, engine } from '@dcl/sdk/ecs'

import { ActiveCook, PlatformConstruction } from '../components'
import {
  getConstructionDefaultHoverText,
  setConstructionPointerPrompt
} from '../factories/construction'
import { notifyTier4Crafted } from '../systems/eventScheduler'
import { addCollected } from './inventoryState'
import { notifyItemReceived } from './itemReceivedNotification'

export function grabCookOutput(platform: Entity, itemId: string): boolean {
  const cook = ActiveCook.getOrNull(platform)
  if (cook === null) return false
  addCollected(itemId, 1)
  notifyItemReceived(itemId, 1)
  // Tier-4 hero plates trigger a chef visit (subject to the 5-minute
  // cooldown the scheduler owns). Non-tier-4 ids are dropped silently.
  notifyTier4Crafted(itemId)
  for (const sprite of cook.foodSprites) {
    engine.removeEntity(sprite)
  }
  if (cook.fireSprite !== engine.RootEntity) {
    engine.removeEntity(cook.fireSprite)
  }
  ActiveCook.deleteFrom(platform)
  // Grill is empty again — restore the default "COOK" hover prompt so
  // the next tap re-opens the cook menu.
  const construction = PlatformConstruction.getOrNull(platform)
  if (construction !== null) {
    setConstructionPointerPrompt(
      construction.child,
      getConstructionDefaultHoverText('grill')
    )
  }
  return true
}
