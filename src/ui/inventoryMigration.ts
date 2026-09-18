import { INVENTORY_TOTAL_SLOTS } from './items'

// Preserve slot order where possible, moving old tail slots into empty cells.
// Reject an overfull legacy save before any live game state is changed.
export function fitInventoryToCapacity<T extends { layout: string[]; selected: number; durabilities?: number[] }>(inventory: T): T {
  const occupied = inventory.layout.filter(Boolean).length
  if (occupied > INVENTORY_TOTAL_SLOTS) {
    throw new Error(`This save has ${occupied} occupied inventory slots; the backpack now holds ${INVENTORY_TOTAL_SLOTS}. The save has not been changed.`)
  }
  const layout = inventory.layout.slice(0, INVENTORY_TOTAL_SLOTS)
  while (layout.length < INVENTORY_TOTAL_SLOTS) layout.push('')
  const durabilities = inventory.durabilities?.slice(0, INVENTORY_TOTAL_SLOTS)
  let selected = inventory.selected
  for (let i = INVENTORY_TOTAL_SLOTS; i < inventory.layout.length; i++) {
    if (!inventory.layout[i]) continue
    const target = layout.indexOf('')
    layout[target] = inventory.layout[i]
    if (durabilities) durabilities[target] = inventory.durabilities![i]
    if (selected === i) selected = target
  }
  return { ...inventory, layout, selected, ...(durabilities ? { durabilities } : {}) }
}
