// Per-placement material cost for a raft platform tile. Owned here (and
// not in `craftableItems.ts`) because the platform is no longer a craftable
// item — the hammer consumes raw materials directly each time the player
// places a tile. Both `placement.ts` and the bottom-bar cost label read
// this constant so they can't drift out of sync.
//
// Cost is paid from the **combined** pool of the player's pocket and every
// placed storage chest, mirroring how the craft panel deducts materials.

import { getCombinedCount, subtractFromAll } from '../../ui/storageSession'

export interface PlatformMaterialCost {
  id: string
  amount: number
}

export const PLATFORM_COST: readonly PlatformMaterialCost[] = [
  { id: 'wood', amount: 2 },
  { id: 'plastic', amount: 2 },
  { id: 'rope', amount: 1 }
]

// Total of `id` available to spend — player pocket plus every placed
// storage chest. Used by the cost label and `canAffordPlatform`, so the
// HUD and the click guard always agree.
export function getPlatformMaterialAvailable(id: string): number {
  return getCombinedCount(id)
}

export function canAffordPlatform(): boolean {
  for (const { id, amount } of PLATFORM_COST) {
    if (getCombinedCount(id) < amount) return false
  }
  return true
}

// Caller must check `canAffordPlatform()` first — this iterates the cost
// rows and drains unconditionally (pocket first, then each storage in
// iteration order, matching the craft panel's behaviour).
export function spendPlatformCost(): void {
  for (const { id, amount } of PLATFORM_COST) {
    subtractFromAll(id, amount)
  }
}
