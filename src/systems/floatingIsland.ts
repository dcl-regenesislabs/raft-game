import { Transform, engine } from '@dcl/sdk/ecs'

import { FloatingIsland } from '../components'
import { GRID_ORIGIN } from '../factories/platform'
import { getAnchorPhase } from './anchorState'

// Margin inside scene bounds before despawning
const SCENE_MARGIN = 3
// Approximate radius of the island collider in world units (scaled)
const ISLAND_RADIUS = 10

// Returns true if the given XZ position is within any floating island's bounds.
export function isOnFloatingIsland(wx: number, wz: number): boolean {
  const rSq = ISLAND_RADIUS * ISLAND_RADIUS
  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    const pos = Transform.get(entity).position
    const dx = wx - pos.x
    const dz = wz - pos.z
    if (dx * dx + dz * dz <= rSq) return true
  }
  return false
}

export function floatingIslandSystem(dt: number): void {
  const anchorPhase = getAnchorPhase()
  // While anchored or interpolating, the anchor system owns island positions.
  // Skip drift and lifetime aging. Bounds checks still run.
  const frozen = anchorPhase !== 'idle'

  const sceneSize = GRID_ORIGIN.x * 2
  const lo = SCENE_MARGIN
  const hi = sceneSize - SCENE_MARGIN
  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    const island = FloatingIsland.getMutable(entity)

    if (!frozen) {
      island.lifetime += dt
      if (island.lifetime >= island.maxLifetime) {
        engine.removeEntity(entity)
        continue
      }
    }

    const pos = Transform.getMutable(entity).position

    if (!frozen) {
      pos.x += island.velocityX * dt
      pos.z += island.velocityZ * dt
    }

    // Despawn if outside scene bounds
    if (pos.x < lo || pos.x > hi || pos.z < lo || pos.z > hi) {
      engine.removeEntity(entity)
    }
  }
}
