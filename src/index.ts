import { SkyboxTime, engine } from '@dcl/sdk/ecs'

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
import { createFallRescueSystem } from './systems/fallRescue'
import { firstPersonItemSwaySystem } from './systems/firstPersonItemSway'
import { floatingGarbageSystem } from './systems/floatingGarbage'
import { garbageSpawnerSystem } from './systems/garbageSpawner'
import { hammerSwingSystem } from './systems/hammerSwing'
import { hookThrowAnimSystem } from './systems/hookThrowAnim'
import { hookThrowerSystem } from './systems/hookThrower'
import { inventoryInputSystem } from './systems/inventoryInput'
import { raftBuilderSystem } from './systems/raftBuilder'
import { sharkAttackSystem } from './systems/sharkAttack'
import { sharkDirectorSystem } from './systems/sharkDirector'
import { sharkOrbitSystem } from './systems/sharkOrbit'
import { sharkPointerEventsSystem } from './systems/sharkPointerEvents'
import { spearAttackSystem } from './systems/spearAttack'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'
import { actionButtonResetSystem } from './ui/actionButton'
import { dragResetSystem } from './ui/inventoryDrag'
import { inventoryToggleResetSystem } from './ui/inventoryToggle'

// Starting population. The shark director scales this up/down each frame
// based on the patrol-ring circumference (see SHARK_TARGET_ARC_PER_SHARK).
const SHARK_INITIAL_COUNT = 3
// Initial radius — director recomputes from raft extent each frame.
const SHARK_INITIAL_RADIUS = 12

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
  engine.addSystem(createFallRescueSystem(GRID_ORIGIN))
  engine.addSystem(raftBuilderSystem)
  engine.addSystem(hookThrowerSystem)
  engine.addSystem(inventoryInputSystem)
  engine.addSystem(inventoryToggleResetSystem)
  engine.addSystem(dragResetSystem)
  // Must be last so every consumer above sees the action-button edge flags
  // for the current frame before they're cleared.
  engine.addSystem(actionButtonResetSystem)
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
