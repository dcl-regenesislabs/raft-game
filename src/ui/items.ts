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
  // Consumable items (food, drink) are eaten on selection: instead of
  // equipping, one is removed from the stack and the food's effects table
  // applies to the player's stats. See `foodEffects.ts`.
  consumable: boolean
  // Items the cook menu accepts as a drop target — raw foods that turn
  // into cooked dishes plus the fuel (wood) that the burner consumes.
  // While the cook menu is open, clicking an inventory slot whose item
  // has `ingredient: true` picks it up so the next click on a cook cell
  // places one unit there. Non-ingredient slots ignore cook-menu clicks.
  ingredient: boolean
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
  hasAction: true,
  consumable: false,
  ingredient: false
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
  hasAction: false,
  consumable: false,
  ingredient: false
})

// Stackable resource (`wood`, `metal`, …). `ingredient` defaults off; the
// few materials the cook menu accepts (currently just wood as fuel) opt
// in by passing `ingredient: true`.
const MATERIAL = (
  id: string,
  texture: string,
  opts: { ingredient?: boolean } = {}
): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: false,
  heldKind: null,
  hasAction: false,
  consumable: false,
  ingredient: opts.ingredient ?? false
})

// Food / drink. Stackable, selectable from the bottom bar. Selecting equips
// the food as a Sprite3D held in front of the camera (see `heldItem.ts`).
// The action button / IA_POINTER then triggers an eating gesture which
// consumes one from the stack and applies the food's hunger/thirst effects.
// See `foodEffects.ts` for the table and `systems/foodEat.ts` for the
// gesture and consumption. Raw foods opt into the cook menu via
// `ingredient: true`; cooked foods don't (you can't re-cook them).
const FOOD = (
  id: string,
  texture: string,
  opts: { ingredient?: boolean } = {}
): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: true,
  heldKind: 'food',
  hasAction: true,
  consumable: true,
  ingredient: opts.ingredient ?? false
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
  hasAction: false,
  consumable: false,
  ingredient: false
})

// Stackable AND equippable tool — collapses into one slot like
// CRAFTED_STACK but the player can also select it from the bar to
// equip a first-person viewmodel and surface the action button.
// Used for the fishing rod (multiple instances stack as durability
// charges, but only one viewmodel is ever held).
const CRAFTED_TOOL_STACK = (
  id: string,
  texture: string,
  heldKind: HeldItemKind
): ItemDef => ({
  id,
  texture,
  stackable: true,
  selectable: true,
  heldKind,
  hasAction: true,
  consumable: false,
  ingredient: false
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
  hasAction: true,
  consumable: false,
  ingredient: false
})

// Container the player equips and uses on the world. Each container
// instance occupies its own inventory slot — they're not stackable
// because the slot's item id IS the container's state (empty cup /
// salt-water cup / fresh-water cup). Filling, purifying, and drinking
// transmute the slot's id in place via `transmuteSlot` rather than
// shuffling stack counts. heldKind 'cup' renders as a sprite in front
// of the camera.
const CRAFTED_CONTAINER = (id: string, texture: string): ItemDef => ({
  id,
  texture,
  stackable: false,
  selectable: true,
  heldKind: 'cup',
  hasAction: true,
  consumable: false,
  ingredient: false
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
  // The hook is the player's only starter tool — every other slot is
  // empty until the player crafts/collects something. `ensureCollectibleSlot`
  // allocates fresh slots on first pickup, so crafted hammers/spears and
  // collected grills/purifiers find a home dynamically (leftmost empty
  // slot, which means the bar fills up first).
  TOOL('hook', 'images/hud/items/item-00.png', 'hook')
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
  // Wood doubles as the cook menu's fuel — `ingredient: true` so the
  // burner slot accepts it. Other materials never enter the cook flow.
  wood: MATERIAL('wood', 'images/hud/items/item-02.png', { ingredient: true }),
  plants: MATERIAL('plants', 'images/hud/items/item-04.png'),
  plastic: MATERIAL('plastic', 'images/hud/items/item-03.png'),
  rope: MATERIAL('rope', 'images/hud/items/item-05.png'),
  metal: MATERIAL('metal', 'images/hud/items/item-08.png'),
  // Coal is the burned-output of the cook flow: a grill left for 120s+
  // turns its plate into coal. Stackable, not an ingredient (you can't
  // re-cook it back into food). Reuses the world-sprite texture as its
  // inventory icon — same PNG.
  coal: MATERIAL('coal', 'images/cooking/coal.png')
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
  storage: CRAFTED_PLACEABLE('storage', 'images/hud/items/storage.png'),
  fishingRod: CRAFTED_TOOL_STACK('fishingRod', 'images/hud/items/item-15.png', 'fishingRod'),
  knife: CRAFTED_STACK('knife', 'images/hud/items/item-16.png'),
  cup: CRAFTED_CONTAINER('cup', 'images/hud/items/item-09.png'),
  // Liquids live in cups: empty cup, salt-water cup, fresh-water cup.
  // Each is a non-stackable container variant — see CRAFTED_CONTAINER
  // above for the mental model. Drinking them is handled by the
  // container-action system, not the food-eat counter.
  saltWater: CRAFTED_CONTAINER('saltWater', 'images/hud/items/item-21.png'),
  freshWater: CRAFTED_CONTAINER('freshWater', 'images/hud/items/item-10.png')
}

// Cooking ingredients gathered from the four world sources documented in
// COOKING.md (fishing rod / barrel / shark hits / purifier byproduct).
// Every entry flags `ingredient: true` so the cook menu accepts it as an
// input cell. Effects when eaten raw live in `foodEffects.ts` — most
// ingredients give a small hunger nudge, a few (sea_salt) only carry a
// thirst penalty so the player avoids snacking on them straight from the
// inventory.
const INGREDIENT_CATALOG: Record<string, ItemDef> = {
  sardines:   FOOD('sardines',   'images/cooking/sardines.png',   { ingredient: true }),
  mussels:    FOOD('mussels',    'images/cooking/mussels.png',    { ingredient: true }),
  clams:      FOOD('clams',      'images/cooking/clams.png',      { ingredient: true }),
  squid:      FOOD('squid',      'images/cooking/squid.png',      { ingredient: true }),
  shark_meat: FOOD('shark_meat', 'images/cooking/shark_meat.png', { ingredient: true }),
  seaweed:    FOOD('seaweed',    'images/cooking/seaweed.png',    { ingredient: true }),
  tomatoes:   FOOD('tomatoes',   'images/cooking/tomatoes.png',   { ingredient: true }),
  garlic:     FOOD('garlic',     'images/cooking/garlic.png',     { ingredient: true }),
  sea_salt:   FOOD('sea_salt',   'images/cooking/sea_salt.png',   { ingredient: true }),
  olive_oil:  FOOD('olive_oil',  'images/cooking/olive_oil.png',  { ingredient: true }),
  potato:     FOOD('potato',     'images/cooking/potato.png',     { ingredient: true }),
  crab:       FOOD('crab',       'images/cooking/crab.png',       { ingredient: true }),
  spaghetti:  FOOD('spaghetti',  'images/cooking/spaghetti.png',  { ingredient: true }),
  fettuccine: FOOD('fettuccine', 'images/cooking/fettuccine.png', { ingredient: true })
}

// Finished plates from the cook menu. 30 recipes split 5 / 15 / 8 / 2 by
// ingredient count — see `cookableItems.ts`. Pasta is now a flavor that
// distributes across tiers rather than its own category. Plates are NOT
// ingredients — once cooked, you eat them, you don't re-cook them.
const PLATE_CATALOG: Record<string, ItemDef> = {
  // 1-ingredient plates (5)
  grilled_sardines:        FOOD('grilled_sardines',        'images/cooking/grilled_sardines.png'),
  boiled_mussels:          FOOD('boiled_mussels',          'images/cooking/boiled_mussels.png'),
  charred_squid:           FOOD('charred_squid',           'images/cooking/charred_squid.png'),
  roasted_potato:          FOOD('roasted_potato',          'images/cooking/roasted_potato.png'),
  grilled_shark_meat:      FOOD('grilled_shark_meat',      'images/cooking/grilled_shark_meat.png'),
  // 2-ingredient plates (15)
  salted_sardines:         FOOD('salted_sardines',         'images/cooking/salted_sardines.png'),
  clam_broth:              FOOD('clam_broth',              'images/cooking/clam_broth.png'),
  garlic_squid:            FOOD('garlic_squid',            'images/cooking/garlic_squid.png'),
  shark_steak:             FOOD('shark_steak',             'images/cooking/shark_steak.png'),
  crab_with_sea_salt:      FOOD('crab_with_sea_salt',      'images/cooking/crab_with_sea_salt.png'),
  sardines_pomodoro:       FOOD('sardines_pomodoro',       'images/cooking/sardines_pomodoro.png'),
  mussels_pomodoro:        FOOD('mussels_pomodoro',        'images/cooking/mussels_pomodoro.png'),
  squid_with_seaweed:      FOOD('squid_with_seaweed',      'images/cooking/squid_with_seaweed.png'),
  crab_with_potato:        FOOD('crab_with_potato',        'images/cooking/crab_with_potato.png'),
  shark_with_potato:       FOOD('shark_with_potato',       'images/cooking/shark_with_potato.png'),
  squid_with_tomato:       FOOD('squid_with_tomato',       'images/cooking/squid_with_tomato.png'),
  shark_with_tomato:       FOOD('shark_with_tomato',       'images/cooking/shark_with_tomato.png'),
  sardines_in_oil:         FOOD('sardines_in_oil',         'images/cooking/sardines_in_oil.png'),
  mussels_and_clams:       FOOD('mussels_and_clams',       'images/cooking/mussels_and_clams.png'),
  spaghetti_pomodoro:      FOOD('spaghetti_pomodoro',      'images/cooking/spaghetti_pomodoro.png'),
  // 3-ingredient plates (8)
  spaghetti_with_sardines: FOOD('spaghetti_with_sardines', 'images/cooking/spaghetti_with_sardines.png'),
  fettuccine_with_shark:   FOOD('fettuccine_with_shark',   'images/cooking/fettuccine_with_shark.png'),
  spaghetti_mussels:       FOOD('spaghetti_mussels',       'images/cooking/spaghetti_mussels.png'),
  fettuccine_squid:        FOOD('fettuccine_squid',        'images/cooking/fettuccine_squid.png'),
  fettuccine_pomodoro:     FOOD('fettuccine_pomodoro',     'images/cooking/fettuccine_pomodoro.png'),
  spaghetti_squid_seaweed: FOOD('spaghetti_squid_seaweed', 'images/cooking/spaghetti_squid_seaweed.png'),
  fettuccine_crab_potato:  FOOD('fettuccine_crab_potato',  'images/cooking/fettuccine_crab_potato.png'),
  seafood_stew:            FOOD('seafood_stew',            'images/cooking/seafood_stew.png'),
  // 4-ingredient hero plates (2)
  spaghetti_alle_vongole:  FOOD('spaghetti_alle_vongole',  'images/cooking/spaghetti_alle_vongole.png'),
  fettuccine_sea_hunter:   FOOD('fettuccine_sea_hunter',   'images/cooking/fettuccine_sea_hunter.png')
}

const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(
  layout.filter((item): item is ItemDef => item !== null).map((item) => [item.id, item])
)

export function getItem(id: string): ItemDef | undefined {
  return ITEMS_BY_ID[id]
}

// Player-facing label derived from the item's id. Splits camelCase
// ('fishingRod' → 'Fishing Rod') and snake_case ('shark_meat' → 'Shark Meat')
// and title-cases each word so HUD overlays don't have to special-case
// each item.
export function getItemDisplayName(def: ItemDef): string {
  return def.id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_\s]+/)
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

// Material lookup independent of whether the player has collected one yet.
// The craft panel needs material icons before the player owns any.
export function getMaterialDef(id: string): ItemDef | null {
  return MATERIAL_CATALOG[id] ?? null
}

// Catalog-wide lookup independent of whether the player currently owns
// the item. Storage slots can hold ids the player isn't currently
// carrying (e.g. wood the player deposited and then no longer has any
// of), so the storage UI needs to resolve metadata from the catalogs
// directly. Order matches `ensureCollectibleSlot` so id collisions
// resolve identically.
export function getCatalogItem(id: string): ItemDef | null {
  return (
    MATERIAL_CATALOG[id] ??
    CRAFTED_CATALOG[id] ??
    INGREDIENT_CATALOG[id] ??
    PLATE_CATALOG[id] ??
    null
  )
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
  const def =
    MATERIAL_CATALOG[id] ??
    CRAFTED_CATALOG[id] ??
    INGREDIENT_CATALOG[id] ??
    PLATE_CATALOG[id]
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

// Replace the item def occupying `slotIndex` with the catalog entry for
// `newId`. Used by container-state transitions (empty cup → salt-water
// cup → fresh-water cup → empty cup) so the slot stays put while its
// contents change. Returns true iff the swap actually applied (slot in
// range, currently occupied, and the new id resolves in either catalog).
export function transmuteSlot(slotIndex: number, newId: string): boolean {
  if (slotIndex < 0 || slotIndex >= layout.length) return false
  if (layout[slotIndex] === null) return false
  const next =
    MATERIAL_CATALOG[newId] ??
    CRAFTED_CATALOG[newId] ??
    INGREDIENT_CATALOG[newId] ??
    PLATE_CATALOG[newId]
  if (next === undefined) return false
  layout[slotIndex] = next
  ITEMS_BY_ID[next.id] = next
  return true
}

// Wipe the inventory back to its starter loadout: the hook in slot 0 and
// every other slot empty. Used by the death-screen Play Again flow so the
// player restarts with the same baseline a fresh scene load gives them.
export function resetInventoryLayout(): void {
  for (let i = 0; i < layout.length; i++) layout[i] = null
  const starters: ItemDef[] = [
    TOOL('hook', 'images/hud/items/item-00.png', 'hook')
  ]
  // Drop everything from the by-id lookup so stale defs from previously
  // collected materials don't survive the reset; re-seed with the starter
  // loadout below.
  for (const id of Object.keys(ITEMS_BY_ID)) delete ITEMS_BY_ID[id]
  for (let i = 0; i < starters.length; i++) {
    layout[i] = starters[i]
    ITEMS_BY_ID[starters[i].id] = starters[i]
  }
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

// Empty a single inventory slot. Used by the storage flow when a
// non-stackable item (knife, cup, tools) is moved out of the player's
// inventory into a storage slot — the slot ceases to exist on the
// player's side. Stackable transfers do NOT call this: stackables keep
// their reserved slot even at zero count.
export function clearInventorySlot(slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= layout.length) return
  layout[slotIndex] = null
}
