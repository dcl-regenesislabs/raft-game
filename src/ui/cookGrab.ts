// Player picks up the cooked food (or coal) from a grill. Awards the
// item to the inventory and tears down the world-side sprites and the
// `ActiveCook` component on the grill, so the grill goes back to
// "empty, click to cook" state.

import { Entity, engine } from '@dcl/sdk/ecs'

import { ActiveCook } from '../components'
import { addCollected } from './inventoryState'

export function grabCookOutput(platform: Entity, itemId: string): boolean {
  const cook = ActiveCook.getOrNull(platform)
  if (cook === null) return false
  addCollected(itemId, 1)
  for (const sprite of cook.foodSprites) {
    engine.removeEntity(sprite)
  }
  if (cook.fireSprite !== engine.RootEntity) {
    engine.removeEntity(cook.fireSprite)
  }
  ActiveCook.deleteFrom(platform)
  return true
}
