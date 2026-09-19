// Plain data only: shared by the headless authority, renderer and regression harness.
export const PROTOCOL_VERSION = 1
export const WORLD_VERSION = 1
export const RESET_ADMIN = '0x481bed8645804714efd1de3f25467f78e7ba07d6'
export type Vec = { x: number; y: number; z: number }
export type Slot = { id: string; count: number; durability: number }
export type Device = {
  kind: string
  yawDeg: number
  support?: 'towerPlatform' | 'armoredFoundation'
  health: number
  maxHealth: number
  fuel: number
  progress: number
  stock: number
  queued: number
  ammo: number
  active: boolean
  installed: boolean
  contents: Slot[]
  saltAmount: number
  freshAmount: number
  recipeId: string
  cookElapsed: number
  cookStatus: number
}
export type Tile = { instance?: number; id: string; x: number; z: number; health: number; device: Device | null }
export type Debris = { id: string; kind: string; position: Vec; velocity: Vec; remaining: number }
export type Enemy = {
  id: string
  kind: 'shark' | 'zombie' | 'pirate' | 'beast'
  position: Vec
  hp: number
  cooldown: number
  slow: number
  boarding: boolean
  shots: number
  target: string
}
export type Events = {
  salvage: number
  salvageIndex: number
  shark: number
  island: number
  chef: number
  lowHungerGift: boolean
  islandPosition: Vec | null
  islandRemaining: number
  islandLoot: Slot[]
  chefRemaining: number
  chefClaimed: string[]
  wave: number
  raidDelay: number
  raidActive: boolean
  finaleGroup: number
  finaleCleared: boolean
  heading: number
  voyage: number
}
export type Progress = {
  events: string[]
  wins: number
  seconds: number
  recovery: number
  pending: Record<string, number>
  metrics: Record<string, number>
  milestones: number[]
  recipes: string[]
  won: boolean
}
export type PlayerState = {
  address: string
  slots: Slot[]
  life: number
  hunger: number
  thirst: number
  armor: number
  healing: number
  rescueCooldown: number
  dead: boolean
  position: Vec
  respawns: number
  shield: { direction: Vec; seconds: number }
  cooldown: number
  fishing: { readyAt: number; expiresAt: number; slot: number } | null
  retiredSessionBefore?: number
  sessions: Record<string, { sequence: number; ok: boolean; error: string }>
}
export type WorldState = {
  version: number
  generation: number
  revision: number
  nextId: number
  seed: number
  tiles: Record<string, Tile>
  debris: Record<string, Debris>
  enemies: Record<string, Enemy>
  progress: Progress
  events: Events
  players: Record<string, PlayerState>
}
export type PublicWorld = Omit<WorldState, 'players'>
export type Action =
  | { kind: 'craft'; item: string; station: string }
  | { kind: 'build'; x: number; z: number; slot: number }
  | { kind: 'place'; target: string; slot: number; yawDeg: number }
  | { kind: 'destroy'; target: string; slot: number }
  | { kind: 'collect'; target: string; slot: number; hook: boolean }
  | { kind: 'consume' | 'fillCup' | 'fishStart' | 'fishCatch'; slot: number }
  | { kind: 'cook'; target: string; recipe: string }
  | { kind: 'interact'; target: string; secondary: boolean; slot: number }
  | { kind: 'attack'; target: string; slot: number }
  | { kind: 'useTool'; target: string; slot: number; direction: Vec }
  | {
      kind: 'transfer'
      target: string
      from: 'player' | 'storage'
      to: 'player' | 'storage'
      a: number
      b: number
      expected: Slot
    }
  | { kind: 'swap'; a: number; b: number; expected: Slot }
  | { kind: 'respawn' | 'reset' | 'islandLoot' | 'chefGift' | 'anchor' }
export type Request = { protocol: number; generation: number; session: string; sequence: number; action: Action }
export type ActionResult = {
  session: string
  sequence: number
  ok: boolean
  error: string
  generation: number
  revision: number
}
export type Snapshot = { world: PublicWorld; player: PlayerState; session: string }
export type Delta = {
  base: number
  revision: number
  generation: number
  tiles: Record<string, Tile | null>
  debris: Record<string, Debris | null>
  enemies: Record<string, Enemy | null>
  progress: Progress
  events: Events
  nextId: number
  seed: number
  player: PlayerState
  session: string
}
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
export function emptySlot(): Slot {
  return { id: '', count: 0, durability: 0 }
}
export function publicWorld(world: WorldState): PublicWorld {
  const { players: _private, ...shared } = world
  return clone(shared)
}
