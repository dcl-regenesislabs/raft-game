import {
  Billboard,
  BillboardMode,
  Entity,
  Material,
  MeshRenderer,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Billboarded sprite of a freshly-caught item, hung on the fishing
// hook so the catch is visible while the line reels back to the
// player. The factory supports multiple sprites per catch (1-2 fish
// from the same cast) by laying them out in a small horizontal
// fan around the hook position.

const CATCH_SIZE_M = 0.6
// Vertical lift above the hook so the catch reads as freshly pulled
// out of the water (~0.5 m above the surface) rather than dangling
// half-submerged.
const CATCH_DROP_Y = 0.2
// Horizontal spread between sibling sprites when more than one fish
// is caught — enough that two fan out without overlapping.
const CATCH_FAN_SPACING = 0.35

export function createFishingCatchSprite(texture: string): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(CATCH_SIZE_M, CATCH_SIZE_M, 1)
  })
  MeshRenderer.setPlane(entity)
  Billboard.create(entity, { billboardMode: BillboardMode.BM_ALL })
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({
      src: texture,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_CLAMP
    }),
    alphaTest: 0.5,
    castShadows: false
  })
  return entity
}

// Mirrors a catch sprite's position to the hook. `index` and `total`
// fan multiple catches horizontally so they don't z-fight on a single
// pixel. World space is used because billboards on a non-uniformly-
// scaled parent render with their normal off-axis (same reason
// cookingSprites lives at world coords).
export function updateFishingCatchSprite(
  entity: Entity,
  anchor: Vector3,
  index: number,
  total: number
): void {
  const t = Transform.getMutable(entity)
  // Center the fan so it stays balanced on the hook regardless of count.
  const offsetX =
    total <= 1 ? 0 : (index - (total - 1) / 2) * CATCH_FAN_SPACING
  t.position = Vector3.create(
    anchor.x + offsetX,
    anchor.y + CATCH_DROP_Y,
    anchor.z
  )
}

export function destroyFishingCatchSprite(entity: Entity): void {
  engine.removeEntity(entity)
}
