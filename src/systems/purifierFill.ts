import { Entity, Transform, VisibilityComponent, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PlatformConstruction, PurifierState } from '../components'
import { getPurifierBowlGeometry } from '../factories/construction'

// Mirrors `PurifierState.{salt,fresh}Amount` onto the two translucent
// cylinders inside each purifier so the bowls visually rise and fall as
// the player pours / processes / collects water. Pure consumer of the
// state component — does not write `salt/freshAmount`, only the
// cylinders' Transform.scale.y + position.y to match.

export function purifierFillSystem(_dt: number): void {
  for (const [, state] of engine.getEntitiesWith(
    PurifierState,
    PlatformConstruction
  )) {
    writeFillTransform(state.saltCylinder, 'salt', state.saltAmount)
    writeFillTransform(state.freshCylinder, 'fresh', state.freshAmount)
  }
}

// Converts a 0..1 fill level into Transform.scale.y and Transform.position.y
// so the cylinder "rises" from the bowl floor toward the rim. The cylinder
// mesh is centred at its origin and 1m tall at scale=1, so we anchor the
// centre at `floorY + heightLocal/2` and stretch local-Y to `heightLocal`
// (the construction child + platform scales share a uniform 0.72m world
// multiplier, so local mesh units pass straight through to scale).
function writeFillTransform(
  cylinder: Entity,
  which: 'salt' | 'fresh',
  fill: number
): void {
  const geom = getPurifierBowlGeometry(which)
  const maxHeightLocal = geom.rimY - geom.floorY
  const heightLocal = maxHeightLocal * Math.max(0, Math.min(1, fill))
  const centerLocalY = geom.floorY + heightLocal / 2
  const t = Transform.getMutableOrNull(cylinder)
  if (t === null) return
  const prev = t.position
  const prevScale = t.scale
  t.position = Vector3.create(prev.x, centerLocalY, prev.z)
  t.scale = Vector3.create(prevScale.x, heightLocal, prevScale.z)
  // Hide the cylinder entirely when empty. A zero-height cylinder still
  // shows its caps as a thin disc at the bowl floor; toggling
  // VisibilityComponent kills that artifact and skips the draw call.
  setVisible(cylinder, fill > 0)
}

function setVisible(entity: Entity, visible: boolean): void {
  const cur = VisibilityComponent.getMutableOrNull(entity)
  if (cur === null) {
    VisibilityComponent.create(entity, { visible })
    return
  }
  if (cur.visible === visible) return
  cur.visible = visible
}
