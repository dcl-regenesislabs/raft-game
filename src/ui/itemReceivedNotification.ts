// Banner shown when the player gains items: fishing rod catches, hook
// pickups, shark hits, cook outputs, craft outputs, purify byproducts.
// Renders the actual item icons (one per distinct id) with a "+N" badge,
// so the player sees what they got without parsing text.
//
// Calls to `notifyItemReceived` within a short aggregation window land in
// the same banner so a single hook throw that brings back wood + rope +
// ingredients shows up as one notification instead of three rapid swaps.
// Lifecycle: ENTER (slide down) → HOLD → EXIT (slide up). Driven by
// `tickItemReceivedNotification(dt)` registered as a system in
// `src/index.ts`.

import { getCatalogItem } from './items'

const ENTER_DURATION = 0.35
const HOLD_DURATION = 3.0
const EXIT_DURATION = 0.5
// Items added within this many seconds of the previous addition merge
// into the same banner. Tuned to comfortably cover same-frame and
// next-frame additions across the various acquisition systems.
const AGG_WINDOW = 0.18

export interface ItemReceivedItem {
  id: string
  texture: string
  count: number
}

interface ActiveBanner {
  items: ItemReceivedItem[]
  elapsed: number
}

let pending = new Map<string, number>()
let pendingElapsed = 0
let active: ActiveBanner | null = null

export function notifyItemReceived(id: string, count: number = 1): void {
  if (count <= 0) return
  pending.set(id, (pending.get(id) ?? 0) + count)
  pendingElapsed = 0
}

function flushPending(): void {
  const items: ItemReceivedItem[] = []
  for (const [id, count] of pending) {
    const def = getCatalogItem(id)
    if (def === null) continue
    items.push({ id, texture: def.texture, count })
  }
  pending = new Map()
  pendingElapsed = 0
  if (items.length === 0) return
  // Replace any in-flight banner so the freshest acquisition is what the
  // player sees — same semantics as the text `showNotification`.
  active = { items, elapsed: 0 }
}

export function tickItemReceivedNotification(dt: number): void {
  if (pending.size > 0) {
    pendingElapsed += dt
    if (pendingElapsed >= AGG_WINDOW) flushPending()
  }
  if (active === null) return
  active.elapsed += dt
  const total = ENTER_DURATION + HOLD_DURATION + EXIT_DURATION
  if (active.elapsed >= total) active = null
}

export interface ItemReceivedView {
  items: ReadonlyArray<ItemReceivedItem>
  // 0 = fully offscreen, 1 = fully resting at on-screen position.
  slide: number
}

export function getItemReceivedView(): ItemReceivedView | null {
  if (active === null) return null
  const e = active.elapsed
  let slide: number
  if (e < ENTER_DURATION) {
    const t = e / ENTER_DURATION
    slide = 1 - Math.pow(1 - t, 3)
  } else if (e < ENTER_DURATION + HOLD_DURATION) {
    slide = 1
  } else {
    const t = (e - ENTER_DURATION - HOLD_DURATION) / EXIT_DURATION
    slide = 1 - t * t * t
  }
  return { items: active.items, slide }
}

export function resetItemReceivedNotification(): void {
  pending = new Map()
  pendingElapsed = 0
  active = null
}
