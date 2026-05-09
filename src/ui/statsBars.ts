// Player vital stats: life, hunger, thirst. Each is a 0..1 value driven by
// gameplay systems (eating, drinking, taking damage) and read by the HUD.
// The stat may exceed 1 when a food's "bonus hunger" tops it up over the
// normal cap; the HUD clamps to 1 visually so the bar doesn't overflow,
// but the underlying reserve drains naturally before the visible bar
// starts dropping.

export type StatKind = 'life' | 'hunger' | 'thirst'

// Hard ceiling on any stat including bonus reserves. Sized for the
// largest single bonus in the food table (cooked fish + pasta = +0.40
// over base) plus the base cap, with headroom for stacking.
const STAT_OVERCAP_MAX = 2

const stats: Record<StatKind, number> = {
  life: 1,
  hunger: 1,
  thirst: 1
}

export function getStat(kind: StatKind): number {
  return stats[kind]
}

export function setStat(kind: StatKind, value: number): void {
  stats[kind] = Math.max(0, Math.min(1, value))
}

export function adjustStat(kind: StatKind, delta: number): void {
  setStat(kind, stats[kind] + delta)
}

// Restore a stat by `base` (clamped at the normal 1.0 cap) and then add
// `bonus` on top, allowed to push the underlying value above 1 up to
// STAT_OVERCAP_MAX. Used by food consumption so "Bonus Hunger" entries
// in the food table act as an over-cap reserve.
export function restoreStat(
  kind: StatKind,
  base: number,
  bonus: number = 0
): void {
  const afterBase = Math.max(0, Math.min(1, stats[kind] + base))
  const afterBonus = Math.max(0, Math.min(STAT_OVERCAP_MAX, afterBase + bonus))
  stats[kind] = afterBonus
}

export interface VitalsSnapshot {
  life: number
  hunger: number
  thirst: number
}

export function serializeVitals(): VitalsSnapshot {
  return { life: stats.life, hunger: stats.hunger, thirst: stats.thirst }
}

// Apply saved vitals. Each value is clamped to [0, STAT_OVERCAP_MAX]
// directly (rather than going through setStat, which clamps to 1) so
// over-cap reserves survive a save/load round-trip.
export function hydrateVitals(snapshot: VitalsSnapshot): void {
  stats.life = Math.max(0, Math.min(STAT_OVERCAP_MAX, snapshot.life))
  stats.hunger = Math.max(0, Math.min(STAT_OVERCAP_MAX, snapshot.hunger))
  stats.thirst = Math.max(0, Math.min(STAT_OVERCAP_MAX, snapshot.thirst))
}
