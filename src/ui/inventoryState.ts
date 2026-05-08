// State for the bottom-bar inventory: which slot is selected and how recently
// each slot was pressed. The press timer drives a short scale/glow pulse on
// every tap so mobile users get clear feedback.

import { InputAction, inputSystem } from '@dcl/sdk/ecs'

import {
  type HeldItemKind,
  setHeldCup,
  setHeldFood,
  setHeldItem
} from '../factories/heldItem'
import { getFoodEffect } from './foodEffects'
import { isInventoryOpen } from './inventoryToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_TOTAL_SLOTS,
  type ItemDef,
  clearInventorySlot,
  ensureCollectibleSlot,
  getCatalogItem,
  getInventorySlot,
  getItemDisplayName,
  transmuteSlot
} from './items'
import { showNotification } from './notification'
import { restoreStat } from './statsBars'

// Per-id warning surfaced when the player equips a food/drink that has a
// negative side effect. Shown via the standard notification banner so the
// player gets a clear "don't eat this" cue *before* committing to the bite.
const FOOD_WARNINGS: Record<string, string> = {
  saltWater: 'Salt water will dehydrate you — do not drink!',
  sea_salt: 'Eating salt straight will dehydrate you — cook with it!',
  sardines: 'Raw fish will dehydrate you — cook it first!',
  squid: 'Raw squid will dehydrate you — cook it first!',
  mussels: 'Raw mussels will dehydrate you — cook them first!',
  clams: 'Raw clams will dehydrate you — cook them first!',
  crab: 'Raw crab will dehydrate you — cook it first!',
  shark_meat: 'Raw shark meat will dehydrate you — cook it first!'
}

// The bottom bar shows the first BOTTOM_BAR_SLOT_COUNT entries of the
// linear INVENTORY_LAYOUT defined in `items.ts`.
export const SLOT_COUNT = BOTTOM_BAR_SLOT_COUNT
// Total duration of the press feedback animation, seconds.
export const PRESS_DURATION = 0.32

function slotDef(i: number): ItemDef | null {
  return getInventorySlot(i)
}

let selected = 0
const pressElapsed: number[] = new Array(SLOT_COUNT).fill(PRESS_DURATION + 1)
const pressCount: number[] = new Array(SLOT_COUNT).fill(0)
// Wall-clock ms timestamp of the most recent selectSlot() call, or -1 if
// nothing has been explicitly selected yet. Drives the transient hot-bar
// label that surfaces the equipped item's name for ~1.5s after a swap.
let selectedAtMs = -1
// How long the transient label stays visible after a slot change, seconds.
export const BOTTOM_BAR_LABEL_DURATION = 1.5

// True from the moment a slot is selected via UI click until the player
// releases the pointer. Prevents the same click that equipped the item from
// also activating it (throwing the hook, stabbing the spear, etc.).
let pointerLockoutFromSelection = false

export function getSlotItem(i: number): ItemDef | null {
  return slotDef(i)
}

export function getSlotTextures(): readonly string[] {
  const out: string[] = new Array(SLOT_COUNT)
  for (let i = 0; i < SLOT_COUNT; i++) {
    out[i] = slotDef(i)?.texture ?? ''
  }
  return out
}

export function getSlotKind(i: number): HeldItemKind | null {
  return slotDef(i)?.heldKind ?? null
}

export function getSlotHasAction(i: number): boolean {
  return slotDef(i)?.hasAction ?? false
}

export function isSlotSelectable(i: number): boolean {
  return slotDef(i)?.selectable ?? false
}

export function getSelectedSlot(): number {
  return selected
}

export function selectSlot(i: number): void {
  if (i < 0 || i >= SLOT_COUNT) return
  // Tool switching is disabled while the inventory panel is open.
  if (isInventoryOpen()) return
  // Materials surfaced on the bar (e.g. the raft/platforms slot) are
  // display-only — clicking them is a no-op. Gate here so the gate covers
  // every caller, not just the bottom-bar UI.
  if (!isSlotSelectable(i)) return
  const def = slotDef(i)
  selected = i
  pressElapsed[i] = 0
  pressCount[i]++
  selectedAtMs = Date.now()
  pointerLockoutFromSelection = true
  if (def === null) return
  const warning = FOOD_WARNINGS[def.id]
  if (warning !== undefined) showNotification(warning)
  // Consumables (food) equip as a textured plane held in front of the
  // camera. The actual eating is deferred to `systems/foodEat.ts`,
  // which watches for the fire input and runs the consume animation.
  if (def.consumable) {
    setHeldFood(def.id, def.texture)
    return
  }
  // Containers (cup / salt-water cup / fresh-water cup) ride the same
  // sprite-in-hand path as food but their fire press is captured by the
  // container-action system instead. heldKind 'cup' tells foodEat to
  // leave the press alone — it only consumes 'food'-kind items.
  if (def.heldKind === 'cup') {
    setHeldCup(def.id, def.texture)
    return
  }
  const kind = def.heldKind
  if (kind !== null) setHeldItem(kind)
}

// Drink the contents of a container slot: apply the effect for the
// liquid (uses the same FOOD_EFFECTS table the food-eat path reads) and
// transmute the slot back to an empty cup so the player keeps the
// vessel. No-op if the slot is empty or doesn't currently hold a
// drinkable container variant. Returns true on success so the caller
// can gate animation/feedback on it.
export function drinkContainerSlot(
  slotIndex: number,
  containerId: string
): boolean {
  const def = getInventorySlot(slotIndex)
  if (def === null) return false
  if (def.id !== containerId) return false
  const effect = getFoodEffect(containerId)
  if (!transmuteContainerSlot(slotIndex, 'cup')) return false
  if (effect !== null) {
    const hunger = (effect.hunger ?? 0) / 100
    const hungerBonus = (effect.hungerBonus ?? 0) / 100
    const thirst = (effect.thirst ?? 0) / 100
    if (hunger !== 0 || hungerBonus !== 0) {
      restoreStat('hunger', hunger, hungerBonus)
    }
    if (thirst !== 0) {
      restoreStat('thirst', thirst)
    }
  }
  return true
}

// Subtract one of the named food (no-op if the stack is empty) and apply
// its hunger/thirst effects. Effects are expressed in the food table's
// 0..100 scale; the stat layer stores 0..1, so each unit divides by 100
// here. "Bonus hunger" routes through `restoreStat` which allows the
// underlying value to exceed 1 as a reserve. Returns true when one was
// actually consumed so the caller can gate animation/feedback on success.
export function consumeFoodById(id: string): boolean {
  const taken = subtractCollected(id, 1)
  if (taken === 0) return false
  const effect = getFoodEffect(id)
  if (effect === null) return true
  const hunger = (effect.hunger ?? 0) / 100
  const hungerBonus = (effect.hungerBonus ?? 0) / 100
  const thirst = (effect.thirst ?? 0) / 100
  if (hunger !== 0 || hungerBonus !== 0) {
    restoreStat('hunger', hunger, hungerBonus)
  }
  if (thirst !== 0) {
    restoreStat('thirst', thirst)
  }
  return true
}

// True until the player releases the pointer after the click that selected
// a slot. Tool systems (hookThrower, spearAttack) skip their PET_DOWN logic
// while this is set so the equip-click doesn't double as a fire-click.
export function isSelectionPointerLockoutActive(): boolean {
  return pointerLockoutFromSelection
}

// Monotonic counter incremented on every press of slot `i`. Consumers cache
// the last value they saw to detect re-presses (useful for toggles where the
// selection didn't change but the user pressed the same slot again).
export function getSlotPressCount(i: number): number {
  return pressCount[i] ?? 0
}

// Display name of the most-recently-selected hot-bar item, for the brief
// window after a slot change. Returns null once the window has elapsed,
// before the player has selected anything, or if the slot is empty.
export function getBottomBarSelectedLabel(): string | null {
  if (selectedAtMs < 0) return null
  const elapsedSec = (Date.now() - selectedAtMs) / 1000
  if (elapsedSec > BOTTOM_BAR_LABEL_DURATION) return null
  const def = slotDef(selected)
  if (def === null) return null
  return getItemDisplayName(def)
}

// 0 = idle, 1 = just pressed; linear decay over PRESS_DURATION.
export function getPressProgress(i: number): number {
  const e = pressElapsed[i]
  if (e >= PRESS_DURATION) return 0
  return 1 - e / PRESS_DURATION
}

export function tickInventoryAnim(dt: number): void {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (pressElapsed[i] <= PRESS_DURATION) {
      pressElapsed[i] += dt
    }
  }
  // Clear the pointer lockout the first frame the player is no longer
  // holding the pointer — i.e. the click that triggered the selection has
  // ended. From the next press onward, normal fire/throw behavior resumes.
  if (
    pointerLockoutFromSelection &&
    !inputSystem.isPressed(InputAction.IA_POINTER)
  ) {
    pointerLockoutFromSelection = false
  }
}

// --- collected-garbage tally ---
//
// Counts of each debris kind the player has fished up. Populated by the
// hook-throw collector (`systems/hookThrower.ts`) and read by the HUD when
// it eventually surfaces these counts. Decoupled from the slot system so a
// future "resources" panel can render them however it wants.

const collectedCounts = new Map<string, number>()

// Add `count` of `kind` to the player's pocket, capped at the item's
// `maxStackSize` (see `items.ts`). Returns the count actually accepted —
// when the stack is at cap, accepted is 0 and the caller is expected to
// either drop the overflow (debris collection) or refund it (storage
// withdrawals leave the remainder in the chest). Items without a
// `maxStackSize` (legacy / non-stackable) accept the full count.
export function addCollected(kind: string, count: number = 1): number {
  if (count <= 0) return 0
  // Make sure the item has a visible slot before bumping the count.
  // Looks up materials and craftables; for ids already in the starter
  // layout (e.g. hammer, spear) the slot exists so this is a no-op and
  // the count just tracks internally without duplicating the slot.
  ensureCollectibleSlot(kind)
  const cur = collectedCounts.get(kind) ?? 0
  const cap = getCatalogItem(kind)?.maxStackSize
  const accepted =
    cap === undefined ? count : Math.max(0, Math.min(count, cap - cur))
  if (accepted <= 0) return 0
  collectedCounts.set(kind, cur + accepted)
  return accepted
}

export function getCollectedCount(kind: string): number {
  return collectedCounts.get(kind) ?? 0
}

// Decrement the player's tally, clamped at zero. Returns the count that
// was actually subtracted so callers can detect insufficient materials.
// When the stack hits zero, the matching inventory grid slot is dropped
// so the icon doesn't linger as a ghost with no count badge — the next
// pickup re-allocates a fresh slot. Slot 0 (the hook starter) is the
// only permanently-reserved slot; everything else, including the rest
// of the bottom bar, is allocated on demand by `ensureCollectibleSlot`.
export function subtractCollected(kind: string, count: number = 1): number {
  if (count <= 0) return 0
  const cur = collectedCounts.get(kind) ?? 0
  const taken = Math.min(cur, count)
  const next = cur - taken
  collectedCounts.set(kind, next)
  if (next === 0) clearEmptyStackableSlot(kind)
  return taken
}

function clearEmptyStackableSlot(id: string): void {
  for (let i = BOTTOM_BAR_SLOT_COUNT; i < INVENTORY_TOTAL_SLOTS; i++) {
    const def = getInventorySlot(i)
    if (def !== null && def.id === id) {
      clearInventorySlot(i)
      return
    }
  }
}

export function getAllCollected(): ReadonlyMap<string, number> {
  return collectedCounts
}

// Wipes the collected-counts ledger and snaps the bottom-bar selection
// back to slot 0. Paired with `resetInventoryLayout()` for the death-screen
// Play Again flow — the inventory layout reset would leave stale counts
// pointing at item ids that no longer have a slot.
export function resetInventoryState(): void {
  collectedCounts.clear()
  selected = 0
  for (let i = 0; i < SLOT_COUNT; i++) {
    pressElapsed[i] = PRESS_DURATION + 1
    pressCount[i] = 0
  }
  selectedAtMs = -1
  pointerLockoutFromSelection = false
}

// Convert a slot's item id in place (e.g. cup → saltWater → freshWater
// → cup). Keeps the per-id `collectedCounts` map in lockstep so any
// "do I have at least one?" check downstream sees the right answer.
// Refreshes the held viewmodel when the transmuted slot is the one
// currently equipped — otherwise the stale sprite would persist on the
// camera until the player re-selected the slot.
export function transmuteContainerSlot(
  slotIndex: number,
  newId: string
): boolean {
  const oldDef = getInventorySlot(slotIndex)
  if (oldDef === null) return false
  if (!transmuteSlot(slotIndex, newId)) return false
  const oldCount = collectedCounts.get(oldDef.id) ?? 0
  collectedCounts.set(oldDef.id, Math.max(0, oldCount - 1))
  collectedCounts.set(newId, (collectedCounts.get(newId) ?? 0) + 1)
  if (slotIndex === selected) {
    const def = getInventorySlot(slotIndex)
    if (def !== null && def.heldKind === 'cup') {
      setHeldCup(def.id, def.texture)
    }
  }
  return true
}
