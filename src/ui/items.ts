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

// Items the player gets from crafting. Stackable entries collapse into
// a single inventory slot whose count badge bumps each craft (same flow
// as materials). Non-stackable entries allocate a fresh slot on every
// craft — there is no shared "count of hammers", each crafted instance
// occupies its own cell in the grid.
const CRAFTED_STACK = (id: string, texture: string): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: false,
  heldKind: null,
  hasAction: false
})

// Stackable, equippable item that doesn't swap the first-person viewmodel
// (heldKind: null) but does surface an action button on mobile so touch
// players can commit a placement. Used for "place on platform" items
// like the grill and water purifier — selecting the slot enters the
// placement system's hover-to-place loop, click commits and consumes one.
const CRAFTED_PLACEABLE = (id: string, texture: string): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: true,
  heldKind: null,
  hasAction: true
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
  // Default loadout: three core tools, then the two placeable construction
  // items pre-pinned to the bar so the player can swap straight into them
  // without opening the inventory grid first.
  TOOL('hook', 'images/hud/items/item-00.png', 'hook'),
  TOOL('hammer', 'images/hud/items/item-01.png', 'hammer'),
  TOOL('spear', 'images/hud/items/item-19.png', 'spear'),
  CRAFTED_PLACEABLE('grill', 'images/hud/items/item-07.png'),
  CRAFTED_PLACEABLE('purifier', 'images/hud/items/item-06.png')
]

while (layout.length < INVENTORY_TOTAL_SLOTS) layout.push(null)

// Exported as a readonly view, but the underlying array is mutable so the
// drag-and-drop system can reorder slots in place. UI consumers iterate
// this array on every render, so writes propagate immediately.
export const INVENTORY_LAYOUT: readonly (ItemDef | null)[] = layout

// Material catalogue. Materials are NOT pre-placed in the layout — they
// only get a slot the first time the player actually collects one. This
// way a fresh inventory shows just the starter tools, and the very first
// pickup of each material lands in the leftmost empty slot (so it pops up
// on the bottom bar before overflowing into the panel grid).
const MATERIAL_CATALOG: Record<string, ItemDef> = {
  wood: MATERIAL('wood', 'images/hud/items/item-02.png'),
  plants: MATERIAL('plants', 'images/hud/items/item-04.png'),
  plastic: MATERIAL('plastic', 'images/hud/items/item-03.png'),
  rope: MATERIAL('rope', 'images/hud/items/item-05.png'),
  metal: MATERIAL('metal', 'images/hud/items/item-08.png')
}

const CRAFTED_CATALOG: Record<string, ItemDef> = {
  // Tools mirror the starter-layout TOOL defs so a crafted hammer/spear
  // behaves identically to the one the player started with — same icon,
  // same equippable behaviour, same heldKind viewmodel.
  hammer: TOOL('hammer', 'images/hud/items/item-01.png', 'hammer'),
  spear: TOOL('spear', 'images/hud/items/item-19.png', 'spear'),
  platform: CRAFTED_STACK('platform', 'images/hud/items/item-20.png'),
  purifier: CRAFTED_PLACEABLE('purifier', 'images/hud/items/item-06.png'),
  grill: CRAFTED_PLACEABLE('grill', 'images/hud/items/item-07.png'),
  fishingRod: CRAFTED_STACK('fishingRod', 'images/hud/items/item-15.png'),
  knife: CRAFTED_STACK('knife', 'images/hud/items/item-16.png'),
  cup: CRAFTED_STACK('cup', 'images/hud/items/item-09.png')
}

const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  layout.filter((item): item is ItemDef => item !== null).map((item) => [item.id, item])
)

export function getItem(id: string): ItemDef | undefined {
  return ITEMS_BY_ID[id]
}

// Material lookup independent of whether the player has collected one yet.
// The craft panel needs material icons before the player owns any.
export function getMaterialDef(id: string): ItemDef | null {
  return MATERIAL_CATALOG[id] ?? null
}

export function getInventorySlot(index: number): ItemDef | null {
  return layout[index] ?? null
}

// Find the slot index currently holding the item with this id, or -1 if
// none. Linear scan over a 30-slot list is fine — this is called once per
// pickup, not per frame.
function findSlotIndexById(id: string): number {
  for (let i = 0; i < layout.length; i++) {
    if (layout[i]?.id === id) return i
  }
  return -1
}

function findFirstEmptySlot(): number {
  for (let i = 0; i < layout.length; i++) {
    if (layout[i] === null) return i
  }
  return -1
}

// Place an item from the material/crafted catalog into the inventory.
// Stackable items collapse into one slot (idempotent — repeated calls
// reuse the existing slot and the caller bumps the count). Non-stackable
// items allocate a fresh slot on every call so each crafted tool occupies
// its own cell. Returns the slot index, or -1 if the inventory is full
// or the id isn't in either catalog.
export function ensureCollectibleSlot(id: string): number {
  const def = MATERIAL_CATALOG[id] ?? CRAFTED_CATALOG[id]
  if (def === undefined) return -1
  if (def.stackable) {
    const existing = findSlotIndexById(id)
    if (existing !== -1) return existing
  }
  const target = findFirstEmptySlot()
  if (target === -1) return -1
  layout[target] = def
  ITEMS_BY_ID[def.id] = def
  return target
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
