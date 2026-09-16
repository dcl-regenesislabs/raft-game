export type DeviceState = {
  fuel: number
  progress: number
  stock: number
  queued?: number
  ammo: number
  active: boolean
  installed: boolean
}
export function advanceProduction(kind: string, state: DeviceState, dt: number, raining: boolean): void {
  const elapsed = Math.max(0, Math.min(dt, 60))
  if (kind === 'rainCollector' && raining) {
    state.progress += elapsed
    const produced = Math.floor(state.progress / 15)
    state.stock = Math.min(4, state.stock + produced)
    state.progress %= 15
  }
  if (kind === 'cropBed' && state.active) {
    state.progress = Math.min(60, state.progress + elapsed)
    if (state.progress >= 60) {
      state.stock = 3
      state.active = false
    }
  }
  if ((kind === 'smelter' || kind === 'improvedGrill') && state.active) {
    let budget = elapsed
    while (state.active && budget > 0) {
      const poweredTime = Math.min(budget, Math.max(0, state.fuel), Math.max(0, 20 - state.progress))
      state.fuel -= poweredTime
      state.progress += poweredTime
      budget -= poweredTime
      if (state.progress >= 20) {
        state.stock += kind === 'smelter' ? 1 : 3
        state.queued = Math.max(0, (state.queued || 1) - 1)
        state.active = state.queued > 0
        if (state.active) state.progress = 0
      }
      if (poweredTime === 0) break
    }
  }
}
export const TOWERS: Record<
  string,
  { ammo: string; range: number; damage: number; cooldown: number; target: 'boats' | 'boarders' | 'beasts' }
> = {
  ballista: { ammo: 'bolts', range: 24, damage: 32, cooldown: 3, target: 'boats' },
  netLauncher: { ammo: 'nets', range: 10, damage: 2, cooldown: 4, target: 'boarders' },
  harpoonTower: { ammo: 'harpoons', range: 18, damage: 45, cooldown: 4, target: 'beasts' },
  deckCannon: { ammo: 'cannonballs', range: 30, damage: 75, cooldown: 6, target: 'boats' }
}
export function isInArc(dx: number, dz: number, yawDeg: number, range: number): boolean {
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length > range) return false
  if (length < 0.001) return true
  const angle = (yawDeg * Math.PI) / 180
  return (dx * Math.sin(angle) + dz * Math.cos(angle)) / length >= 0.25
}
export function applyArmor(damage: number, armor: number): { damage: number; armor: number } {
  const absorbed = Math.min(Math.max(0, armor), Math.max(0, damage) * 0.5)
  return { damage: Math.max(0, damage) - absorbed, armor: Math.max(0, armor - absorbed) }
}
