// State for the bottom-bar inventory: which slot is selected and how recently
// each slot was pressed. The press timer drives a short scale/glow pulse on
// every tap so mobile users get clear feedback.

import { InputAction, inputSystem } from '@dcl/sdk/ecs'

import { type HeldItemKind, setHeldItem } from '../factories/heldItem'
import { isInventoryOpen } from './inventoryToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  type ItemDef,
  getInventorySlot
} from './items'

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
  selected = i
  pressElapsed[i] = 0
  pressCount[i]++
  pointerLockoutFromSelection = true
  const kind = slotDef(i)?.heldKind ?? null
  if (kind) setHeldItem(kind)
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

export function addCollected(kind: string, count: number = 1): void {
  if (count <= 0) return
  collectedCounts.set(kind, (collectedCounts.get(kind) ?? 0) + count)
}

export function getCollectedCount(kind: string): number {
  return collectedCounts.get(kind) ?? 0
}

export function getAllCollected(): ReadonlyMap<string, number> {
  return collectedCounts
}
