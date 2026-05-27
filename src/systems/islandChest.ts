import {
  InputAction,
  PointerEventType,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { FloatingIsland, IslandChest } from '../components'
import { playChestOpenAnimation } from '../factories/islandChest'
import { getCookableById, getTier4RecipeIds } from '../ui/cookableItems'
import { addCollected } from '../ui/inventoryState'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { isRecipeLearned, markRecipeLearned } from '../ui/learnedRecipes'
import { showNotification } from '../ui/notification'
import { randInt } from '../utils/math'

const TIER4_INGREDIENT_POOL = [
  'spaghetti', 'shark_meat', 'tomatoes', 'olive_oil',
  'fettuccine', 'squid', 'crab'
] as const

function getUnlearnedTier4Ids(): string[] {
  return getTier4RecipeIds().filter((id) => !isRecipeLearned(id)) as string[]
}

function rollTier4Ingredients(): void {
  const drops = randInt(2, 4)
  for (let i = 0; i < drops; i++) {
    const pick = TIER4_INGREDIENT_POOL[
      Math.floor(Math.random() * TIER4_INGREDIENT_POOL.length)
    ]
    addCollected(pick, 1)
    notifyItemReceived(pick, 1)
  }
}

function rollChestLoot(): void {
  const unlearned = getUnlearnedTier4Ids()
  const giveRecipe = unlearned.length > 0 && Math.random() < 0.75

  if (giveRecipe) {
    const pick = unlearned[Math.floor(Math.random() * unlearned.length)]
    markRecipeLearned(pick)
    const recipe = getCookableById(pick)
    showNotification(`NEW RECIPE: ${recipe?.name ?? pick}`)
  } else {
    rollTier4Ingredients()
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
      InputAction.IA_PRIMARY,
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
