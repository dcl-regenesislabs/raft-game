import { engine } from '@dcl/sdk/ecs'

import {
  GRID_ORIGIN,
  createPlatform,
  createSeabed,
  createWaterFloorV2,
  spawnRingShark
} from './factories'
import { createFallRescueSystem } from './systems/fallRescue'
import { inventoryInputSystem } from './systems/inventoryInput'
import { raftBuilderSystem } from './systems/raftBuilder'
import { sharkAttackSystem } from './systems/sharkAttack'
import { sharkDirectorSystem } from './systems/sharkDirector'
import { sharkOrbitSystem } from './systems/sharkOrbit'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'

// Starting population. The shark director scales this up/down each frame
// based on the patrol-ring circumference (see SHARK_TARGET_ARC_PER_SHARK).
const SHARK_INITIAL_COUNT = 3
// Initial radius — director recomputes from raft extent each frame.
const SHARK_INITIAL_RADIUS = 12

export function main(): void {
  // 5x5 parcels (80x80m), elevated to y=50. Iteration 03: sharks orbit
  // the platform centroid and periodically attack the most exposed non-base
  // raft.
  createSeabed()
  createWaterFloorV2()
  engine.addSystem(waterScrollSystem)
  createPlatform(GRID_ORIGIN, { gridX: 0, gridZ: 0, isMain: true })
  spawnSharks()
  engine.addSystem(sharkOrbitSystem)
  engine.addSystem(sharkDirectorSystem)
  engine.addSystem(sharkAttackSystem)
  engine.addSystem(createFallRescueSystem(GRID_ORIGIN))
  engine.addSystem(raftBuilderSystem)
  engine.addSystem(inventoryInputSystem)
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
