// Player vital stats: life, hunger, thirst. Each is a 0..1 value driven by
// gameplay systems (eating, drinking, taking damage) and read by the HUD.

export type StatKind = 'life' | 'hunger' | 'thirst'

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
