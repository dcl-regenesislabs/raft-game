// Per-entity storage contents + the pick/place state machine that spans
// both panes of the storage menu. Each placed storage carries its own
// `StorageContents` component (created in `factories/construction.ts`),
// so multiple chests on a raft hold independent inventories.
//
// Interaction model (mirrors the existing inventory-drag pattern):
//   1. Click a non-empty slot on either side    → "pick" that slot.
//   2. Click the same slot                       → unpick.
//   3. Click a different slot on the same side   → swap (intra-side).
//   4. Click a slot on the other side            → transfer:
//        - target empty           → move the whole stack across.
//        - target same stackable  → merge counts.
//        - target different item  → refuse (notification). Player can
//          move the occupant out first.
//
// Stackable items keep their reserved player slot even when transferred
// out (count drops to 0; `addCollected` re-uses the same slot on the
// way back). Non-stackables clear the player slot entirely on transfer.

import { Entity } from '@dcl/sdk/ecs'

import { STORAGE_SLOT_COUNT, StorageContents } from '../components'
import {
  addCollected,
  getCollectedCount,
  subtractCollected
} from './inventoryState'
import {
  clearInventorySlot,
  ensureCollectibleSlot,
  getCatalogItem,
  getInventorySlot,
  swapInventorySlots
} from './items'
import { showNotification } from './notification'

export type StorageSide = 'player' | 'storage'
type Picked = { side: StorageSide; index: number } | null

let picked: Picked = null

export function getStoragePicked(): Picked {
  return picked
}

export function clearStoragePick(): void {
  picked = null
}

export interface StorageSlotView {
  id: string
  count: number
}

const EMPTY_VIEW: StorageSlotView = { id: '', count: 0 }

export function getStorageSlotCount(): number {
  return STORAGE_SLOT_COUNT
}

export function readStorageSlot(
  entity: Entity,
  index: number
): StorageSlotView {
  const c = StorageContents.getOrNull(entity)
  if (c === null || index < 0 || index >= c.slots.length) return EMPTY_VIEW
  const s = c.slots[index]
  return { id: s.id, count: s.count }
}

export function isStorageNonEmpty(entity: Entity): boolean {
  const c = StorageContents.getOrNull(entity)
  if (c === null) return false
  for (const s of c.slots) {
    if (s.id !== '' && s.count > 0) return true
  }
  return false
}

// Player-side "is this slot populated" — stackables only count when the
// running tally is positive (the slot may be reserved with count 0),
// non-stackables count whenever the layout slot is occupied.
function isPlayerSlotPopulated(index: number): boolean {
  const def = getInventorySlot(index)
  if (def === null) return false
  if (!def.stackable) return true
  return getCollectedCount(def.id) > 0
}

function isStorageSlotPopulated(entity: Entity, index: number): boolean {
  const s = readStorageSlot(entity, index)
  return s.id !== '' && s.count > 0
}

// Single entry point for both panes. Routes to pick / unpick / swap /
// transfer based on the existing pick state. `storage` is the active
// storage entity for cross-side ops; pass it on every call (the menu
// only renders when one is active anyway).
export function pressStorageSlot(
  side: StorageSide,
  index: number,
  storage: Entity
): void {
  if (picked === null) {
    const populated =
      side === 'player'
        ? isPlayerSlotPopulated(index)
        : isStorageSlotPopulated(storage, index)
    if (!populated) return
    picked = { side, index }
    return
  }

  if (picked.side === side && picked.index === index) {
    picked = null
    return
  }

  if (picked.side === side) {
    if (side === 'player') {
      swapInventorySlots(picked.index, index)
    } else {
      swapStorageSlots(storage, picked.index, index)
    }
    picked = null
    return
  }

  if (side === 'player') {
    transferStorageToPlayer(storage, picked.index, index)
  } else {
    transferPlayerToStorage(storage, picked.index, index)
  }
  picked = null
}

function swapStorageSlots(entity: Entity, a: number, b: number): void {
  if (a === b) return
  const c = StorageContents.getMutable(entity)
  if (a < 0 || a >= c.slots.length) return
  if (b < 0 || b >= c.slots.length) return
  const aCopy = { id: c.slots[a].id, count: c.slots[a].count }
  c.slots[a] = { id: c.slots[b].id, count: c.slots[b].count }
  c.slots[b] = aCopy
}

function transferPlayerToStorage(
  entity: Entity,
  playerIdx: number,
  storageIdx: number
): void {
  const def = getInventorySlot(playerIdx)
  if (def === null) return
  const target = readStorageSlot(entity, storageIdx)

  if (def.stackable) {
    const have = getCollectedCount(def.id)
    if (have <= 0) return
    if (target.id !== '' && target.id !== def.id) {
      showNotification('That slot is already in use.')
      return
    }
    const c = StorageContents.getMutable(entity)
    c.slots[storageIdx] = {
      id: def.id,
      count: target.count + have
    }
    subtractCollected(def.id, have)
    return
  }

  // Non-stackable: each instance is its own slot. Refuse if the storage
  // target slot is already occupied so the player doesn't blow away
  // existing storage contents.
  if (target.id !== '' && target.count > 0) {
    showNotification('That slot is already in use.')
    return
  }
  const c = StorageContents.getMutable(entity)
  c.slots[storageIdx] = { id: def.id, count: 1 }
  clearInventorySlot(playerIdx)
}

function transferStorageToPlayer(
  entity: Entity,
  storageIdx: number,
  playerIdx: number
): void {
  const src = readStorageSlot(entity, storageIdx)
  if (src.id === '' || src.count === 0) return
  const def = getCatalogItem(src.id)
  if (def === null) return

  if (def.stackable) {
    const targetDef = getInventorySlot(playerIdx)
    // Stackables collapse into a single inventory slot; the player's
    // clicked slot is treated as a destination only when it's empty
    // or already holds the same id. Otherwise refuse so we don't
    // displace another item.
    if (targetDef !== null && targetDef.id !== src.id) {
      showNotification('That slot is already in use.')
      return
    }
    addCollected(src.id, src.count)
    const c = StorageContents.getMutable(entity)
    c.slots[storageIdx] = { id: '', count: 0 }
    return
  }

  // Non-stackable: target player slot must be empty. ensureCollectibleSlot
  // allocates a fresh slot wherever's free; swap it into the chosen
  // player slot if it landed elsewhere.
  const targetDef = getInventorySlot(playerIdx)
  if (targetDef !== null) {
    showNotification('That slot is already in use.')
    return
  }
  const created = ensureCollectibleSlot(src.id)
  if (created === -1) {
    showNotification('Inventory is full.')
    return
  }
  if (created !== playerIdx) {
    swapInventorySlots(created, playerIdx)
  }
  const c = StorageContents.getMutable(entity)
  c.slots[storageIdx] = { id: '', count: 0 }
}
