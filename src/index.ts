import { engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { createPlatform, createWaterFloor } from './factories'
import { waterScrollSystem } from './systems/waterScroll'
import { setupUi } from './ui'

const PLATFORM_CENTER = Vector3.create(240, 0, 240)

export function main(): void {
  // 30x30 parcels (480x480m). Iteration 01: animated water floor + one platform.
  createWaterFloor()
  engine.addSystem(waterScrollSystem)
  createPlatform(PLATFORM_CENTER)
  setupUi()
}
