import { SkyboxTime, engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'

import { initSaveClient, saveClientTickSystem } from './client/saveClient'
import { runServer } from './server/server'

import {
  SHARK_INITIAL_COUNT,
  SHARK_INITIAL_RADIUS
} from './config/gameConfig'
import {
  GRID_ORIGIN,
  configureGridOrigin,
  createFirstPersonArea,
  createHeldItem,
  createPlatform,
  createSeabed,
  createWaterFloorV2,
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
import { inventoryToggleResetSystem } from './ui/inventoryToggle'
import { tickItemReceivedNotification } from './ui/itemReceivedNotification'
import { tickNotification } from './ui/notification'
import { startupGateInputLockSystem } from './ui/startupGate'
import { storageToggleResetSystem } from './ui/storageToggle'
import { systemToggleTickSystem } from './ui/systemToggle'
import { pressPulseTickSystem } from './ui/pressPulse'
import { purifySessionTickSystem } from './ui/purifySession'
import { worldClickGateResetSystem } from './ui/worldClickGate'

export async function main(): Promise<void> {
  // Authoritative server runs the same entry point headlessly. It only
  // needs the save/load message handlers — none of the visual / input /
  // simulation systems below should run server-side, so we bail out
  // immediately after wiring the room.
  if (isServer()) {
    runServer()
    return
  }
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
  engine.addSystem(systemToggleTickSystem)
  engine.addSystem(gameOverInputLockSystem)
  engine.addSystem(startupGateInputLockSystem)
  engine.addSystem(pressPulseTickSystem)
  engine.addSystem(tickNotification)
  engine.addSystem(tickItemReceivedNotification)
  engine.addSystem(dragResetSystem)
  // These two end-of-frame resets must be the last systems registered
  // so every consumer above sees the action-button edge flag and the
  // world-click-consumed flag for the current frame before they're
  // cleared. Order between them doesn't matter — they touch
  // independent state.
  engine.addSystem(actionButtonResetSystem)
  engine.addSystem(worldClickGateResetSystem)
  // Save-system networking: register room listeners once, then run the
  // tick system that watches for state-sync and auto-loads on the rising
  // edge. Must come after the gameplay state modules above because the
  // auto-load mutates them on first sync.
  initSaveClient()
  engine.addSystem(saveClientTickSystem)
  setupUi()
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
