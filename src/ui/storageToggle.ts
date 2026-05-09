// Storage menu open/close state. Mirrors `cookToggle.ts`: the storage
// menu has no HUD toggle button — it opens when the player taps a placed
// storage construction (see `systems/constructionInteract.ts`) and closes
// via the X in the menu's top-right corner. Mutually exclusive with
// inventory, craft, and cook menus.
//
// State is keyed to the storage entity that's currently open: closing
// the menu clears the active reference, so re-opening targets a fresh
// per-entity contents component.

import { Entity } from '@dcl/sdk/ecs'

import { setCookOpen } from './cookToggle'
import { setCraftOpen } from './craftToggle'
import { setInventoryOpen } from './inventoryToggle'
import { clearStoragePick } from './storageSession'
import { setSystemMenuOpen } from './systemSession'

let open = false
let activeStorage: Entity | null = null
// Brief window after closing where world-action systems treat the menu
// as still locking. Same value the inventory/cook flows use so the
// close-click can't fall through to a tool press or world tap.
const POST_CLOSE_LOCKOUT_S = 1.0
let postCloseLockoutSec = 0

export function isStorageOpen(): boolean {
  return open
}

export function getActiveStorage(): Entity | null {
  return activeStorage
}

export function isStorageActionLocked(): boolean {
  return open || postCloseLockoutSec > 0
}

export function openStorageMenu(entity: Entity): void {
  activeStorage = entity
  if (open) return
  open = true
  setInventoryOpen(false)
  setCraftOpen(false)
  setCookOpen(false)
  setSystemMenuOpen(false)
}

export function closeStorageMenu(): void {
  if (!open) return
  open = false
  postCloseLockoutSec = POST_CLOSE_LOCKOUT_S
  clearStoragePick()
  activeStorage = null
}

export function storageToggleResetSystem(dt: number): void {
  if (postCloseLockoutSec > 0) {
    postCloseLockoutSec = Math.max(0, postCloseLockoutSec - dt)
  }
}
