// Cooking menu open/close state. Unlike inventory and craft, the cooking
// menu has no HUD toggle button — it opens when the player clicks a
// placed grill in the world (see `systems/constructionInteract.ts`)
// and closes via the X in the menu's own corner. Mutually exclusive
// with inventory and craft: opening cooking closes both.
//
// Cell placements PERSIST across opens. They're symbolic — nothing is
// debited from the inventory on placement (see `cookSlots.ts`) — so
// the player can step away to gather missing ingredients and come
// back to find the same recipe still half-built. Only the picked
// source is cleared on close so the next open doesn't carry a stale
// "drag" between sessions.

import { Entity } from '@dcl/sdk/ecs'

import { clearActiveCookGrill, setActiveCookGrill } from './cookSession'
import { clearPickedIngredient } from './cookSlots'
import { setCraftOpen } from './craftToggle'
import { setInventoryOpen } from './inventoryToggle'
import { closeStorageMenu, isStorageOpen } from './storageToggle'
import { setSystemMenuOpen } from './systemSession'

let open = false

export function isCookOpen(): boolean {
  return open
}

// Direct setter — used by `inventoryToggle` and `craftToggle` when one
// of the other panels opens, so the cooking menu hides without firing
// any feedback animation it doesn't have to begin with.
export function setCookOpen(target: boolean): void {
  if (open === target) return
  const wasOpen = open
  open = target
  if (wasOpen && !target) {
    clearPickedIngredient()
    clearActiveCookGrill()
  }
}

// Open the cook menu pointed at a specific grill platform. The grill
// reference is what `cookSession.startCook` reads to know where in the
// world to spawn the flame and food sprites.
export function openCookMenu(grill: Entity): void {
  setActiveCookGrill(grill)
  if (open) return
  open = true
  setInventoryOpen(false)
  setCraftOpen(false)
  if (isStorageOpen()) closeStorageMenu()
  setSystemMenuOpen(false)
}

export function closeCookMenu(): void {
  setCookOpen(false)
}
