import { getCatalogItem, PLAYER_STACK_CAP } from '../ui/items'
import { emptySlot, Slot } from './types'

export function count(slots: Slot[], id: string): number {
  return slots.reduce((n, slot) => n + (slot.id === id ? slot.count : 0), 0)
}
export function give(slots: Slot[], id: string, amount: number, storage = false, durability?: number): number {
  const def = getCatalogItem(id)
  if (!def || !Number.isSafeInteger(amount) || amount <= 0) return 0
  let remaining = amount
  const cap = def.stackable ? (storage ? 99 : (def.maxStackSize ?? PLAYER_STACK_CAP)) : 1
  // The current HUD groups stackable items by id, so personal stacks occupy one slot.
  const existing = slots.findIndex((slot) => slot.id === id && def.stackable)
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i]
    if (existing >= 0 && !storage && i !== existing) continue
    if (slot.id !== '' && (slot.id !== id || !def.stackable)) continue
    const accepted = Math.min(cap - slot.count, remaining)
    if (accepted <= 0) continue
    slots[i] = { id, count: slot.count + accepted, durability: durability ?? def.maxDurability ?? 0 }
    remaining -= accepted
    if (!storage && def.stackable) break
  }
  return amount - remaining
}
export function take(slots: Slot[], id: string, amount: number): number {
  let remaining = amount
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i].id !== id) continue
    const n = Math.min(remaining, slots[i].count)
    slots[i].count -= n
    remaining -= n
    if (!slots[i].count) slots[i] = emptySlot()
  }
  return amount - remaining
}
export function wear(slots: Slot[], index: number): void {
  const slot = slots[index]
  if (!slot || !getCatalogItem(slot.id)?.maxDurability) return
  slot.durability--
  if (slot.durability <= 0) slots[index] = emptySlot()
}
