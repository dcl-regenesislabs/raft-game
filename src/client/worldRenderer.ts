import { cancelConstructionPreview } from '../systems/constructionPlacement'
import { cancelRaftPreview } from '../systems/raftBuilder'
import { clearStoragePick } from '../ui/storageSession'
import { createChef } from '../factories/chef'
import { showNotification } from '../ui/notification'
import { createFloatingIslandPool, activateFloatingIsland, deactivateFloatingIsland } from '../factories/floatingIsland'
import { playChestOpenAnimation } from '../factories/islandChest'
import { hydrateTutorial, TutorialAction } from '../ui/tutorialState'
import { engine, Entity, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import {
  ActiveCook,
  ExpansionState,
  PlatformConstruction,
  PurifierState,
  StorageContents,
  StructureHealth,
  FloatingIsland,
  IslandChest
} from '../components'
import { createPlatform, destroyPlatformEntity, gridCellToWorld } from '../factories/platform'
import {
  createConstruction,
  ConstructionKind,
  setConstructionPointerPrompt,
  setPurifierHoverPrompt
} from '../factories/construction'
import { createFloatingGarbage, destroyFloatingGarbage, GarbageKind } from '../factories/floatingGarbage'
import { createIngredientSprites, createPlateSprite, createFlameSprite } from '../factories/cookingSprites'
import { getCookableById } from '../ui/cookableItems'
import { hydrateInventoryLayout, hydrateInventoryDurabilities } from '../ui/items'
import {
  getSelectedSlot,
  hydrateInventoryCounts,
  hydrateSelectedSlot,
  refreshHeldForSelectedSlot
} from '../ui/inventoryState'
import { hydrateVitals } from '../ui/statsBars'
import { hydrateLearnedRecipes } from '../ui/learnedRecipes'
import { hydrateProgress } from '../progression/state'
import { setPlayTimeS } from '../systems/playTimer'
import { hydratePlayerPosition } from '../ui/playerPosition'
import { dismissStartupGate } from '../ui/startupGate'
import { setHeldViewmodelHidden } from '../factories/heldItem'
import { setGateOpen, attachPrototypeSprite, removePrototypeEntity } from '../expansion/sprites'
import { setMultiplayerDeath } from '../ui/gameOver'
import { closeStorageMenu } from '../ui/storageToggle'
import { setCookOpen } from '../ui/cookToggle'
import { setCraftOpen } from '../ui/craftToggle'
import { setInventoryOpen } from '../ui/inventoryToggle'
import { setSystemMenuOpen } from '../ui/systemSession'
import { cancelMultiplayerHook } from '../systems/hookThrower'
import { cancelFishingForEquipmentChange } from '../systems/fishingRod'
import { Snapshot, Tile } from '../multiplayer/types'
import { ORIGIN, tileObjectId } from '../multiplayer/world'
import { applyingWorld } from './multiplayerState'
import { identifyWorldEntity, forgetWorldEntity } from './worldEntities'

const platforms = new Map<string, Entity>()
const debris = new Map<string, Entity>()
const enemies = new Map<string, Entity>()
const cooking = new Map<string, string>()
let island: Entity | null = null
let chef: Entity | null = null
const chefEntities: Entity[] = []
function clearCook(entity: Entity): void {
  const c = ActiveCook.getOrNull(entity)
  if (!c) return
  for (const child of [...c.foodSprites, c.fireSprite]) if (child !== engine.RootEntity) engine.removeEntity(child)
  ActiveCook.deleteFrom(entity)
}
function applyTile(tile: Tile, before?: Tile): void {
  let entity = platforms.get(tile.id)
  if (
    entity !== undefined &&
    ((before?.instance ?? 0) !== (tile.instance ?? 0) ||
      before?.device?.kind !== tile.device?.kind ||
      before?.device?.support !== tile.device?.support)
  ) {
    closeStorageMenu()
    setCookOpen(false)
    setCraftOpen(false)
    forgetWorldEntity(entity)
    destroyPlatformEntity(entity)
    platforms.delete(tile.id)
    cooking.delete(tile.id)
    entity = undefined
  }
  if (entity === undefined) {
    entity = createPlatform(gridCellToWorld(tile.x, tile.z), {
      gridX: tile.x,
      gridZ: tile.z,
      isMain: tile.id === '0,0'
    })
    platforms.set(tile.id, entity)
    identifyWorldEntity(entity, tileObjectId(tile))
    if (tile.device) {
      const child = createConstruction(
        entity,
        tile.device.kind as ConstructionKind,
        tile.device.yawDeg,
        tile.device.support
      )
      identifyWorldEntity(child, tileObjectId(tile))
    }
  }
  StructureHealth.createOrReplace(entity, { current: tile.health, max: 100 })
  const d = tile.device
  if (!d) return
  const pc = PlatformConstruction.getMutable(entity)
  pc.yawDeg = d.yawDeg
  Transform.getMutable(pc.child).rotation = Quaternion.fromEulerDegrees(0, d.yawDeg, 0)
  if (ExpansionState.getOrNull(entity))
    ExpansionState.createOrReplace(entity, {
      health: d.health,
      maxHealth: d.maxHealth,
      fuel: d.fuel,
      progress: d.progress,
      stock: d.stock,
      queued: d.queued,
      ammo: d.ammo,
      active: d.active,
      installed: d.installed
    })
  if (d.contents.length)
    StorageContents.createOrReplace(entity, { slots: d.contents.map((s) => ({ id: s.id, count: s.count })) })
  if (d.kind === 'gate') setGateOpen(pc.child, d.yawDeg, d.active)
  if (d.kind === 'purifier') {
    const state = PurifierState.getMutable(entity)
    state.saltAmount = d.saltAmount
    state.freshAmount = d.freshAmount
    state.fireSec = d.fuel
    if (d.fuel > 0 && state.flameSprite === engine.RootEntity) state.flameSprite = createFlameSprite(entity, d.yawDeg)
    if (d.fuel === 0 && state.flameSprite !== engine.RootEntity) {
      engine.removeEntity(state.flameSprite)
      state.flameSprite = engine.RootEntity
    }
    setPurifierHoverPrompt(pc.child, d.freshAmount > 0 ? 'Drink purified water' : 'Add salt water', d.fuel === 0)
  }
  const signature = `${d.recipeId}:${d.cookStatus}`
  if (cooking.get(tile.id) !== signature) {
    clearCook(entity)
    cooking.set(tile.id, signature)
    const recipe = getCookableById(d.recipeId)
    if (recipe) {
      const foodSprites =
        d.cookStatus === 0
          ? createIngredientSprites(entity, d.yawDeg, recipe)
          : [createPlateSprite(entity, d.yawDeg, d.cookStatus === 2 ? 'images/cooking/coal.png' : recipe.texture)]
      ActiveCook.create(entity, {
        recipeId: d.recipeId,
        elapsedSec: d.cookElapsed,
        status: d.cookStatus,
        bobPhase: 0,
        foodSprites,
        fireSprite: d.cookStatus === 2 ? engine.RootEntity : createFlameSprite(entity, d.yawDeg)
      })
    }
    if (d.kind === 'grill')
      setConstructionPointerPrompt(pc.child, !d.recipeId ? 'Cook' : d.cookStatus === 0 ? null : 'Collect food')
  }
}
export function renderWorld(snapshot: Snapshot, previous: Snapshot | null): void {
  applyingWorld(() => {
    const reset = !!previous && previous.world.generation !== snapshot.world.generation
    if (reset) {
      setInventoryOpen(false)
      setCraftOpen(false)
      setCookOpen(false)
      closeStorageMenu()
      setSystemMenuOpen(false)
      cancelMultiplayerHook()
      cancelFishingForEquipmentChange()
      cancelConstructionPreview()
      cancelRaftPreview()
      clearStoragePick()
      for (const entity of platforms.values()) {
        forgetWorldEntity(entity)
        destroyPlatformEntity(entity)
      }
      platforms.clear()
      cooking.clear()
    }
    for (const [id, entity] of platforms)
      if (!snapshot.world.tiles[id]) {
        closeStorageMenu()
        setCookOpen(false)
        forgetWorldEntity(entity)
        destroyPlatformEntity(entity)
        platforms.delete(id)
        cooking.delete(id)
      }
    for (const tile of Object.values(snapshot.world.tiles)) {
      const before = reset ? undefined : previous?.world.tiles[tile.id]
      if (!platforms.has(tile.id) || (tile !== before && JSON.stringify(tile) !== JSON.stringify(before)))
        applyTile(tile, before)
    }
    for (const [id, entity] of debris)
      if (!snapshot.world.debris[id]) {
        forgetWorldEntity(entity)
        destroyFloatingGarbage(entity)
        debris.delete(id)
      }
    for (const d of Object.values(snapshot.world.debris)) {
      let entity = debris.get(d.id)
      if (entity === undefined) {
        entity = createFloatingGarbage({
          kind: d.kind as GarbageKind,
          position: d.position,
          velocity: d.velocity,
          maxLifetime: d.remaining
        })
        debris.set(d.id, entity)
        identifyWorldEntity(entity, d.id)
      }
      Transform.getMutable(entity).position = { ...d.position }
    }
    for (const [id, entity] of enemies)
      if (!snapshot.world.enemies[id]) {
        forgetWorldEntity(entity)
        removePrototypeEntity(entity)
        enemies.delete(id)
      }
    for (const e of Object.values(snapshot.world.enemies)) {
      let entity = enemies.get(e.id)
      if (entity === undefined) {
        entity = engine.addEntity()
        Transform.create(entity, { position: e.position })
        enemies.set(e.id, entity)
        identifyWorldEntity(entity, e.id)
      }
      const old = previous?.world.enemies[e.id]
      if (!old || old.boarding !== e.boarding) {
        if (e.boarding) {
          GltfContainer.deleteFrom(entity)
          attachPrototypeSprite(entity, 'zombie', false)
        } else
          GltfContainer.createOrReplace(entity, {
            src:
              e.kind === 'shark' || e.kind === 'beast' ? 'assets/scene/sharks/shark.glb' : 'assets/scene/items/boat.glb'
          })
      }
      const t = Transform.getMutable(entity)
      if (old)
        t.rotation = Quaternion.fromEulerDegrees(
          0,
          (Math.atan2(e.position.x - old.position.x, e.position.z - old.position.z) * 180) / Math.PI,
          0
        )
      t.position = { ...e.position }
    }
    // Event visuals have no independent timers; their lifetime follows the committed world.
    const events = snapshot.world.events
    if (events.islandPosition && island === null) {
      createFloatingIslandPool()
      activateFloatingIsland({
        position: events.islandPosition,
        velocity: Vector3.Zero(),
        maxLifetime: events.islandRemaining,
        visualSeed: snapshot.world.generation
      })
      for (const [entity] of engine.getEntitiesWith(FloatingIsland)) {
        island = entity
        identifyWorldEntity(entity, 'island')
        break
      }
    }
    if (island !== null && events.islandPosition) Transform.getMutable(island).position = events.islandPosition
    if (island !== null && !events.islandPosition) {
      forgetWorldEntity(island)
      deactivateFloatingIsland()
      island = null
    }
    if (island !== null && !events.islandLoot.length)
      for (const [entity, c] of engine.getEntitiesWith(IslandChest)) {
        if (c.island === island && !c.opened) {
          IslandChest.getMutable(entity).opened = true
          playChestOpenAnimation(entity)
        }
      }
    if (events.chefRemaining > 0 && chef === null) {
      chef = engine.addEntity()
      Transform.create(chef, { position: { ...ORIGIN, z: ORIGIN.z + 18 } })
      GltfContainer.create(chef, { src: 'assets/scene/items/boat.glb' })
      identifyWorldEntity(chef, 'chef')
      createChef({
        parent: chef,
        position: Vector3.create(0, 0.5, 0),
        dialogLines: ['A warm meal for your journey!'],
        hoverLabel: 'Collect a meal',
        tag: (entity) => chefEntities.push(entity)
      })
    }
    if (chef !== null && events.chefRemaining === 0) {
      for (const entity of chefEntities.splice(0)) engine.removeEntity(entity)
      forgetWorldEntity(chef)
      engine.removeEntity(chef)
      chef = null
    }
    if (snapshot.world.progress.won && !previous?.world.progress.won)
      showNotification('Rescue complete! Your shared raft remains open for play.')
    const p = snapshot.player
    if (!previous || JSON.stringify(p.slots) !== JSON.stringify(previous.player.slots)) {
      const selected = getSelectedSlot()
      hydrateInventoryLayout(p.slots.map((s) => s.id))
      hydrateInventoryDurabilities(p.slots.map((s) => s.durability))
      hydrateInventoryCounts(p.slots.filter((s) => s.id).map((s) => ({ id: s.id, count: s.count })))
      hydrateSelectedSlot(selected)
      refreshHeldForSelectedSlot()
    }
    hydrateVitals(p)
    hydrateLearnedRecipes(snapshot.world.progress.recipes)
    const progress = snapshot.world.progress
    hydrateProgress({
      version: 1,
      mode: 'campaign',
      events: progress.events,
      wins: progress.wins,
      seconds: progress.seconds,
      recovery: progress.recovery,
      pending: progress.pending,
      metrics: progress.metrics,
      milestones: progress.milestones,
      seed: snapshot.world.seed,
      salvage: snapshot.world.events.salvageIndex
    })
    hydrateTutorial(progress.events as TutorialAction[])
    setPlayTimeS(progress.seconds)
    setMultiplayerDeath(p.dead)
    if (!previous || reset || p.respawns !== previous.player.respawns) {
      const tile = Object.values(snapshot.world.tiles).find(
        (t) =>
          Math.abs(p.position.x - (ORIGIN.x + t.x * 3)) < 1.5 &&
          Math.abs(p.position.z - (ORIGIN.z + t.z * 3)) < 1.5 &&
          !t.device
      )
      hydratePlayerPosition(
        tile ? { x: ORIGIN.x + tile.x * 3, y: ORIGIN.y + 1, z: ORIGIN.z + tile.z * 3 } : { ...ORIGIN, y: ORIGIN.y + 1 }
      )
    }
    dismissStartupGate()
    setHeldViewmodelHidden(false)
  })
}
