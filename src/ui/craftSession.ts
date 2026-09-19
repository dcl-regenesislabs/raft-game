import { isMultiplayer, sendWorldAction } from '../client/multiplayerState'
import { getCraftStation } from './craftContext'
import { worldEntityId } from '../client/worldEntities'
import { equipCraftedItem } from '../systems/nativeEquipment'
import { recipeUnlocked, metric, recordProgress } from '../progression/state'
import { recipeMatchesContext } from './craftContext'
import { recordTutorialAction } from './tutorialState'
// Active crafting session. While a craft is in progress, the HUD hides
// every interactive element except a centered progress bar and tool
// systems are blocked through `isInventoryActionLocked`. Materials are
// debited up-front when the craft starts (so the player can't drop them
// mid-craft) and the result is granted on completion.

import { playSfx } from '../audio/sfx'
import { type CraftableItem, getCraftableById } from './craftableItems'
import { addCollected, canReceiveCraft } from './inventoryState'
import { notifyItemReceived } from './itemReceivedNotification'
import { getCombinedCount, subtractFromAll } from './storageSession'

// Default craft duration. Currently 0 — every craft is instant and
// skips the HUD-locking session. The per-item `CraftableItem.craftSec`
// override is preserved so individual recipes can re-introduce a
// duration later without touching the session machinery.
const CRAFT_TIME = 0

let activeId: string | null = null
let activeDurationSec = CRAFT_TIME
let elapsedSec = 0

export function isCrafting(): boolean {
  return activeId !== null
}

export function getCraftProgress(): number {
  if (activeId === null) return 0
  if (activeDurationSec <= 0) return 1
  return Math.min(1, elapsedSec / activeDurationSec)
}

export function getActiveCraft(): CraftableItem | null {
  return activeId !== null ? getCraftableById(activeId) : null
}

export function getCraftBlockReason(id: string): string | null {
  const item = getCraftableById(id)
  if (!item) return 'UNKNOWN ITEM'
  if (isCrafting()) return 'CRAFTING'
  if (!recipeUnlocked(id)) return 'REACH NEXT MILESTONE'
  if (!recipeMatchesContext(item.station)) return 'USE STATION'
  for (const cost of item.cost) {
    if (getCombinedCount(cost.materialId) < cost.amount) return 'NEED ITEMS'
  }
  return canReceiveCraft(item.id, item.cost, item.outputCount ?? 1) ? null : 'PACK FULL'
}

export function canStartCraft(id: string): boolean {
  return getCraftBlockReason(id) === null
}

export function startCraft(id: string): boolean {
  if (isMultiplayer()) return sendWorldAction({ kind: 'craft', item: id, station: worldEntityId(getCraftStation()) })
  if (isCrafting()) return false
  const item = getCraftableById(id)
  if (item === null) return false
  if (!canStartCraft(id)) return false
  // Pulls from the player's pocket first, then any placed storage —
  // see `subtractFromAll`. Recipes are debited up-front so the player
  // can't move materials out of a chest mid-craft.
  for (const cost of item.cost) {
    subtractFromAll(cost.materialId, cost.amount)
  }
  const duration = item.craftSec ?? CRAFT_TIME
  if (duration <= 0) {
    // Instant craft — skip the session entirely so the HUD never locks.
    addCollected(id, item.outputCount ?? 1)
    notifyItemReceived(id, item.outputCount ?? 1)
    metric('crafted:' + id, item.outputCount ?? 1)
    recordProgress('crafted:' + id)
    if (id === 'rope' || id === 'hammer') recordTutorialAction(id)
    equipCraftedItem(id)
    return true
  }
  activeId = id
  activeDurationSec = duration
  elapsedSec = 0
  playSfx('craftStart')
  return true
}

export function craftSessionTickSystem(dt: number): void {
  if (activeId === null) return
  elapsedSec += dt
  if (elapsedSec >= activeDurationSec) {
    addCollected(activeId, getCraftableById(activeId)?.outputCount ?? 1)
    notifyItemReceived(activeId, getCraftableById(activeId)?.outputCount ?? 1)
    recordProgress('crafted:' + activeId)
    if (activeId === 'rope' || activeId === 'hammer') recordTutorialAction(activeId)
    equipCraftedItem(activeId)
    activeId = null
    elapsedSec = 0
  }
}
