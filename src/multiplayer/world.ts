import { MULTIPLAYER_MAX_TILES, MULTIPLAYER_MAX_DEVICES, MULTIPLAYER_INITIAL_RAFT_SIZE } from '../config/gameConfig'
import { recipeAvailable } from '../progression/unlocks'
import { PARCEL_GRID, PARCEL_SIZE_M, WATER_LEVEL } from '../factories/sceneLevels'
import { getCatalogItem } from '../ui/items'
import { getCraftableById } from '../ui/craftableItems'
import { getCookableById } from '../ui/cookableItems'
import { getFoodEffect } from '../ui/foodEffects'
import { getExpansionItem } from '../expansion/catalog'
import { TOWERS } from '../expansion/rules'
import { CAMPAIGN } from '../progression/config'
import { Action, Device, PlayerState, Slot, Tile, Vec, WorldState, WORLD_VERSION, clone, emptySlot } from './types'
import { count, give, take, wear } from './inventory'

export const ORIGIN: Vec = {
  x: (PARCEL_GRID * PARCEL_SIZE_M) / 2,
  y: WATER_LEVEL,
  z: (PARCEL_GRID * PARCEL_SIZE_M) / 2
}
export const TILE_SIZE = 3
export const cellId = (x: number, z: number): string => `${x},${z}`
export const tileObjectId = (tile: Tile): string => `${tile.id}@${tile.instance ?? 0}`
export const tilePosition = (tile: { x: number; z: number }): Vec => ({
  x: ORIGIN.x + tile.x * TILE_SIZE,
  y: ORIGIN.y,
  z: ORIGIN.z + tile.z * TILE_SIZE
})
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
export function freshWorld(generation = 1): WorldState {
  const tiles: Record<string, Tile> = {}
  const start = -Math.floor(MULTIPLAYER_INITIAL_RAFT_SIZE / 2)
  const end = start + MULTIPLAYER_INITIAL_RAFT_SIZE
  for (let x = start; x < end; x++)
    for (let z = start; z < end; z++) {
      const id = cellId(x, z)
      tiles[id] = { id, x, z, health: 100, device: null }
    }
  return {
    version: WORLD_VERSION,
    generation,
    revision: 0,
    nextId: 1,
    seed: CAMPAIGN.seed,
    tiles,
    debris: {},
    enemies: {},
    players: {},
    progress: {
      events: [],
      wins: 0,
      seconds: 0,
      recovery: 0,
      pending: {},
      metrics: {},
      milestones: [0],
      recipes: [],
      won: false
    },
    events: {
      salvage: 0,
      salvageIndex: 0,
      shark: 450,
      island: 600,
      chef: 0,
      lowHungerGift: false,
      islandPosition: null,
      islandRemaining: 0,
      islandLoot: [],
      chefRemaining: 0,
      chefClaimed: [],
      wave: 0,
      raidDelay: 0,
      raidActive: false,
      finaleGroup: -1,
      finaleCleared: false,
      heading: 0,
      voyage: 0
    }
  }
}
export function freshPlayer(address: string): PlayerState {
  const slots = Array.from({ length: 25 }, emptySlot)
  give(slots, 'hook', 1)
  give(slots, 'potato', 2)
  return {
    address,
    slots,
    life: 1,
    hunger: 1,
    thirst: 1,
    armor: 0,
    healing: 0,
    rescueCooldown: 3,
    dead: false,
    position: { ...ORIGIN, y: ORIGIN.y + 1 },
    respawns: 0,
    shield: { direction: { x: 0, y: 0, z: 1 }, seconds: 0 },
    cooldown: 0,
    fishing: null,
    sessions: {}
  }
}
export function random(world: WorldState): number {
  world.seed = (Math.imul(world.seed, 1664525) + 1013904223) >>> 0
  return world.seed / 4294967296
}
export function milestone(world: WorldState, event: string): void {
  if (!world.progress.events.includes(event)) world.progress.events.push(event)
}
export function chapter(world: WorldState): number {
  const p = world.progress
  if (p.wins >= 3) return 6
  if (p.wins === 2) return 5
  if (p.wins === 1) return 4
  if (p.events.includes('plate')) return 3
  return ['expand', 'drink', 'cookedMeal'].every((e) => p.events.includes(e)) ? 2 : 1
}
export function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
function tool(player: PlayerState, slot: number, ids?: string[]): Slot {
  requireRule(Number.isInteger(slot) && slot >= 0 && slot < 25, 'Invalid inventory slot')
  const entry = player.slots[slot]
  requireRule(entry && entry.count > 0 && (!ids || ids.includes(entry.id)), 'Equip the required item')
  return entry
}
function target(world: WorldState, player: PlayerState, id: string, reach = 6): Tile {
  const tile = world.tiles[id.split('@')[0]]
  requireRule(
    tile && tileObjectId(tile) === id && distance(player.position, tilePosition(tile)) <= reach,
    'Target is out of reach'
  )
  return tile
}
function grant(player: PlayerState, id: string, amount: number): void {
  requireRule(give(player.slots, id, amount) === amount, 'Backpack full')
}
export function spend(world: WorldState, player: PlayerState, id: string, amount: number, shared = false): void {
  let remaining = amount - take(player.slots, id, amount)
  if (shared)
    for (const tile of Object.values(world.tiles)) {
      if (!tile.device || distance(player.position, tilePosition(tile)) > 12) continue
      remaining -= take(tile.device.contents, id, remaining)
      if (!remaining) break
    }
  requireRule(remaining === 0, `Need ${amount} ${id}`)
}
function consumeCup(player: PlayerState, slot: number): void {
  tool(player, slot, ['freshWater'])
  player.slots[slot] = { id: 'cup', count: 1, durability: 0 }
}
function createDevice(kind: string, yawDeg: number, support?: Device['support']): Device {
  const health = (getExpansionItem(kind)?.health ?? 100) + (support === 'towerPlatform' ? 150 : support ? 400 : 0)
  return {
    kind,
    yawDeg,
    ...(support ? { support } : {}),
    health,
    maxHealth: health,
    fuel: 0,
    progress: 0,
    stock: 0,
    queued: 0,
    ammo: 0,
    active: false,
    installed: false,
    contents: ['storage', 'ammoCrate'].includes(kind) ? Array.from({ length: 25 }, emptySlot) : [],
    saltAmount: 0,
    freshAmount: 0,
    recipeId: '',
    cookElapsed: 0,
    cookStatus: 0
  }
}
export function startRaid(world: WorldState, finale = false): void {
  const e = world.events
  requireRule(
    !e.raidActive && !e.raidDelay && world.progress.recovery === 0,
    'Clear the current raid or wait for recovery'
  )
  requireRule(chapter(world) >= (finale ? 6 : 3), 'Reach the next milestone')
  requireRule(!world.progress.events.includes('finaleStarted') || finale, 'Finish the rescue transmission')
  if (finale && world.progress.events.includes('finaleStarted')) return
  e.finaleGroup = finale ? 0 : -1
  e.wave++
  e.raidDelay = CAMPAIGN.warningSeconds
  if (finale) milestone(world, 'finaleStarted')
}
// Reducers run on a candidate copy. Any failed rule discards ALL intermediate spending and grants.
export function applyAction(world: WorldState, player: PlayerState, action: Action): void {
  requireRule(action && typeof action.kind === 'string', 'Invalid action')
  if (action.kind === 'respawn') {
    requireRule(player.dead, 'Already alive')
    player.dead = false
    player.life = player.hunger = player.thirst = 1
    player.position = { ...ORIGIN, y: ORIGIN.y + 1 }
    player.respawns++
    player.rescueCooldown = 3
    player.fishing = null
    return
  }
  requireRule(!player.dead, 'Respawn first')
  switch (action.kind) {
    case 'craft': {
      const recipe = getCraftableById(action.item)
      requireRule(
        recipe && recipeAvailable(chapter(world), world.progress.events, action.item),
        'Recipe is not unlocked'
      )
      if (recipe.station) {
        const d = target(world, player, action.station).device
        requireRule(
          d?.kind === recipe.station && (d.kind !== 'researchTable' || d.installed),
          'Use the required station'
        )
      }
      for (const cost of recipe.cost) spend(world, player, cost.materialId, cost.amount, true)
      grant(player, recipe.id, recipe.outputCount ?? 1)
      milestone(world, 'crafted:' + recipe.id)
      if (['rope', 'hammer'].includes(recipe.id)) milestone(world, recipe.id)
      return
    }
    case 'build': {
      tool(player, action.slot, ['hammer'])
      requireRule(
        Number.isInteger(action.x) &&
          Number.isInteger(action.z) &&
          Math.abs(action.x) < 130 &&
          Math.abs(action.z) < 130,
        'Outside raft bounds'
      )
      requireRule(Object.keys(world.tiles).length < MULTIPLAYER_MAX_TILES, 'Raft capacity reached')
      const id = cellId(action.x, action.z)
      requireRule(!world.tiles[id] && distance(player.position, tilePosition(action)) <= 64, 'Invalid placement')
      requireRule(
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1]
        ].some(([x, z]) => world.tiles[cellId(action.x + x, action.z + z)]),
        'Build beside an existing platform'
      )
      spend(world, player, 'wood', 2, true)
      spend(world, player, 'plastic', 2, true)
      spend(world, player, 'rope', 1, true)
      world.tiles[id] = { instance: world.nextId++, id, x: action.x, z: action.z, health: 100, device: null }
      milestone(world, 'expand')
      return
    }
    case 'place': {
      const tile = target(world, player, action.target, 64)
      const slot = tool(player, action.slot)
      const expansion = getExpansionItem(slot.id)
      requireRule(
        ['grill', 'purifier', 'storage'].includes(slot.id) || expansion?.kind === 'structure',
        'Not a construction'
      )
      requireRule(tile.id !== '0,0', 'The central recovery platform must remain clear')
      requireRule(Number.isFinite(action.yawDeg), 'Invalid rotation')
      const support =
        tile.device?.kind === 'armoredFoundation'
          ? 'armoredFoundation'
          : tile.device?.kind === 'towerPlatform' && TOWERS[slot.id]
            ? 'towerPlatform'
            : undefined
      requireRule(!tile.device || support, 'Platform already occupied')
      requireRule(
        !!tile.device || Object.values(world.tiles).filter((t) => t.device).length < MULTIPLAYER_MAX_DEVICES,
        'Structure capacity reached'
      )
      tile.instance = world.nextId++
      tile.device = createDevice(slot.id, ((action.yawDeg % 360) + 360) % 360, support)
      spend(world, player, slot.id, 1)
      milestone(world, tile.device.kind)
      return
    }
    case 'destroy': {
      tool(player, action.slot, ['hammer'])
      const tile = target(world, player, action.target, 64)
      requireRule(tile.id !== '0,0', 'Cannot remove the recovery platform')
      requireRule(!tile.device?.contents.some((s) => s.count > 0), 'Empty storage before dismantling')
      requireRule(!Object.values(world.enemies).some((e) => e.target === tile.id), 'Platform is under attack')
      delete world.tiles[tile.id]
      return
    }
    case 'collect': {
      const debris = world.debris[action.target]
      requireRule(debris, 'Already collected')
      if (action.hook) tool(player, action.slot, ['hook', 'metalHook'])
      requireRule(distance(player.position, debris.position) <= (action.hook ? 24 : 5), 'Debris is out of reach')
      if (debris.kind === 'barrel') {
        for (const id of ['wood', 'plastic', 'plants', 'metal', 'rope'])
          grant(player, id, 1 + Math.floor(random(world) * 2))
      } else grant(player, debris.kind, chapter(world) >= 4 ? 2 : 1)
      if (action.hook) wear(player.slots, action.slot)
      delete world.debris[action.target]
      milestone(world, 'collect')
      milestone(world, 'inventory')
      return
    }
    case 'consume': {
      const slot = tool(player, action.slot)
      const effect = getFoodEffect(slot.id)
      requireRule(effect, 'Item cannot be consumed')
      player.hunger = Math.min(
        2,
        Math.min(Math.max(1, player.hunger), player.hunger + (effect.hunger ?? 0) / 100) +
          (effect.hungerBonus ?? 0) / 100
      )
      player.thirst = Math.max(0, Math.min(1, player.thirst + (effect.thirst ?? 0) / 100))
      if (getCookableById(slot.id)) milestone(world, 'cookedMeal')
      if (slot.id === 'freshWater') {
        milestone(world, 'drink')
        milestone(world, 'freshWater')
      }
      if (slot.id === 'freshWater' || slot.id === 'saltWater')
        player.slots[action.slot] = { id: 'cup', count: 1, durability: 0 }
      else spend(world, player, slot.id, 1)
      return
    }
    case 'fillCup':
      tool(player, action.slot, ['cup'])
      requireRule(player.position.y <= ORIGIN.y + 4, 'Move closer to the water')
      player.slots[action.slot] = { id: 'saltWater', count: 1, durability: 0 }
      milestone(world, 'saltWater')
      return
    case 'fishStart': {
      tool(player, action.slot, ['fishingRod'])
      requireRule(!player.fishing || player.fishing.expiresAt < world.progress.seconds, 'Already fishing')
      const readyAt = world.progress.seconds + 4 + random(world) * 6
      player.fishing = { readyAt, expiresAt: readyAt + 2, slot: action.slot }
      return
    }
    case 'fishCatch': {
      const fishing = player.fishing
      requireRule(
        fishing &&
          fishing.slot === action.slot &&
          world.progress.seconds >= fishing.readyAt &&
          world.progress.seconds <= fishing.expiresAt,
        'Fish escaped'
      )
      tool(player, action.slot, ['fishingRod'])
      const catches = 1 + Math.floor(random(world) * 2)
      for (let i = 0; i < catches; i++) grant(player, ['sardines', 'squid', 'crab'][Math.floor(random(world) * 3)], 1)
      wear(player.slots, action.slot)
      player.fishing = null
      return
    }
    case 'cook': {
      const device = target(world, player, action.target).device
      const recipe = getCookableById(action.recipe)
      requireRule(device?.kind === 'grill' && !device.recipeId && recipe, 'Grill unavailable')
      for (const ing of [...recipe.ingredients, recipe.fuel]) spend(world, player, ing.itemId, ing.amount, true)
      device.recipeId = recipe.id
      device.cookElapsed = 0
      device.cookStatus = 0
      if (!world.progress.recipes.includes(recipe.id)) world.progress.recipes.push(recipe.id)
      return
    }
    case 'interact':
      interact(world, player, action)
      return
    case 'useTool': {
      const slot = tool(player, action.slot, ['bandage', 'scrapArmor', 'repairKit', 'boardingShield'])
      if (slot.id === 'bandage') {
        requireRule(player.life < 1 && player.healing === 0, 'Healing unavailable')
        spend(world, player, slot.id, 1)
        player.healing = 10
      } else if (slot.id === 'scrapArmor') {
        requireRule(player.armor < 0.5, 'Armor already equipped')
        spend(world, player, slot.id, 1)
        player.armor = 0.5
      } else if (slot.id === 'repairKit') {
        const t = target(world, player, action.target, 5)
        requireRule(t.device ? t.device.health < t.device.maxHealth : t.health < 100, 'No damage to repair')
        spend(world, player, slot.id, 1)
        if (t.device) t.device.health = Math.min(t.device.maxHealth, t.device.health + 50)
        else t.health = Math.min(100, t.health + 50)
      } else {
        const v = action.direction
        requireRule(v && [v.x, v.y, v.z].every(Number.isFinite), 'Invalid shield direction')
        const n = Math.hypot(v.x, v.y, v.z)
        requireRule(n > 0.9 && n < 1.1, 'Invalid shield direction')
        player.shield = { direction: v, seconds: 1.5 }
      }
      return
    }
    case 'attack': {
      const slot = tool(player, action.slot, ['spear', 'bow', 'salvageAxe'])
      const enemy = world.enemies[action.target]
      requireRule(
        enemy && player.cooldown <= 0 && distance(player.position, enemy.position) <= (slot.id === 'bow' ? 28 : 4),
        'No target in reach or weapon recovering'
      )
      if (slot.id === 'bow') spend(world, player, 'arrows', 1)
      enemy.hp -= slot.id === 'bow' ? 35 : 25
      player.cooldown = slot.id === 'bow' ? 1 : 1.4
      wear(player.slots, action.slot)
      return
    }
    case 'swap': {
      const a = tool(player, action.a)
      requireRule(action.b >= 0 && action.b < 25 && Number.isInteger(action.b), 'Invalid slot')
      requireRule(JSON.stringify(a) === JSON.stringify(action.expected), 'Inventory changed; try again')
      ;[player.slots[action.a], player.slots[action.b]] = [player.slots[action.b], a]
      return
    }
    case 'transfer': {
      const device = target(world, player, action.target).device
      requireRule(device && ['storage', 'ammoCrate'].includes(device.kind), 'Storage unavailable')
      requireRule(
        ['player', 'storage'].includes(action.from) && ['player', 'storage'].includes(action.to),
        'Invalid inventory'
      )
      const source = action.from === 'player' ? player.slots : device.contents
      const dest = action.to === 'player' ? player.slots : device.contents
      requireRule(
        Number.isInteger(action.a) &&
          Number.isInteger(action.b) &&
          action.a >= 0 &&
          action.b >= 0 &&
          action.a < source.length &&
          action.b < dest.length,
        'Invalid slot'
      )
      const entry = source[action.a]
      requireRule(
        entry.count > 0 && JSON.stringify(entry) === JSON.stringify(action.expected),
        'Storage changed; try again'
      )
      if (source === dest) {
        ;[source[action.a], source[action.b]] = [source[action.b], source[action.a]]
        return
      }
      requireRule(!dest[action.b].id || dest[action.b].id === entry.id, 'Destination occupied')
      const def = getCatalogItem(entry.id)!
      let index = action.b
      if (action.to === 'player' && def.stackable) {
        const existing = dest.findIndex((s) => s.id === entry.id)
        if (existing >= 0) index = existing
      }
      const cap = def.stackable ? (action.to === 'player' ? 20 : 99) : 1
      const amount = Math.min(entry.count, cap - dest[index].count)
      requireRule(amount > 0, 'Destination full')
      dest[index] = { ...entry, count: dest[index].count + amount }
      entry.count -= amount
      if (!entry.count) source[action.a] = emptySlot()
      return
    }
    case 'islandLoot':
      requireRule(
        world.events.islandPosition && distance(player.position, world.events.islandPosition) < 8,
        'Island is out of reach'
      )
      for (const entry of world.events.islandLoot) grant(player, entry.id, entry.count)
      world.events.islandLoot = []
      return
    case 'anchor':
      requireRule(
        count(player.slots, 'anchor') > 0 &&
          world.events.islandPosition &&
          distance(player.position, world.events.islandPosition) < 45,
        'No island in anchor reach'
      )
      world.events.islandPosition = { ...ORIGIN, x: ORIGIN.x + 20 }
      return
    case 'chefGift':
      requireRule(
        world.events.chefRemaining > 0 &&
          distance(player.position, { ...ORIGIN, z: ORIGIN.z + 18 }) < 8 &&
          !world.events.chefClaimed.includes(player.address),
        'Chef unavailable'
      )
      grant(player, 'seafood_stew', 1)
      world.events.chefClaimed.push(player.address)
      return
    default:
      throw new Error('Unsupported action')
  }
}
function interact(world: WorldState, player: PlayerState, action: Extract<Action, { kind: 'interact' }>): void {
  const tile = target(world, player, action.target)
  const d = tile.device
  requireRule(d, 'Structure unavailable')
  const k = d.kind
  if (k === 'purifier') {
    if (action.secondary) {
      requireRule(d.fuel === 0, 'Fire already burning')
      spend(world, player, 'wood', 1)
      d.fuel = 30
    } else if (d.freshAmount > 0) {
      player.thirst = Math.min(1, player.thirst + d.freshAmount * 0.3)
      d.freshAmount = 0
      milestone(world, 'drink')
      milestone(world, 'freshWater')
    } else {
      tool(player, action.slot, ['saltWater'])
      requireRule(d.saltAmount < 1, 'Bowl full')
      d.saltAmount = 1
      player.slots[action.slot] = { id: 'cup', count: 1, durability: 0 }
    }
  } else if (k === 'grill') {
    requireRule(d.recipeId && d.cookStatus > 0, 'Food not ready')
    grant(player, d.cookStatus === 2 ? 'coal' : d.recipeId, 1)
    d.recipeId = ''
    d.cookElapsed = 0
    d.cookStatus = 0
  } else if (k === 'collectionNet') {
    for (const entry of d.contents) {
      const accepted = give(player.slots, entry.id, entry.count)
      entry.count -= accepted
      if (!entry.count) entry.id = ''
    }
  } else if (k === 'alarmBell') {
    if (action.secondary) {
      for (const [id, n] of Object.entries(world.progress.pending)) {
        world.progress.pending[id] -= give(player.slots, id, n)
      }
    } else startRaid(world)
  } else if (k === 'researchTable') {
    if (!d.installed) {
      spend(world, player, 'metalPlate', 3)
      spend(world, player, 'wire', 2)
      d.installed = true
    }
  } else if (k === 'smelter' || k === 'improvedGrill') {
    if (action.secondary) {
      requireRule(d.fuel <= 90, 'Fuel full')
      spend(world, player, 'wood', 1)
      d.fuel += 30
    } else if (d.stock) d.stock -= give(player.slots, k === 'smelter' ? 'metalPlate' : 'roasted_potato', d.stock)
    else {
      requireRule(d.queued < CAMPAIGN.productionQueueLimit, 'Queue full')
      spend(world, player, k === 'smelter' ? 'metal' : 'potato', k === 'smelter' ? 2 : 3)
      d.queued++
      if (!d.active) d.progress = 0
      d.active = true
    }
  } else if (k === 'cropBed') {
    if (d.stock) d.stock -= give(player.slots, 'potato', d.stock)
    else if (!d.installed && !d.active) {
      spend(world, player, 'potato', 1)
      d.installed = true
    } else {
      requireRule(d.installed && !d.active, 'Crop is growing')
      consumeCup(player, action.slot)
      d.active = true
      d.installed = false
      d.progress = 0
    }
  } else if (k === 'rainCollector' || k === 'waterTank') {
    if (action.secondary && k === 'waterTank') {
      requireRule(d.stock < 8, 'Tank full')
      consumeCup(player, action.slot)
      d.stock++
    } else {
      requireRule(d.stock > 0, 'No water stored')
      if (player.slots[action.slot]?.id === 'cup')
        player.slots[action.slot] = { id: 'freshWater', count: 1, durability: 0 }
      else {
        player.thirst = Math.min(1, player.thirst + 0.35)
        milestone(world, 'drink')
      }
      d.stock--
    }
  } else if (TOWERS[k]) {
    if (action.secondary) d.yawDeg = (d.yawDeg + 45) % 360
    else {
      const n = Math.min(20 - d.ammo, count(player.slots, TOWERS[k].ammo))
      requireRule(n > 0, 'Need ammunition')
      spend(world, player, TOWERS[k].ammo, n)
      d.ammo += n
    }
  } else if (k === 'gate' || k === 'sail') d.active = !d.active
  else if (k === 'steeringWheel') world.events.heading = (world.events.heading + 1) % 3
  else if (k === 'generator' || k === 'engine') {
    requireRule(d.fuel <= 90, 'Fuel full')
    spend(world, player, 'wood', 1)
    d.fuel += 30
  } else if (k === 'rescueRadio') {
    requireRule(chapter(world) >= 6, 'Defeat the three story raids')
    if (!d.installed) {
      spend(world, player, 'transmitterCore', 1)
      d.installed = true
    } else {
      requireRule(
        Object.values(world.tiles).some(
          (t) => t.device?.kind === 'antennaMast' && distance(tilePosition(t), tilePosition(tile)) <= 12
        ),
        'Build an antenna within 12 meters'
      )
      startRaid(world, true)
      d.active = true
    }
  }
}
export function reduceAction(world: WorldState, address: string, action: Action): WorldState {
  const next = clone(world)
  requireRule(next.players[address], 'Join first')
  applyAction(next, next.players[address], action)
  return next
}
