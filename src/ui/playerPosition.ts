// Player position snapshot for the save blob. Read directly off the
// well-known PlayerEntity Transform on save; teleport via the restricted
// `movePlayerTo` action on load — directly mutating the PlayerEntity's
// Transform doesn't move the camera in SDK7.

import { Transform, engine } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'

export interface PositionSnapshot {
  x: number
  y: number
  z: number
}

export function serializePlayerPosition(): PositionSnapshot | null {
  const t = Transform.getOrNull(engine.PlayerEntity)
  if (t === null) return null
  return { x: t.position.x, y: t.position.y, z: t.position.z }
}

export function hydratePlayerPosition(snapshot: PositionSnapshot): void {
  void movePlayerTo({
    newRelativePosition: { x: snapshot.x, y: snapshot.y, z: snapshot.z }
  })
}
