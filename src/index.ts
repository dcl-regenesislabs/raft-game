import { SkyboxTime, engine } from '@dcl/sdk/ecs'

import {
  DEBUG_MODE,
  SHARK_INITIAL_COUNT,
  SHARK_INITIAL_RADIUS
} from './config/gameConfig'
import {
  GRID_ORIGIN,
  configureGridOrigin,
  createConstruction,
  createFirstPersonArea,
  createHeldItem,
  createPlatform,
  createSeabed,
  createWaterFloorV2,
  gridCellToWorld,
  spawnRingShark
} from './factories'
import { DEMO_PARCEL_GRID, FULL_PARCEL_GRID } from './factories/sceneLevels'
import { getSceneMode } from './runtime/sceneMode'
import { constructionInteractSystem } from './systems/constructionInteract'
import { constructionPlacementSystem } from './systems/constructionPlacement'
import { cupFillSystem } from './systems/cupFill'
import { createFallRescueSystem } from './systems/fallRescue'
import { firstPersonItemSwaySystem } from './systems/firstPersonItemSway'
import { fishingRodSystem } from './systems/fishingRod'
import { floatingGarbageSystem } from './systems/floatingGarbage'
import { foodEatSystem } from './systems/foodEat'
import { garbageSpawnerSystem } from './systems/garbageSpawner'
import { grillCookSystem } from './systems/grillCook'
import { grillFireSystem } from './systems/grillFire'
import { hammerSwingSystem } from './systems/hammerSwing'
import { hookThrowAnimSystem } from './systems/hookThrowAnim'
import { hookThrowerSystem } from './systems/hookThrower'
import { inventoryInputSystem } from './systems/inventoryInput'
import { lookAtTargetSystem } from './systems/lookAtTarget'
import { raftBuilderSystem } from './systems/raftBuilder'
import { sharkAttackSystem } from './systems/sharkAttack'
import { sharkDirectorSystem } from './systems/sharkDirector'
import { sharkOrbitSystem } from './systems/sharkOrbit'
import { sharkPointerEventsSystem } from './systems/sharkPointerEvents'
import { spearAttackSystem } from './systems/spearAttack'
import { survivalDrainSystem } from './systems/survivalDrain'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'
import { actionButtonResetSystem } from './ui/actionButton'
import { craftSessionTickSystem } from './ui/craftSession'
import { craftToggleResetSystem } from './ui/craftToggle'
import { gameOverInputLockSystem } from './ui/gameOver'
import { dragResetSystem } from './ui/inventoryDrag'
import { addCollected } from './ui/inventoryState'
import { inventoryToggleResetSystem } from './ui/inventoryToggle'
import { tickNotification } from './ui/notification'
import { storageToggleResetSystem } from './ui/storageToggle'
import { pressPulseTickSystem } from './ui/pressPulse'
import { purifySessionTickSystem } from './ui/purifySession'
import { worldClickGateResetSystem } from './ui/worldClickGate'

export async function main(): Promise<void> {
  // Detect which deployment we're running in. raft.dcl.eth is the FULL
  // 50x50 game; everything else (italy2026 demo, local preview) gets the
  // 5x5 demo layout. configureGridOrigin must run before any factory below
  // because gridCellToWorld and the raft-builder system read GRID_ORIGIN.
  const mode = await getSceneMode()
  const parcelGrid = mode === 'full' ? FULL_PARCEL_GRID : DEMO_PARCEL_GRID
  configureGridOrigin(parcelGrid)

  // Lock the world skybox to midday (12:00 = 43200 s into the day) so
  // lighting stays consistent across long play sessions and screenshots.
  // Works in both local preview and Worlds deployments.
  SkyboxTime.create(engine.RootEntity, { fixedTime: 43200 })

  createFirstPersonArea(parcelGrid)
  createHeldItem('hook')
  engine.addSystem(firstPersonItemSwaySystem)
  engine.addSystem(spearAttackSystem)
  engine.addSystem(hammerSwingSystem)
  // lookAtTargetSystem owns the camera-forward raycast that classifies
  // what the player is currently aiming at (water / purifier / grill).
  // Must run before `constructionInteract` and `cupFill` so they read a
  // fresh target this frame.
  engine.addSystem(lookAtTargetSystem)
  // Construction + cup-fill must run BEFORE foodEat so they can mark
  // this frame's click as consumed (via worldClickGate) — otherwise a
  // tap on the purifier with salt water held would also drain the cup.
  engine.addSystem(constructionInteractSystem)
  engine.addSystem(cupFillSystem)
  engine.addSystem(foodEatSystem)
  engine.addSystem(hookThrowAnimSystem)
  createSeabed(parcelGrid)
  createWaterFloorV2(parcelGrid)
  engine.addSystem(waterScrollSystem)
  createPlatform(GRID_ORIGIN, { gridX: 0, gridZ: 0, isMain: true })
  spawnSharks()
  engine.addSystem(sharkOrbitSystem)
  engine.addSystem(sharkDirectorSystem)
  engine.addSystem(sharkAttackSystem)
  engine.addSystem(sharkPointerEventsSystem)
  engine.addSystem(garbageSpawnerSystem)
  engine.addSystem(floatingGarbageSystem)
  engine.addSystem(grillFireSystem)
  engine.addSystem(grillCookSystem)
  engine.addSystem(createFallRescueSystem(GRID_ORIGIN))
  engine.addSystem(survivalDrainSystem)
  engine.addSystem(raftBuilderSystem)
  engine.addSystem(constructionPlacementSystem)
  engine.addSystem(hookThrowerSystem)
  engine.addSystem(fishingRodSystem)
  engine.addSystem(inventoryInputSystem)
  engine.addSystem(craftSessionTickSystem)
  engine.addSystem(purifySessionTickSystem)
  engine.addSystem(inventoryToggleResetSystem)
  engine.addSystem(craftToggleResetSystem)
  engine.addSystem(storageToggleResetSystem)
  engine.addSystem(gameOverInputLockSystem)
  engine.addSystem(pressPulseTickSystem)
  engine.addSystem(tickNotification)
  engine.addSystem(dragResetSystem)
  // These two end-of-frame resets must be the last systems registered
  // so every consumer above sees the action-button edge flag and the
  // world-click-consumed flag for the current frame before they're
  // cleared. Order between them doesn't matter — they touch
  // independent state.
  engine.addSystem(actionButtonResetSystem)
  engine.addSystem(worldClickGateResetSystem)
  setupUi()

  if (DEBUG_MODE) {
    seedDebugInventory()
    seedDebugWorld()
  }
}

// Pre-seeds the inventory with crafting materials so recipes can be exercised
// without grinding garbage pickups. Gated by `DEBUG_MODE` in
// `config/gameConfig.ts` — flip that off before shipping.
function seedDebugInventory(): void {
  // Materials
  addCollected('wood', 1000)
  addCollected('plants', 1000)
  addCollected('plastic', 1000)
  addCollected('rope', 1000)
  addCollected('metal', 1000)
  // Crafted stackables / placeables. hammer/spear are non-stackable and
  // already reserved in the default bottom-bar layout, so seeding them
  // here would just allocate duplicate slots.
  addCollected('fishingRod', 10)
  addCollected('knife', 10)
  addCollected('platform', 10)
  addCollected('purifier', 10)
  addCollected('grill', 10)
  addCollected('storage', 10)
  // Containers are non-stackable — each instance gets its own slot, so
  // the seed only adds one of each variant. The cup goes in too so the
  // player can test the empty-cup → fill flow without crafting first.
  addCollected('cup', 1)
  addCollected('saltWater', 1)
  addCollected('freshWater', 1)
  // Cooking ingredients — the 14 sources documented in COOKING.md so the
  // cook-menu flow can be exercised without grinding fishing/barrels.
  addCollected('sardines', 10)
  addCollected('mussels', 10)
  addCollected('clams', 10)
  addCollected('squid', 10)
  addCollected('shark_meat', 10)
  addCollected('seaweed', 10)
  addCollected('tomatoes', 10)
  addCollected('garlic', 10)
  addCollected('sea_salt', 10)
  addCollected('olive_oil', 10)
  addCollected('potato', 10)
  addCollected('crab', 10)
  addCollected('spaghetti', 10)
  addCollected('fettuccine', 10)
}

// Spawns the 8 platforms surrounding the main raft (the king-move ring
// around grid cell (0, 0)) and pre-places a grill on the east tile and
// a water purifier on the west tile so cooking / purification flows can
// be exercised without crafting first. Gated by `DEBUG_MODE`.
function seedDebugWorld(): void {
  const ringOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ]
  for (const [gx, gz] of ringOffsets) {
    const platform = createPlatform(gridCellToWorld(gx, gz), {
      gridX: gx,
      gridZ: gz
    })
    if (gx === 1 && gz === 0) createConstruction(platform, 'grill')
    else if (gx === -1 && gz === 0) createConstruction(platform, 'purifier')
    else if (gx === 0 && gz === 1) createConstruction(platform, 'storage')
  }
}

function spawnSharks(): void {
  const phaseStep = (Math.PI * 2) / SHARK_INITIAL_COUNT
  for (let i = 0; i < SHARK_INITIAL_COUNT; i++) {
    spawnRingShark({
      centerX: GRID_ORIGIN.x,
      centerZ: GRID_ORIGIN.z,
      radius: SHARK_INITIAL_RADIUS,
      phase: phaseStep * i
    })
  }
}
