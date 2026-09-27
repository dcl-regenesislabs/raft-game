// Preview-only shortcuts for testing a given campaign phase without grinding.
// Runs inside the authority like any other action, so every client sees the result.
import { getExpansionItem } from '../expansion/catalog'
import { TOWERS } from '../expansion/rules'
import { CHAPTER_ITEMS } from '../progression/unlocks'
import { getCatalogItem, PLAYER_STACK_CAP } from '../ui/items'
import { give } from './inventory'
import { Action, PlayerState, Slot, WorldState, debugToolsAllowed, emptySlot } from './types'
import { cellId, createDevice, isStarterTile, requireRule } from './world'

export const DEBUG_PHASE_COUNT = CHAPTER_ITEMS.length
const BASICS = ['wood', 'plastic', 'rope', 'plants', 'metal']
// Crafted intermediates a phase's recipes consume, so its items can be crafted again.
const PHASE_MATERIALS: readonly (readonly string[])[] = [
  [],
  ['metalPlate'],
  ['metalPlate', 'nails'],
  ['metalPlate', 'nails', 'gears', 'wire'],
  ['metalPlate', 'gears', 'wire', 'circuitBoard'],
  ['metalPlate', 'wire', 'circuitBoard']
]
const STORAGE_SUPPLIES = [...BASICS, 'metalPlate', 'nails', 'gears', 'wire', 'circuitBoard', 'potato', 'coal']
const AMMO_SUPPLIES = ['arrows', 'bolts', 'harpoons', 'nets', 'cannonballs']
const FUELED = ['smelter', 'improvedGrill', 'generator', 'engine']
// Events that decide the chapter; see `chapter()` in world.ts.
const GATING_EVENTS = ['rope', 'expand', 'drink', 'cookedMeal', 'plate', 'coreAwarded', 'finaleStarted']

export function isPlaceable(id: string): boolean {
  return ['grill', 'purifier', 'storage'].includes(id) || getExpansionItem(id)?.kind === 'structure'
}

export function applyDebugAction(world: WorldState, player: PlayerState, action: Extract<Action, { kind: 'debug' }>): void {
  requireRule(debugToolsAllowed(), 'Debug tools are disabled on the live world')
  if (action.op === 'vitals') {
    player.dead = false
    player.life = player.hunger = player.thirst = 1
    player.fishing = null
    return
  }
  requireRule(Number.isInteger(action.phase) && action.phase >= 1 && action.phase <= DEBUG_PHASE_COUNT, 'Invalid phase')
  requireRule(action.op === 'items' || action.op === 'build', 'Unknown debug tool')
  setChapter(world, action.phase)
  if (action.op === 'items') giveKit(player, action.phase)
  else buildLayout(world, action.phase)
}

// Moves the shared campaign to exactly this phase (up or down) so its recipes unlock.
function setChapter(world: WorldState, phase: number): void {
  const p = world.progress
  p.events = p.events.filter((e) => !GATING_EVENTS.includes(e))
  if (phase >= 2) p.events.push('rope', 'expand', 'drink', 'cookedMeal')
  if (phase >= 3) p.events.push('plate')
  if (phase >= 6) p.events.push('coreAwarded')
  p.wins = Math.max(0, phase - 3)
  p.recovery = 0
  p.milestones = Array.from({ length: phase }, (_, i) => p.milestones[i] ?? p.seconds)
}

// Replaces the backpack with the phase's items, a hammer and hook, and full material stacks.
function giveKit(player: PlayerState, phase: number): void {
  player.slots = Array.from({ length: 25 }, emptySlot)
  const ids = new Set([...CHAPTER_ITEMS[phase - 1], 'hammer', 'hook', ...BASICS, ...PHASE_MATERIALS[phase - 1], 'cup'])
  for (const id of ids) {
    const def = getCatalogItem(id)
    if (def) give(player.slots, id, def.stackable ? (def.maxStackSize ?? PLAYER_STACK_CAP) : 1)
  }
}

// Overwrites the raft with a filled square holding every placeable unlocked up to this phase.
function buildLayout(world: WorldState, phase: number): void {
  const kinds = [...new Set(CHAPTER_ITEMS.slice(0, phase).flat().filter(isPlaceable))]
  let radius = 2
  while ((radius * 2 + 1) ** 2 - 1 < kinds.length) radius++
  const inside = (x: number, z: number) => Math.abs(x) <= radius && Math.abs(z) <= radius
  for (const tile of Object.values(world.tiles)) {
    if (!isStarterTile(tile) && !inside(tile.x, tile.z)) {
      delete world.tiles[tile.id]
      continue
    }
    tile.device = null
    tile.health = 100
    tile.instance = world.nextId++
  }
  const cells: [number, number][] = []
  for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) cells.push([x, z])
  // Innermost rings first, so earlier-phase stations sit closest to the recovery platform.
  cells.sort((a, b) => ring(a) - ring(b) || Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(b[0]) - Math.abs(b[1]))
  let next = 0
  for (const [x, z] of cells) {
    const id = cellId(x, z)
    world.tiles[id] ??= { instance: world.nextId++, id, x, z, health: 100, device: null }
    if (id === '0,0' || next >= kinds.length) continue
    world.tiles[id].device = debugDevice(kinds[next++])
  }
}

function ring([x, z]: [number, number]): number {
  return Math.max(Math.abs(x), Math.abs(z))
}

function debugDevice(kind: string) {
  const device = createDevice(kind, 0)
  if (FUELED.includes(kind)) device.fuel = 90
  if (kind === 'purifier') device.fuel = 30
  if (TOWERS[kind]) device.ammo = 20
  if (kind === 'researchTable') device.installed = true
  if (kind === 'storage') fill(device.contents, STORAGE_SUPPLIES)
  if (kind === 'ammoCrate') fill(device.contents, AMMO_SUPPLIES)
  return device
}

function fill(contents: Slot[], ids: readonly string[]): void {
  for (const id of ids) give(contents, id, 99, true)
}
