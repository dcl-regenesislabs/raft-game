import { nextDeckStep } from '../expansion/path'
import {
  HUNGER_DRAIN_PCT_PER_S,
  THIRST_DRAIN_PCT_PER_S,
  LIFE_DAMAGE_BOTH_PCT_PER_S,
  LIFE_DAMAGE_SINGLE_PCT_PER_S,
  LIFE_REGEN_PCT_PER_S
} from '../config/gameConfig'
import { SEA_FLOW_DIR_X, SEA_FLOW_DIR_Z } from '../factories/sceneLevels'
import { CAMPAIGN, OPENING_SALVAGE, WORKSHOP_SALVAGE } from '../progression/config'
import { advanceProduction, applyArmor, isInArc, TOWERS } from '../expansion/rules'
import { PowerNode, powerSources, supplyPower } from '../expansion/power'
import { Enemy, Vec, WorldState } from './types'
import { count, give, take } from './inventory'
import { chapter, distance, milestone, ORIGIN, random, tilePosition } from './world'

function spawnDebris(world: WorldState, kind: string, position: Vec, velocity: Vec): void {
  if (Object.keys(world.debris).length >= 80) return
  const id = 'debris:' + world.nextId++
  world.debris[id] = { id, kind, position, velocity, remaining: 70 }
}
function damageTile(world: WorldState, id: string, amount: number): void {
  const tile = world.tiles[id]
  if (!tile || id === '0,0') return
  if (tile.device) {
    tile.device.health -= amount
    if (tile.device.health > 0) return
  } else {
    tile.health -= amount
    if (tile.health > 0) return
  }
  delete world.tiles[id]
}
function spawnRaid(world: WorldState): void {
  const e = world.events
  const config = e.finaleGroup >= 0 ? CAMPAIGN.finale[e.finaleGroup] : CAMPAIGN.raids[Math.min(world.progress.wins, 2)]
  for (let i = 0; i < config.count; i++) {
    const id = 'enemy:' + world.nextId++
    const angle = i * 0.45 + e.wave * 1.5
    const radius = Math.max(30, ...Object.values(world.tiles).map((t) => Math.hypot(t.x * 3, t.z * 3) + 12))
    world.enemies[id] = {
      id,
      kind: config.kind,
      hp: config.hp,
      position: { x: ORIGIN.x + Math.cos(angle) * radius, y: ORIGIN.y + 0.6, z: ORIGIN.z + Math.sin(angle) * radius },
      cooldown: 0,
      slow: 0,
      boarding: false,
      shots: 0,
      target: ''
    }
  }
  e.raidActive = true
}
function move(enemy: Enemy, destination: Vec, step: number): void {
  const d = distance(enemy.position, destination)
  if (!d) return
  const f = Math.min(1, step / d)
  enemy.position.x += (destination.x - enemy.position.x) * f
  enemy.position.y += (destination.y - enemy.position.y) * f
  enemy.position.z += (destination.z - enemy.position.z) * f
}
export function simulateWorld(world: WorldState, dt: number, online: ReadonlySet<string>): void {
  if (!online.size || dt <= 0) return
  dt = Math.min(dt, 1)
  const p = world.progress,
    e = world.events
  p.seconds += dt
  p.recovery = Math.max(0, p.recovery - dt)
  for (const address of online) {
    const player = world.players[address]
    if (!player || player.dead) continue
    player.shield.seconds = Math.max(0, player.shield.seconds - dt)
    player.rescueCooldown = Math.max(0, player.rescueCooldown - dt)
    if (player.rescueCooldown === 0 && player.position.y < ORIGIN.y - 0.5) {
      player.life = Math.max(0, player.life - 0.25)
      player.position = { ...ORIGIN, y: ORIGIN.y + 1 }
      player.respawns++
      player.rescueCooldown = 3
    }
    player.cooldown = Math.max(0, player.cooldown - dt)
    player.hunger = Math.max(0, player.hunger - (HUNGER_DRAIN_PCT_PER_S * dt) / 100)
    player.thirst = Math.max(0, player.thirst - (THIRST_DRAIN_PCT_PER_S * dt) / 100)
    const hungry = player.hunger <= 0,
      thirsty = player.thirst <= 0
    player.life = Math.max(
      0,
      Math.min(
        1,
        player.life +
          (dt / 100) *
            (hungry && thirsty
              ? -LIFE_DAMAGE_BOTH_PCT_PER_S
              : hungry || thirsty
                ? -LIFE_DAMAGE_SINGLE_PCT_PER_S
                : LIFE_REGEN_PCT_PER_S)
      )
    )
    if (player.healing > 0) {
      const n = Math.min(dt, player.healing)
      player.life = Math.min(1, player.life + n * 0.025)
      player.healing -= n
    }
    if (!e.lowHungerGift && player.hunger <= 0.2) {
      e.lowHungerGift = true
      e.chefRemaining = 90
      e.chefClaimed = []
    }
    if (player.life <= 0) {
      player.dead = true
      player.fishing = null
    }
  }
  e.salvage -= dt
  if (e.salvage <= 0) {
    e.salvage = 2 + random(world) * 3
    const tiles = Object.values(world.tiles)
    const radius = Math.max(14, ...tiles.map((t) => Math.hypot(t.x * 3, t.z * 3)))
    const side = (random(world) * 2 - 1) * (radius + 8)
    const pool = chapter(world) >= 2 ? WORKSHOP_SALVAGE : OPENING_SALVAGE
    spawnDebris(
      world,
      pool[e.salvageIndex++ % pool.length],
      {
        x: ORIGIN.x - SEA_FLOW_DIR_X * (radius + 30) + SEA_FLOW_DIR_Z * side,
        y: ORIGIN.y,
        z: ORIGIN.z - SEA_FLOW_DIR_Z * (radius + 30) - SEA_FLOW_DIR_X * side
      },
      { x: SEA_FLOW_DIR_X * 1.8, y: 0, z: SEA_FLOW_DIR_Z * 1.8 }
    )
  }
  for (const debris of Object.values(world.debris)) {
    debris.remaining -= dt
    debris.position.x += debris.velocity.x * dt
    debris.position.z += debris.velocity.z * dt
    for (const tile of Object.values(world.tiles)) {
      if (tile.device?.kind !== 'collectionNet' || distance(tilePosition(tile), debris.position) > 2.5) continue
      const d = tile.device
      if (!d.contents.length) d.contents = Array.from({ length: 25 }, () => ({ id: '', count: 0, durability: 0 }))
      if (give(d.contents, debris.kind === 'barrel' ? 'wood' : debris.kind, 1, true)) {
        debris.remaining = 0
        break
      }
    }
    if (debris.remaining <= 0) delete world.debris[debris.id]
  }
  const tiles = Object.values(world.tiles)
  const devices = tiles.filter((t) => t.device)
  const power: PowerNode[] = devices.map((t, id) => ({
    id,
    kind: t.device!.kind,
    ...tilePosition(t),
    fuel: t.device!.fuel,
    stock: t.device!.stock
  }))
  let sailing = false,
    running = false
  for (let index = 0; index < devices.length; index++) {
    const tile = devices[index],
      d = tile.device!,
      k = d.kind
    const previous = d.stock
    advanceProduction(k, d, dt, p.seconds % 180 >= 120)
    if (k === 'smelter' && d.stock > previous) milestone(world, 'plate')
    if (k === 'purifier' && d.fuel > 0) {
      const n = Math.min(d.saltAmount, 1 - d.freshAmount, Math.min(dt, d.fuel) / 15)
      d.saltAmount -= n
      d.freshAmount += n
      d.fuel = Math.max(0, d.fuel - dt)
    }
    if (k === 'grill' && d.recipeId) {
      d.cookElapsed += dt
      d.cookStatus = d.cookElapsed >= 75 ? 2 : d.cookElapsed >= 15 ? 1 : 0
    }
    if (k === 'generator' || k === 'engine') {
      if (k === 'engine' && d.fuel > 0) running = true
      d.fuel = Math.max(0, d.fuel - dt)
    }
    if (k === 'sail' && d.active) sailing = true
    if (k === 'batteryBank') {
      const seconds = Math.min(
        dt,
        Math.max(
          0,
          ...powerSources(power, index)
            .filter((s) => s.kind === 'generator')
            .map((s) => s.fuel)
        )
      )
      power[index].stock = Math.min(120, power[index].stock + seconds * 2)
    }
    if (
      k === 'rescueRadio' &&
      d.active &&
      devices.some((t) => t.device?.kind === 'antennaMast' && distance(tilePosition(t), tilePosition(tile)) <= 12)
    ) {
      d.progress = Math.min(CAMPAIGN.broadcastSeconds, d.progress + supplyPower(power, index, dt))
      if (d.progress >= CAMPAIGN.broadcastSeconds && e.finaleCleared) {
        p.won = true
        d.active = false
        milestone(world, 'rescued')
      }
    }
    const tower = TOWERS[k]
    if (tower) {
      d.progress = Math.max(0, d.progress - dt)
      if (!d.ammo)
        for (const box of devices) {
          if (distance(tilePosition(tile), tilePosition(box)) > 6) continue
          const n = Math.min(20, count(box.device!.contents, tower.ammo))
          if (n) {
            take(box.device!.contents, tower.ammo, n)
            d.ammo = n
            break
          }
        }
      if (d.progress > 0 || d.ammo <= 0) continue
      const pos = tilePosition(tile)
      const enemy = Object.values(world.enemies).find(
        (r) =>
          (tower.target === 'beasts'
            ? r.kind === 'beast' || r.kind === 'shark'
            : tower.target === 'boarders'
              ? r.boarding
              : r.kind === 'pirate' || r.kind === 'zombie') &&
          isInArc(r.position.x - pos.x, r.position.z - pos.z, d.yawDeg, tower.range)
      )
      if (enemy) {
        enemy.hp -= tower.damage
        if (k === 'netLauncher') enemy.slow = 5
        d.ammo--
        d.progress = tower.cooldown
      }
    }
  }
  for (let i = 0; i < devices.length; i++)
    if (devices[i].device!.kind === 'batteryBank') devices[i].device!.stock = power[i].stock
  if (sailing || running) {
    e.voyage += dt * (running ? 2 : 1)
    if (e.voyage >= 15) {
      e.voyage -= 15
      spawnDebris(
        world,
        ['wood', 'metal', 'plastic'][e.heading],
        { ...ORIGIN, x: ORIGIN.x + 5, z: ORIGIN.z + 12 },
        { x: 0, y: 0, z: -0.6 }
      )
    }
  }
  e.island -= dt
  if (e.island <= 0) {
    e.island = 600
    e.islandRemaining = 120
    e.islandPosition = { ...ORIGIN, x: ORIGIN.x + 35 }
    e.islandLoot = [
      'wood',
      'metal',
      'potato',
      'sea_salt',
      'garlic',
      'tomatoes',
      'olive_oil',
      'clams',
      'mussels',
      'spaghetti',
      'fettuccine'
    ].map((id) => ({ id, count: 2, durability: 0 }))
  }
  e.islandRemaining = Math.max(0, e.islandRemaining - dt)
  if (!e.islandRemaining) {
    e.islandPosition = null
    e.islandLoot = []
  }
  e.chefRemaining = Math.max(0, e.chefRemaining - dt)
  e.shark -= dt
  if (e.shark <= 0 && !e.raidActive && !e.raidDelay) {
    e.shark = 300
    const tile = tiles.filter((t) => t.id !== '0,0')[Math.floor(random(world) * Math.max(1, tiles.length - 1))]
    if (tile) {
      const id = 'enemy:' + world.nextId++
      world.enemies[id] = {
        id,
        kind: 'shark',
        position: { ...tilePosition(tile), x: tilePosition(tile).x + 8 },
        hp: 100,
        cooldown: 0,
        slow: 0,
        boarding: false,
        shots: 0,
        target: tile.id
      }
    }
  }
  if (e.raidDelay > 0) {
    e.raidDelay = Math.max(0, e.raidDelay - dt)
    if (!e.raidDelay) spawnRaid(world)
  }
  for (const enemy of Object.values(world.enemies)) {
    if (enemy.hp <= 0) {
      if (enemy.kind === 'shark') p.pending.shark_meat = (p.pending.shark_meat ?? 0) + 1
      delete world.enemies[enemy.id]
      continue
    }
    enemy.cooldown = Math.max(0, enemy.cooldown - dt)
    enemy.slow = Math.max(0, enemy.slow - dt)
    const closest = tiles
      .filter((t) => t.id !== '0,0')
      .sort((a, b) => distance(enemy.position, tilePosition(a)) - distance(enemy.position, tilePosition(b)))[0]
    let goal = world.tiles[enemy.target] ?? closest
    if (!goal) continue
    if (enemy.boarding && distance(enemy.position, tilePosition(goal)) < 2) {
      const live = [...online]
        .map((a) => world.players[a])
        .filter((a) => a && !a.dead)
        .sort((a, b) => distance(a.position, enemy.position) - distance(b.position, enemy.position))[0]
      const destination =
        live &&
        tiles
          .slice()
          .sort((a, b) => distance(tilePosition(a), live.position) - distance(tilePosition(b), live.position))[0]
      if (destination) {
        const cells = tiles.map((t, id) => ({
          id,
          x: t.x,
          z: t.z,
          blocked:
            !!t.device &&
            ['wall', 'gate', 'ropeBarricade', 'railing'].includes(t.device.kind) &&
            !(t.device.kind === 'gate' && t.device.active)
        }))
        const from = tiles.findIndex((t) => t.id === goal!.id),
          to = tiles.findIndex((t) => t.id === destination.id)
        if (from >= 0 && !cells[from].blocked) {
          const step = nextDeckStep(cells, from, to)
          if (step !== null) goal = tiles[step]
        }
      }
    }
    enemy.target = goal.id
    const reach = enemy.kind === 'pirate' && !enemy.boarding ? 6 : 2
    if (distance(enemy.position, tilePosition(goal)) > reach)
      move(enemy, tilePosition(goal), dt * (enemy.slow > 0 ? 0.3 : 1.2))
    else {
      if ((enemy.kind === 'zombie' || (enemy.kind === 'pirate' && enemy.shots >= 3)) && !enemy.boarding) {
        enemy.boarding = true
        enemy.position.y = ORIGIN.y + 0.9
      }
      if (enemy.boarding && goal.device?.kind === 'spikeStrip') {
        enemy.hp -= dt * 18
        damageTile(world, goal.id, dt * 3)
      }
      if (!enemy.cooldown) {
        const victim = [...online]
          .map((a) => world.players[a])
          .find((player) => player && !player.dead && enemy.boarding && distance(player.position, enemy.position) < 3)
        if (victim) {
          const dir = victim.shield.direction,
            offset = {
              x: enemy.position.x - victim.position.x,
              y: enemy.position.y - victim.position.y,
              z: enemy.position.z - victim.position.z
            }
          const blocked =
            victim.shield.seconds > 0 &&
            (dir.x * offset.x + dir.y * offset.y + dir.z * offset.z) /
              Math.max(0.001, Math.hypot(offset.x, offset.y, offset.z)) >
              0.3
          const hit = applyArmor(blocked ? 0 : 0.08, victim.armor)
          victim.armor = hit.armor
          victim.life = Math.max(0, victim.life - hit.damage)
          victim.healing = 0
          if (!victim.life) victim.dead = true
        } else damageTile(world, goal.id, enemy.kind === 'beast' ? 25 : 12)
        enemy.shots++
        enemy.cooldown = 2
        if (enemy.kind === 'shark' && !world.tiles[goal.id]) delete world.enemies[enemy.id]
      }
    }
  }
  if (e.raidActive && !Object.values(world.enemies).some((r) => r.kind !== 'shark')) {
    e.raidActive = false
    if (e.finaleGroup >= 0) {
      if (e.finaleGroup < CAMPAIGN.finale.length - 1) {
        e.finaleGroup++
        e.wave++
        e.raidDelay = 15
      } else {
        e.finaleCleared = true
        milestone(world, 'finaleCleared')
      }
    } else {
      const reward = CAMPAIGN.raids[Math.min(p.wins, 2)].reward
      for (const [id, n] of Object.entries(reward)) p.pending[id] = (p.pending[id] ?? 0) + n!
      p.wins = Math.min(3, p.wins + 1)
      p.recovery = CAMPAIGN.recoverySeconds
      if (p.wins === 3 && !p.events.includes('coreAwarded')) {
        p.pending.transmitterCore = 1
        milestone(world, 'coreAwarded')
      }
    }
  }
  // The unique campaign core remains recoverable after a carrier or radio is destroyed.
  if (
    p.wins >= 3 &&
    !(p.pending.transmitterCore > 0) &&
    !Object.values(world.players).some((player) => count(player.slots, 'transmitterCore') > 0) &&
    !Object.values(world.tiles).some(
      (tile) =>
        tile.device &&
        (count(tile.device.contents, 'transmitterCore') > 0 ||
          (tile.device.kind === 'rescueRadio' && tile.device.installed))
    )
  ) {
    p.pending.transmitterCore = 1
  }
}
