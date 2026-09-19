import { isMultiplayer, sendWorldAction, getMultiplayerSnapshot } from '../client/multiplayerState'
import { worldEntityId } from '../client/worldEntities'
import { captureCheckpoint } from '../progression/checkpoint'
import { CAMPAIGN } from '../progression/config'
import { isSandbox, chapter, storyWins, raidGate, completeStoryRaid, recordProgress, queueReward, claimRewards, pendingRewards, metric, hasProgress, setAssaultActive, beginRecovery } from '../progression/state'
import { attachPrototypeSprite, removePrototypeEntity, setGateOpen } from './sprites'
import { DEBUG_MODE } from '../config/gameConfig'
import { nextDeckStep } from './path'
import { AUTO_WIRE_RANGE_M, powerSources, supplyPower, PowerNode } from './power'
import { FloatingGarbage } from '../components'
import { getLookAtGarbageEntity } from '../systems/lookAtTarget'
import { bankGarbageKind } from '../factories/garbageBank'
import { destroyFloatingGarbage } from '../factories/floatingGarbage'
import { engine, Entity, Transform, GltfContainer, MeshRenderer, Material } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import {
  ExpansionState,
  StructureHealth,
  Platform,
  PlatformConstruction,
  MainPlatform,
  StorageContents,
  SharkAttack
} from '../components'
import { getExpansionItem, expansionIcon, CRAFT_STATION_NAMES } from './catalog'
import { advanceProduction, applyArmor, isInArc, TOWERS } from './rules'
import { destroyPlatformEntity, GRID_ORIGIN } from '../factories/platform'
import {
  getCollectedCount,
  subtractCollected,
  addCollected,
  getSelectedSlot,
  transmuteContainerSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { getInventorySlot } from '../ui/items'
import { showNotification } from '../ui/notification'
import { notifyItemReceived } from '../ui/itemReceivedNotification'
import { getStat, adjustStat, restoreStat } from '../ui/statsBars'
import { setCraftOpen } from '../ui/craftToggle'
import { openStorageMenu } from '../ui/storageToggle'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isStartupGateActive } from '../ui/startupGate'
import { isGameOver } from '../ui/gameOver'
import { isWinActive, triggerWin } from '../ui/winScreen'
import { toolFireJustPressed, isToolFirePressed } from '../systems/toolFire'
import { isPointerLocked } from '../ui/cursorLock'
import { tryHitShark } from '../systems/sharkAttack'
import { createFloatingGarbage } from '../factories/floatingGarbage'

type Raider = {
  entity: Entity
  kind: 'zombie' | 'pirate' | 'beast'
  hp: number
  cooldown: number
  slow: number
  boarding: boolean
  shots: number
}
const raiders: Raider[] = []
const shots: { entity: Entity; remaining: number }[] = []
let elapsed = 0,
  stepAccumulator = 0,
  wave = 0,
  raidActive = false,
  raidDelay = 0,
  cleared = 0
let armor = 0,
  healing = 0,
  lastLife = 1,
  toolCooldown = 0,
  heading = 0,
  voyage = 0
let finaleGroup = -1
let encounterIndex = 0
let finalAssaultCleared = false
const resources = ['wood', 'metal', 'plastic'] as const
const statLabel = (e: Entity) => {
  const s = ExpansionState.getOrNull(e)
  return s ? Math.ceil(s.health) + '/' + s.maxHealth : ''
}

export function resetExpansion(): void {
  for (const enemy of raiders) removePrototypeEntity(enemy.entity)
  for (const flash of shots) engine.removeEntity(flash.entity)
  shots.length = 0
  raiders.length = 0
  elapsed = stepAccumulator = wave = raidDelay = cleared = armor = healing = toolCooldown = heading = voyage = 0
  raidActive = false
  finaleGroup = -1
  finalAssaultCleared = false
  setAssaultActive(false)
  lastLife = getStat('life')
}

function spend(id: string, amount: number): boolean {
  if (getCollectedCount(id) < amount) {
    showNotification('Need ' + amount + ' ' + (getExpansionItem(id)?.name.toLowerCase() ?? id))
    return false
  }
  return subtractCollected(id, amount) === amount
}
function grant(id: string, amount: number): number {
  const received = addCollected(id, amount)
  if (received) notifyItemReceived(id, received)
  if (received < amount) showNotification('Backpack full. Make room and collect again.')
  return received
}
function position(e: Entity): Vector3 {
  return Transform.get(e).position
}
function distance(a: Vector3, b: Vector3): number {
  return Vector3.distance(a, b)
}
function near(e: Entity, radius = 5): boolean {
  const player = Transform.getOrNull(engine.PlayerEntity)
  return !!player && distance(position(e), player.position) <= radius
}
function consumeCup(): boolean {
  const slot = getSelectedSlot()
  if (getInventorySlot(slot)?.id !== 'freshWater') {
    showNotification('Equip a fresh-water cup.')
    return false
  }
  return transmuteContainerSlot(slot, 'cup')
}
function raidPreparation(): string {
  const index = isSandbox() ? wave % 3 : Math.min(storyWins(), 2)
  if (index === 0) return 'Start zombies · spear / bow recommended'
  const ammo = index === 1 ? 'bolts' : 'harpoons'
  let available = getCollectedCount(ammo)
  for (const [, state, pc] of engine.getEntitiesWith(ExpansionState, PlatformConstruction))
    if (TOWERS[pc.kind]?.ammo === ammo) available += state.ammo
  for (const [, box] of engine.getEntitiesWith(StorageContents))
    for (const slot of box.slots) if (slot.id === ammo) available += slot.count
  return `Start ${index === 1 ? 'pirates' : 'beasts'} · ${available} ${ammo} total`
}
export function expansionActions(
  e: Entity
): { primary: string; secondary?: string; icon: string; secondaryIcon?: string } | null {
  const pc = PlatformConstruction.getOrNull(e),
    s = ExpansionState.getOrNull(e)
  if (!pc || !s) return null
  const def = getExpansionItem(pc.kind)
  if (!def) return null
  const k = pc.kind
  let primary = def.name + ' ' + statLabel(e),
    secondary: string | undefined
  if (CRAFT_STATION_NAMES[k]) primary = 'Use ' + CRAFT_STATION_NAMES[k]
  if (k === 'researchTable') primary = s.installed ? 'Craft technology' : 'Research: 3 plates + 2 wire'
  if (k === 'smelter' || k === 'improvedGrill') {
    primary =
      s.stock > 0
        ? 'Collect ' + s.stock
        : s.active
          ? 'Queue batch · ' + (s.queued || 1) + '/5 · ' + Math.floor((s.progress / 20) * 100) + '%'
          : k === 'smelter'
            ? 'Load 2 scrap metal'
            : 'Load 3 potatoes'
    secondary = 'Add wood (' + Math.ceil(s.fuel) + 's)'
  }
  if (k === 'cropBed')
    primary = s.stock
      ? 'Harvest potatoes'
      : s.active
        ? 'Growing ' + Math.floor((s.progress / 60) * 100) + '%'
        : s.installed
          ? 'Water crop'
          : 'Plant potato'
  if (k === 'rainCollector')
    primary = s.stock ? 'Drink (' + s.stock + ')' : elapsed % 180 >= 120 ? 'Collecting rain' : 'Waiting for rain'
  if (k === 'waterTank') {
    primary = 'Drink / refill (' + s.stock + '/8)'
    secondary = 'Store fresh water'
  }
  if (k === 'gate') primary = s.active ? 'Close gate' : 'Open gate'
  if (k === 'ammoCrate') primary = 'Open ammunition storage'
  if (TOWERS[k]) {
    primary = 'Load ' + TOWERS[k].ammo + ' (' + s.ammo + '/20)'
    secondary = 'Rotate tower 45°'
  }
  if (k === 'alarmBell') {
    primary = raidActive || raidDelay > 0 ? 'Raid in progress' : raidPreparation()
    secondary = 'Claim recovered supplies'
  }
  if (k === 'lookoutPost') primary = 'Scout next raid'
  if (k === 'sail') primary = s.active ? 'Lower sail' : 'Raise sail'
  if (k === 'steeringWheel') primary = 'Salvage route: ' + resources[heading]
  if (k === 'generator' || k === 'engine') primary = 'Add wood (' + Math.ceil(s.fuel) + 's)'
  if (k === 'batteryBank') primary = 'Battery ' + Math.floor(s.stock) + '/120'
  if (k === 'powerRelay') primary = poweredDevices().has(e) ? 'Power connected' : 'No power nearby'
  if (k === 'antennaMast') primary = 'Antenna ready'
  if (k === 'rescueRadio')
    primary = !s.installed
      ? 'Install transmitter core'
      : s.active
        ? 'Transmitting ' + Math.floor((s.progress / 120) * 100) + '%'
        : 'Start rescue transmission'
  return {
    primary,
    secondary,
    icon: expansionIcon(def),
    secondaryIcon: k === 'alarmBell' ? 'images/hud/items/storage.png' : TOWERS[k]
      ? 'images/hud/rotate-clockwise.png'
      : k === 'waterTank'
        ? 'images/hud/items/fresh-water.png'
        : 'images/hud/items/wood.png'
  }
}

export function interactExpansion(e: Entity, secondary: boolean): boolean {
  if (isMultiplayer()) {
    const pc = PlatformConstruction.getOrNull(e)
    if (!pc || !getExpansionItem(pc.kind)) return false
    if (!secondary && (['workbench', 'armoryBench', 'engineeringBench'].includes(pc.kind) || pc.kind === 'researchTable' && ExpansionState.getOrNull(e)?.installed)) setCraftOpen(true, e)
    else if (!secondary && pc.kind === 'ammoCrate') openStorageMenu(e)
    else sendWorldAction({ kind: 'interact', target: worldEntityId(e), secondary, slot: getSelectedSlot() })
    return true
  }
  const pc = PlatformConstruction.getOrNull(e),
    s = ExpansionState.getMutableOrNull(e)
  if (!pc || !s || !near(e)) return false
  const k = pc.kind
  if (secondary) {
    if (k === 'alarmBell') { recoverCore(); claimRewards(grant); return true }
    if (k === 'waterTank' && s.stock < 8 && consumeCup()) s.stock++
    else if ((k === 'smelter' || k === 'improvedGrill') && s.fuel <= 90 && spend('wood', 1)) s.fuel += 30
    else if (TOWERS[k]) {
      const mutable = PlatformConstruction.getMutable(e)
      mutable.yawDeg = (mutable.yawDeg + 45) % 360
      Transform.getMutable(pc.child).rotation = Quaternion.fromEulerDegrees(0, mutable.yawDeg, 0)
    }
    return true
  }
  if (['workbench', 'armoryBench', 'engineeringBench'].includes(k)) setCraftOpen(true, e)
  else if (k === 'researchTable') {
    if (s.installed) setCraftOpen(true, e)
    else if (getCollectedCount('metalPlate') >= 3 && getCollectedCount('wire') >= 2) {
      subtractCollected('metalPlate', 3)
      subtractCollected('wire', 2)
      s.installed = true
      showNotification('Advanced technology unlocked.')
    } else showNotification('Research needs 3 metal plates and 2 wire.')
  } else if (k === 'smelter' || k === 'improvedGrill') {
    if (s.stock > 0) s.stock -= grant(k === 'smelter' ? 'metalPlate' : 'roasted_potato', s.stock)
    else if ((s.queued || (s.active ? 1 : 0)) < CAMPAIGN.productionQueueLimit && spend(k === 'smelter' ? 'metal' : 'potato', k === 'smelter' ? 2 : 3)) {
      s.queued = (s.queued || (s.active ? 1 : 0)) + 1
      if (!s.active) s.progress = 0
      s.active = true
    }
  } else if (k === 'cropBed') {
    if (s.stock > 0) s.stock -= grant('potato', s.stock)
    else if (!s.active && !s.installed && spend('potato', 1)) s.installed = true
    else if (s.installed && !s.active && consumeCup()) {
      s.active = true
      s.installed = false
      s.progress = 0
    }
  } else if (k === 'rainCollector' || k === 'waterTank') {
    if (s.stock <= 0) {
      showNotification('No fresh water stored.')
      return true
    }
    const slot = getSelectedSlot()
    if (getInventorySlot(slot)?.id === 'cup') {
      if (transmuteContainerSlot(slot, 'freshWater')) s.stock--
    } else if (getStat('thirst') < 1) {
      restoreStat('thirst', 0.35)
      s.stock--
    }
  } else if (k === 'gate') {
    s.active = !s.active
    setGateOpen(pc.child, pc.yawDeg, s.active)
  } else if (k === 'ammoCrate') openStorageMenu(e)
  else if (TOWERS[k]) {
    const id = TOWERS[k].ammo,
      amount = Math.min(20 - s.ammo, getCollectedCount(id))
    if (amount > 0) {
      subtractCollected(id, amount)
      s.ammo += amount
    } else showNotification('Need ' + id + ' in your backpack.')
  } else if (k === 'alarmBell') startRaid()
  else if (k === 'lookoutPost')
    showNotification(
      'Next: ' + ['zombie drift boats', 'pirate skiffs', 'sea beasts'][wave % 3] + '. Ring the alarm bell when ready.'
    )
  else if (k === 'sail') s.active = !s.active
  else if (k === 'steeringWheel') {
    heading = (heading + 1) % 3
    showNotification('Salvage route: ' + resources[heading])
  } else if (k === 'generator' || k === 'engine') {
    if (s.fuel <= 90 && spend('wood', 1)) s.fuel += 30
  } else if (k === 'rescueRadio') {
    if (!s.installed) {
      const blocked = raidGate(true)
      if (blocked) showNotification(blocked)
      else if (spend('transmitterCore', 1)) s.installed = true
    } else if (!s.active) {
      const antenna = [...engine.getEntitiesWith(PlatformConstruction)].some(
        ([a, c]) => c.kind === 'antennaMast' && distance(position(a), position(e)) <= 12
      )
      if (!antenna) showNotification('Build an antenna within 12 meters.')
      else if (!poweredDevices().has(e)) showNotification(`Place a fueled generator, charged battery or powered relay within ${AUTO_WIRE_RANGE_M} meters.`)
      else {
        if (raidActive || raidDelay > 0) { showNotification('Clear the current raid first.'); return true }
        const blocked = raidGate(true)
        if (blocked) { showNotification(blocked); return true }
        if (!hasProgress('finaleStarted')) captureCheckpoint()
        if (startRaid(true)) {
          s.active = true
          recordProgress('finaleStarted')
          showNotification('Transmission starts. Defend the radio!')
        }
      }
    }
  } else showNotification(getExpansionItem(k)!.description)
  return true
}

export function damageStructure(e: Entity, amount: number): void {
  if (!Platform.getOrNull(e) || MainPlatform.getOrNull(e)) return
  metric('structureDamage', amount)
  const expansion = ExpansionState.getMutableOrNull(e)
  if (expansion) {
    expansion.health = Math.max(0, expansion.health - amount)
    if (expansion.health > 0) return
    const pc = PlatformConstruction.get(e)
    removePrototypeEntity(pc.child)
    if (pc.aux !== engine.RootEntity) removePrototypeEntity(pc.aux)
    PlatformConstruction.deleteFrom(e)
    ExpansionState.deleteFrom(e)
    if (StorageContents.getOrNull(e)) StorageContents.deleteFrom(e)
    showNotification('A construction was destroyed.')
    return
  }
  if (!StructureHealth.getOrNull(e)) StructureHealth.create(e, { current: 100, max: 100 })
  const health = StructureHealth.getMutable(e)
  health.current = Math.max(0, health.current - amount)
  if (health.current <= 0) destroyPlatformEntity(e)
}

function powerSnapshot(): PowerNode[] {
  return [...engine.getEntitiesWith(ExpansionState, PlatformConstruction)].map(([e, state, pc]) => ({
    id: e,
    kind: pc.kind,
    x: position(e).x,
    z: position(e).z,
    fuel: state.fuel,
    stock: state.stock
  }))
}
function poweredDevices(): Set<Entity> {
  const nodes = powerSnapshot()
  return new Set(nodes.filter((node) => powerSources(nodes, node.id).length > 0).map((node) => node.id as Entity))
}

// Claim location retains rewards when inventory is full. Core entitlement survives loss.
function recoverCore(): void {
  if (storyWins() < 3 || getCollectedCount('transmitterCore') > 0 || pendingRewards().transmitterCore) return
  for (const [, contents] of engine.getEntitiesWith(StorageContents))
    if (contents.slots.some(slot => slot.id === 'transmitterCore' && slot.count > 0)) return
  for (const [, state, pc] of engine.getEntitiesWith(ExpansionState, PlatformConstruction))
    if (pc.kind === 'rescueRadio' && state.installed) return
  queueReward('transmitterCore', 1)
}
export function startRaid(finale = false): boolean {
  if (raidActive || raidDelay > 0) return false
  const blocked = raidGate(finale)
  if (blocked) { showNotification(blocked); return false }
  if (!finale && hasProgress('finaleStarted')) return false
  if (finale && hasProgress('finaleStarted')) return true // Resume a rebuilt radio without another assault.
  encounterIndex = isSandbox() ? wave % 3 : Math.min(storyWins(), 2)
  finaleGroup = finale ? 0 : -1
  if (finale) finalAssaultCleared = false
  wave++
  raidDelay = CAMPAIGN.warningSeconds
  setAssaultActive(true)
  const config = finale ? CAMPAIGN.finale[0] : CAMPAIGN.raids[encounterIndex]
  showNotification('Incoming ' + config.kind + ' raid in ' + raidDelay + 's. Approach: ' + incomingDirection() + '.')
  return true
}
function incomingDirection(): string {
  const angle = wave * 1.5
  return Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle))
    ? (Math.sin(angle) > 0 ? 'north' : 'south') : (Math.cos(angle) > 0 ? 'east' : 'west')
}
function spawnRaid(): void {
  raidActive = true
  const config = finaleGroup >= 0 ? CAMPAIGN.finale[finaleGroup] : CAMPAIGN.raids[encounterIndex]
  const kind = config.kind
  for (let i = 0; i < config.count; i++) {
    const e = engine.addEntity()
    const angle = i * 0.45 + wave * 1.5
    Transform.create(e, {
      position: Vector3.create(
        GRID_ORIGIN.x + Math.cos(angle) * 30,
        GRID_ORIGIN.y + 0.6,
        GRID_ORIGIN.z + Math.sin(angle) * 30
      ),
      scale: Vector3.create(1.2, 1.2, 1.2)
    })
    GltfContainer.create(e, { src: kind === 'beast' ? 'assets/scene/sharks/shark.glb' : 'assets/scene/items/boat.glb' })
    raiders.push({
      entity: e,
      kind,
      hp: config.hp,
      cooldown: 0,
      slow: 0,
      boarding: false,
      shots: 0
    })
  }
}
function closestPlatform(pos: Vector3, includeMain = false): Entity | null {
  let chosen: Entity | null = null,
    best = Infinity
  for (const [e] of engine.getEntitiesWith(Platform)) {
    if (!includeMain && MainPlatform.getOrNull(e)) continue
    const d = distance(pos, position(e))
    if (d < best) {
      chosen = e
      best = d
    }
  }
  return chosen
}
function damagePlayer(amount: number, enemy: Vector3): void {
  const cam = Transform.getOrNull(engine.CameraEntity)
  const selected = getInventorySlot(getSelectedSlot())
  if (selected?.id === 'boardingShield' && isToolFirePressed() && cam) {
    const forward = Vector3.rotate(Vector3.Forward(), cam.rotation)
    const dir = Vector3.normalize(Vector3.subtract(enemy, cam.position))
    if (Vector3.dot(forward, dir) > 0.3) return
  }
  const result = applyArmor(amount, armor)
  armor = result.armor
  metric('damageTaken', result.damage)
  adjustStat('life', -result.damage)
  healing = 0
}
function tickRaid(dt: number): void {
  if (raidDelay > 0) {
    raidDelay = Math.max(0, raidDelay - dt)
    if (!raidDelay) spawnRaid()
  }
  const player = Transform.getOrNull(engine.PlayerEntity)
  for (let i = raiders.length - 1; i >= 0; i--) {
    const r = raiders[i]
    if (r.hp <= 0) {
      removePrototypeEntity(r.entity)
      raiders.splice(i, 1)
      continue
    }
    const t = Transform.getMutable(r.entity)
    let target = closestPlatform(t.position, r.boarding)
    if (
      r.boarding &&
      target !== null &&
      distance(t.position, position(target)) < 1.6 &&
      PlatformConstruction.getOrNull(target)?.kind === 'spikeStrip'
    ) {
      r.hp -= dt * 18
      damageStructure(target, dt * 3)
    }
    if (r.boarding && player && target !== null) {
      const destination = closestPlatform(player.position, true)
      if (destination !== null && distance(t.position, position(target)) < 1.5) {
        const cells = [...engine.getEntitiesWith(Platform)].map(([e, tile]) => {
          const pc = PlatformConstruction.getOrNull(e)
          const state = ExpansionState.getOrNull(e)
          return {
            id: e,
            x: tile.gridX,
            z: tile.gridZ,
            blocked:
              !!pc &&
              ['wall', 'gate', 'ropeBarricade', 'railing'].includes(pc.kind) &&
              !(pc.kind === 'gate' && state?.active)
          }
        })
        const here = cells.find((cell) => cell.id === target)
        if (!here?.blocked) target = (nextDeckStep(cells, target, destination) as Entity | null) ?? target
      }
    }
    r.cooldown = Math.max(0, r.cooldown - dt)
    r.slow = Math.max(0, r.slow - dt)
    if (target === null) {
      if (player) {
        const offset = Vector3.subtract(player.position, t.position)
        if (Vector3.length(offset) > 2)
          t.position = Vector3.add(t.position, Vector3.scale(Vector3.normalize(offset), dt * 1.2))
        else if (r.cooldown === 0) {
          damagePlayer(0.08, t.position)
          r.cooldown = 2
        }
      }
      continue
    }
    const goal = position(target),
      dist = distance(t.position, goal)
    if (dist > (r.boarding ? 1 : r.kind === 'pirate' ? 6 : 2)) {
      const dir = Vector3.normalize(Vector3.subtract(goal, t.position))
      t.position = Vector3.add(t.position, Vector3.scale(dir, dt * (r.slow ? 0.3 : 1.2)))
      t.rotation = Quaternion.fromEulerDegrees(0, (Math.atan2(dir.x, dir.z) * 180) / Math.PI, 0)
    } else {
      if ((r.kind === 'zombie' || (r.kind === 'pirate' && r.shots >= 3)) && !r.boarding) {
        r.boarding = true
        GltfContainer.deleteFrom(r.entity)
        attachPrototypeSprite(r.entity, 'zombie', false)
        t.scale = Vector3.create(1, 1, 1)
        t.position.y = goal.y + 0.9
      }
      if (r.cooldown === 0) {
        if (player && r.boarding && distance(t.position, player.position) < 3) damagePlayer(0.08, t.position)
        else {
          if (r.kind === 'pirate') shot(t.position, Vector3.add(goal, Vector3.create(0, 1, 0)))
          damageStructure(target, r.kind === 'beast' ? 25 : 12)
          r.shots++
        }
        r.cooldown = 2
      }
      const pc = PlatformConstruction.getOrNull(target),
        s = ExpansionState.getMutableOrNull(target)
    }
  }
  if (raidActive && !raiders.length) {
    raidActive = false
    cleared++
    if (finaleGroup >= 0) {
      if (finaleGroup + 1 < CAMPAIGN.finale.length) {
        finaleGroup++
        wave++
        raidDelay = 15
        showNotification('Reinforcements in 15s: ' + CAMPAIGN.finale[finaleGroup].kind + ' from ' + incomingDirection())
      } else {
        finalAssaultCleared = true
        recordProgress('finaleCleared')
        setAssaultActive(false)
        showNotification('Final assault cleared. Keep the radio powered!')
      }
    } else {
      setAssaultActive(false)
      if (storyWins() < 3) {
        const reward = CAMPAIGN.raids[encounterIndex].reward
        for (const [id, amount] of Object.entries(reward)) queueReward(id, amount!)
        completeStoryRaid()
        recoverCore()
      } else { queueReward('wood', 6); queueReward('metal', 4); beginRecovery() }
      claimRewards(grant)
      showNotification('Raid cleared! Remaining supplies can be claimed at the bell.')
    }
  }
}

function tickTools(dt: number): void {
  toolCooldown = Math.max(0, toolCooldown - dt)
  const life = getStat('life')
  if (life < lastLife - 0.0001) healing = 0
  if (healing > 0) {
    const tick = Math.min(dt, healing)
    restoreStat('life', tick * 0.025)
    healing -= tick
  }
  lastLife = getStat('life')
  if (
    isInventoryActionLocked() ||
    isSelectionPointerLockoutActive() ||
    !isPointerLocked() ||
    toolCooldown > 0 ||
    !toolFireJustPressed()
  )
    return
  const selected = getInventorySlot(getSelectedSlot())
  if (!selected) return
  const id = selected.id
  if (id === 'bandage' && life < 1 && healing === 0 && spend(id, 1)) {
    healing = 10
    showNotification('Bandaging…')
  }
  if (id === 'scrapArmor' && armor < 0.5 && spend(id, 1)) {
    armor = 0.5
    showNotification('Armor equipped.')
  }
  if (id === 'repairKit') {
    const player = Transform.getOrNull(engine.PlayerEntity)
    let target: Entity | null = null,
      best = 5
    if (player)
      for (const [e] of engine.getEntitiesWith(Platform)) {
        const s = ExpansionState.getOrNull(e),
          h = StructureHealth.getOrNull(e)
        const damaged = s ? s.health < s.maxHealth : !!h && h.current < h.max
        const d = distance(position(e), player.position)
        if (damaged && d < best) {
          target = e
          best = d
        }
      }
    if (target === null) showNotification('No damaged structure within reach.')
    else if (spend(id, 1)) {
      const s = ExpansionState.getMutableOrNull(target)
      if (s) s.health = Math.min(s.maxHealth, s.health + 50)
      else {
        const h = StructureHealth.getMutable(target)
        h.current = Math.min(h.max, h.current + 50)
      }
      showNotification('Repaired 50 health.')
    }
  }
  if (id === 'salvageAxe') {
    const debris = getLookAtGarbageEntity(),
      player = Transform.getOrNull(engine.PlayerEntity)
    if (debris !== null && player && distance(position(debris), player.position) <= 4) {
      const floating = FloatingGarbage.getOrNull(debris)
      if (floating) {
        bankGarbageKind(floating.kind)
        grant('metal', 1)
        destroyFloatingGarbage(debris)
        toolCooldown = 1.4
        return
      }
    }
  }
  if (id === 'bow' || id === 'spear' || id === 'salvageAxe') {
    const cam = Transform.getOrNull(engine.CameraEntity)
    if (!cam) return
    const forward = Vector3.rotate(Vector3.Forward(), cam.rotation)
    const target = raiders
      .filter((r) => {
        const offset = Vector3.subtract(position(r.entity), cam.position)
        return (
          Vector3.length(offset) <= (id === 'bow' ? 28 : 4) && Vector3.dot(Vector3.normalize(offset), forward) > 0.93
        )
      })
      .sort((a, b) => distance(position(a.entity), cam.position) - distance(position(b.entity), cam.position))[0]
    if (id === 'bow' && !spend('arrows', 1)) return
    if (target) {
      if (id === 'bow') shot(cam.position, position(target.entity))
      target.hp -= id === 'bow' ? 35 : 25
      showNotification('Hit!')
    } else if (id === 'salvageAxe') showNotification('Aim at boarding wreckage within reach.')
    toolCooldown = id === 'bow' ? 1 : 1.4
  }
}

function shot(from: Vector3, to: Vector3): void {
  if (shots.length >= 24) return
  const e = engine.addEntity()
  const offset = Vector3.subtract(to, from)
  const length = Vector3.length(offset)
  Transform.create(e, {
    position: Vector3.add(from, Vector3.scale(offset, 0.5)),
    rotation: Quaternion.fromEulerDegrees(
      (-Math.atan2(offset.y, Math.hypot(offset.x, offset.z)) * 180) / Math.PI,
      (Math.atan2(offset.x, offset.z) * 180) / Math.PI,
      0
    ),
    scale: Vector3.create(0.035, 0.035, length)
  })
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(1, 0.72, 0.25, 1),
    emissiveColor: { r: 1, g: 0.4, b: 0.08 },
    emissiveIntensity: 1
  })
  shots.push({ entity: e, remaining: 0.12 })
}
let sharedStatusRevision = -1
let sharedStatus: string | null = null
export function getExpansionStatus(): string | null {
  if (isMultiplayer()) {
    const w = getMultiplayerSnapshot()?.world
    if (!w) return null
    if (sharedStatusRevision === w.revision) return sharedStatus
    sharedStatusRevision = w.revision
    const e = w.events
    const radio = Object.values(w.tiles).find(t => t.device?.kind === 'rescueRadio' && t.device.active)?.device
    sharedStatus = w.progress.won ? 'RESCUE COMPLETE · Keep building together' : e.raidDelay > 0 ? `RAID ${e.wave} · Incoming in ${Math.ceil(e.raidDelay)}s` : e.raidActive ? `RAID ${e.wave} · ${Object.values(w.enemies).filter(enemy => enemy.kind !== 'shark').length} enemies remaining` : radio ? `RESCUE ${Math.floor(radio.progress / CAMPAIGN.broadcastSeconds * 100)}% · Keep the radio powered` : null
    return sharedStatus
  }
  const radio = [...engine.getEntitiesWith(ExpansionState, PlatformConstruction)].find(
    ([, s, c]) => c.kind === 'rescueRadio' && s.active
  )
  if (radio) {
    const [e, state] = radio
    const connected = poweredDevices().has(e)
    return (
      'RESCUE ' + Math.floor((state.progress / 120) * 100) + '% · ' + (raidDelay > 0 ? 'Incoming ' + Math.ceil(raidDelay) + 's' : raidActive ? raiders.length + ' attackers' : connected ? 'Transmitting' : 'Power needed')
    )
  }
  if (raidDelay > 0)
    return 'RAID ' + wave + ' · ' + Math.ceil(raidDelay) + 's · ' + (finaleGroup >= 0 ? CAMPAIGN.finale[finaleGroup].kind : CAMPAIGN.raids[encounterIndex].kind) + ' · ' + incomingDirection()
  if (raidActive) return 'RAID ' + wave + ' · ' + raiders.length + ' enemies remaining'
  return null
}

export function expansionSystem(dt: number): void {
  if (isStartupGateActive() || isGameOver() || isWinActive()) return
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].remaining -= dt
    if (shots[i].remaining <= 0) {
      engine.removeEntity(shots[i].entity)
      shots.splice(i, 1)
    }
  }
  tickTools(Math.min(dt, 1))
  stepAccumulator += Math.max(0, Math.min(dt, 1))
  while (stepAccumulator >= 0.25) {
    stepAccumulator -= 0.25
    simulate(0.25)
  }
}
function simulate(dt: number): void {
  elapsed += dt
  const raining = elapsed % 180 >= 120
  if (raidActive) metric('combatSeconds', dt)
  tickRaid(dt)
  const power = powerSnapshot()
  const devices = [...engine.getEntitiesWith(ExpansionState, PlatformConstruction)]
  let sailing = false,
    running = false
  for (const [e, , pc] of devices) {
    const s = ExpansionState.getMutable(e),
      kind = pc.kind
    if (s.active && ['smelter', 'improvedGrill', 'cropBed'].includes(kind)) metric('productionSeconds', dt)
    const oldStock = s.stock
    advanceProduction(kind, s, dt, raining)
    if (kind === 'smelter' && s.stock > oldStock) recordProgress('plate')
    if (kind === 'generator' || kind === 'engine') {
      if (s.fuel > 0) {
        if (kind === 'engine') running = true
        s.fuel = Math.max(0, s.fuel - dt)
      }
    }
    if (kind === 'sail' && s.active) sailing = true
    if (kind === 'batteryBank') {
      const node = power.find((node) => node.id === e)!
      const seconds = Math.min(
        dt,
        Math.max(
          0,
          ...powerSources(power, e)
            .filter((source) => source.kind === 'generator')
            .map((source) => source.fuel)
        )
      )
      node.stock = Math.min(120, node.stock + seconds * 2)
    }
    if (kind === 'rescueRadio' && s.active) {
      const antenna = devices.some(([a, , c]) => c.kind === 'antennaMast' && distance(position(a), position(e)) <= 12)
      if (antenna) {
        s.progress = Math.min(120, s.progress + supplyPower(power, e, dt))
        if (s.progress >= CAMPAIGN.broadcastSeconds && (finalAssaultCleared || hasProgress('finaleCleared'))) {
          s.active = false
          triggerWin()
        }
      }
    }
    const tower = TOWERS[kind]
    if (tower) {
      s.progress = Math.max(0, s.progress - dt)
      if (s.ammo === 0)
        for (const [box, contents] of engine.getEntitiesWith(StorageContents)) {
          if (distance(position(box), position(e)) > 6) continue
          const slot = contents.slots.findIndex((slot) => slot.id === tower.ammo && slot.count > 0)
          if (slot >= 0) {
            const mut = StorageContents.getMutable(box),
              entry = mut.slots[slot]
            const n = Math.min(20, entry.count)
            s.ammo += n
            mut.slots[slot] = entry.count === n ? { id: '', count: 0 } : { id: entry.id, count: entry.count - n }
            break
          }
        }
      if (s.progress > 0 || s.ammo <= 0) continue
      const origin = position(e)
      const target = raiders.find(
        (r) =>
          (tower.target === 'beasts'
            ? r.kind === 'beast'
            : tower.target === 'boarders'
              ? r.boarding
              : r.kind !== 'beast') &&
          isInArc(position(r.entity).x - origin.x, position(r.entity).z - origin.z, pc.yawDeg, tower.range)
      )
      if (target) {
        shot(Vector3.add(origin, Vector3.create(0, 1.3, 0)), position(target.entity))
        target.hp -= tower.damage
        if (kind === 'netLauncher') target.slow = 5
        metric('ammo:' + tower.ammo)
        s.ammo--
        s.progress = tower.cooldown
      } else if (kind === 'harpoonTower')
        for (const [shark] of engine.getEntitiesWith(SharkAttack)) {
          if (distance(position(shark), origin) > tower.range) continue
          tryHitShark(shark)
          s.ammo--
          s.progress = tower.cooldown
          break
        }
    }
  }
  for (const node of power)
    if (node.kind === 'batteryBank') ExpansionState.getMutable(node.id as Entity).stock = node.stock
  if (sailing || running) {
    voyage += dt * (running ? 2 : 1)
    if (voyage >= 15) {
      voyage = 0
      createFloatingGarbage({
        kind: resources[heading],
        position: Vector3.create(GRID_ORIGIN.x + 5, GRID_ORIGIN.y, GRID_ORIGIN.z + 12),
        velocity: Vector3.create(0, 0, -0.6),
        maxLifetime: 50
      })
    }
  }
}

export function debugAdvanceExpansion(seconds = 30): void {
  if (!DEBUG_MODE) return
  for (let time = 0; time < Math.min(60, Math.max(0, seconds)); time += 0.25) simulate(0.25)
}

export function serializeExpansionSession(): { armor: number; healing: number; heading: number; voyage: number; elapsed: number } {
  return { armor, healing, heading, voyage, elapsed }
}
export function hydrateExpansionSession(saved: ReturnType<typeof serializeExpansionSession>): void {
  armor = Math.max(0, Math.min(0.5, saved.armor || 0))
  healing = Math.max(0, Math.min(10, saved.healing || 0))
  heading = Math.max(0, Math.min(2, Math.floor(saved.heading || 0)))
  voyage = Math.max(0, Math.min(15, saved.voyage || 0))
  elapsed = Math.max(0, saved.elapsed || 0)
  lastLife = getStat('life')
}
