// Active crafting session. While a craft is in progress, the HUD hides
// every interactive element except a centered progress bar and tool
// systems are blocked through `isInventoryActionLocked`. Materials are
// debited up-front when the craft starts (so the player can't drop them
// mid-craft) and the result is granted on completion.

import { type CraftableItem, getCraftableById } from './craftableItems'
import { addCollected } from './inventoryState'
import { notifyItemReceived } from './itemReceivedNotification'
import { getCombinedCount, subtractFromAll } from './storageSession'

// Default craft duration. Individual recipes can override via
// `CraftableItem.craftSec` — e.g. platforms snap together in a second
// while tools take the full default.
const CRAFT_DEFAULT_SEC = 4

let activeId: string | null = null
let activeDurationSec = CRAFT_DEFAULT_SEC
let elapsedSec = 0

export function isCrafting(): boolean {
  return activeId !== null
}

export function getCraftProgress(): number {
  if (activeId === null) return 0
  return Math.min(1, elapsedSec / activeDurationSec)
}

export function getActiveCraft(): CraftableItem | null {
  return activeId !== null ? getCraftableById(activeId) : null
}

export function canStartCraft(id: string): boolean {
  const item = getCraftableById(id)
  if (item === null) return false
  for (const cost of item.cost) {
    if (getCombinedCount(cost.materialId) < cost.amount) return false
  }
  return true
}

export function startCraft(id: string): boolean {
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
  activeId = id
  activeDurationSec = item.craftSec ?? CRAFT_DEFAULT_SEC
  elapsedSec = 0
  return true
}

export function craftSessionTickSystem(dt: number): void {
  if (activeId === null) return
  elapsedSec += dt
  if (elapsedSec >= activeDurationSec) {
    addCollected(activeId, 1)
    notifyItemReceived(activeId, 1)
    activeId = null
    elapsedSec = 0
  }
}
