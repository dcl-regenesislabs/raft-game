// Single source of truth for every item the player can hold or collect.
// The inventory is one linear 30-slot list: indices 0–4 are the bottom
// hot-bar, 5–29 are the 5×5 inventory panel grid. Slots can be `null` for
// empty placements.

import type { HeldItemKind } from '../factories/heldItem'

export interface ItemDef {
  // Unique, stable id. Doubles as the key for `addCollected/getCollectedCount`
  // when the item is stackable, so the in-world collector and the UI agree.
  id: string
  texture: string
  // Stackable items show a count badge in the UI. Non-stackable items
  // (tools) are unique — owning "another" hook is meaningless.
  stackable: boolean
  // Selectable items can be equipped from the bottom bar; clicking a
  // non-selectable slot is a no-op. Materials (plastic, wood, …) are
  // surfaced in the inventory but are not equippable.
  selectable: boolean
  // First-person viewmodel kind to swap in when this item is equipped.
  // Null for items with no held representation yet.
  heldKind: HeldItemKind | null
  // Whether the on-screen action button should appear when this item is
  // selected. Tools that shoot/swing/stab need it; raft drives placement
  // through pointer-events on world entities, not the button.
  hasAction: boolean
}

const TOOL = (
  id: string,
  texture: string,
  heldKind: HeldItemKind
): ItemDef => ({
  id,
  texture,
  stackable: false,
  selectable: true,
  heldKind,
  hasAction: true
})

// Tools that don't yet have a first-person viewmodel or action wired up.
// They occupy a slot and can be selected, but selecting them won't swap
// the viewmodel and won't surface an action button. Promote to TOOL once
// the gameplay system for that tool exists.
const PENDING_TOOL = (id: string, texture: string): ItemDef => ({
  id,
  texture,
  stackable: false,
  selectable: true,
  heldKind: null,
  hasAction: false
})

const MATERIAL = (id: string, texture: string): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: false,
  heldKind: null,
  hasAction: false
})

// Linear inventory layout. First BOTTOM_BAR_SLOT_COUNT entries map to the
// bottom bar in left-to-right order; the rest fill the inventory panel
// grid in row-major order. Pad with null to keep the array length at
// INVENTORY_TOTAL_SLOTS.
export const BOTTOM_BAR_SLOT_COUNT = 5
export const INVENTORY_TOTAL_SLOTS = 30
export const INVENTORY_GRID_SLOT_COUNT =
  INVENTORY_TOTAL_SLOTS - BOTTOM_BAR_SLOT_COUNT

const layout: (ItemDef | null)[] = [
  // ----- Bottom bar (0–4) -----
  // Default loadout: the three core tools. The remaining bar slots and
  // the entire inventory panel start empty; gameplay collectors will
  // populate them as the player picks things up.
  TOOL('hook', 'images/hud/items/item-00.png', 'hook'),
  TOOL('hammer', 'images/hud/items/item-01.png', 'hammer'),
  TOOL('spear', 'images/hud/items/item-19.png', 'spear')
]

while (layout.length < INVENTORY_TOTAL_SLOTS) layout.push(null)

// Exported as a readonly view, but the underlying array is mutable so the
// drag-and-drop system can reorder slots in place. UI consumers iterate
// this array on every render, so writes propagate immediately.
export const INVENTORY_LAYOUT: readonly (ItemDef | null)[] = layout

const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  layout.filter((item): item is ItemDef => item !== null).map((item) => [item.id, item])
)

export function getItem(id: string): ItemDef | undefined {
  return ITEMS_BY_ID[id]
}

export function getInventorySlot(index: number): ItemDef | null {
  return layout[index] ?? null
}

// Swap the contents of two inventory slots. Out-of-range or no-op (a===b)
// calls are silently ignored so callers can pass the raw drag-source /
// drag-target pair without pre-validating.
export function swapInventorySlots(a: number, b: number): void {
  if (a === b) return
  if (a < 0 || a >= layout.length) return
  if (b < 0 || b >= layout.length) return
  const tmp = layout[a]
  layout[a] = layout[b]
  layout[b] = tmp
}
