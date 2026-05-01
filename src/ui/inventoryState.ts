// State for the bottom-bar inventory: which slot is selected and how recently
// each slot was pressed. The press timer drives a short scale/glow pulse on
// every tap so mobile users get clear feedback.

export const SLOT_COUNT = 5
// Total duration of the press feedback animation, seconds.
export const PRESS_DURATION = 0.32
// How often the placeholder loadout reshuffles (seconds). Stand-in for real
// inventory state — drop this once gameplay drives slot contents.
export const SHUFFLE_INTERVAL = 5

const ITEM_COUNT = 15
const ITEM_TEXTURES: string[] = Array.from(
  { length: ITEM_COUNT },
  (_, i) => `images/hud/items/item-${String(i).padStart(2, '0')}.png`
)

function pickRandomLoadout(): string[] {
  return Array.from(
    { length: SLOT_COUNT },
    () => ITEM_TEXTURES[Math.floor(Math.random() * ITEM_TEXTURES.length)]
  )
}

let selected = 0
const pressElapsed: number[] = new Array(SLOT_COUNT).fill(PRESS_DURATION + 1)
let slotItems: string[] = pickRandomLoadout()
let shuffleElapsed = 0

export function getSlotItems(): readonly string[] {
  return slotItems
}

export function getSelectedSlot(): number {
  return selected
}

export function selectSlot(i: number): void {
  if (i < 0 || i >= SLOT_COUNT) return
  selected = i
  pressElapsed[i] = 0
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
  shuffleElapsed += dt
  if (shuffleElapsed >= SHUFFLE_INTERVAL) {
    shuffleElapsed -= SHUFFLE_INTERVAL
    slotItems = pickRandomLoadout()
  }
}
