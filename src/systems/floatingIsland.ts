import { Transform, engine } from '@dcl/sdk/ecs'

import { FloatingIsland } from '../components'
import { deactivateFloatingIsland } from '../factories/floatingIsland'
import { getAnchorPhase } from './anchorState'

// Approximate radius of the island collider in world units (scaled).
// Used by callers asking "is this XZ on top of an island?".
const ISLAND_RADIUS = 10

// Returns true if the given XZ position is within any *active* floating
// island's bounds. The pooled island slot is always present but inactive
// while hidden — callers must not see the stash as solid ground.
export function isOnFloatingIsland(wx: number, wz: number): boolean {
  const rSq = ISLAND_RADIUS * ISLAND_RADIUS
  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    if (!FloatingIsland.get(entity).active) continue
    const pos = Transform.get(entity).position
    const dx = wx - pos.x
    const dz = wz - pos.z
    if (dx * dx + dz * dz <= rSq) return true
  }
  return false
}

export function floatingIslandSystem(dt: number): void {
  const anchorPhase = getAnchorPhase()
  // While anchored or interpolating, the anchor system owns island
  // positions. Skip drift and lifetime aging.
  const frozen = anchorPhase !== 'idle'

  for (const [entity] of engine.getEntitiesWith(FloatingIsland, Transform)) {
    const island = FloatingIsland.getMutable(entity)
    if (!island.active) continue

    if (frozen) continue

    island.lifetime += dt
    if (island.lifetime >= island.maxLifetime) {
      deactivateFloatingIsland()
      continue
    }

    const pos = Transform.getMutable(entity).position
    pos.x += island.velocityX * dt
    pos.z += island.velocityZ * dt
  }
}
