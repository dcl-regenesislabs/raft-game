import {
  Billboard,
  BillboardMode,
  Entity,
  Material,
  MeshRenderer,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Billboarded "fish biting!" sprite that hovers over the floating
// fishing line during the FishingPhase.Biting reaction window.
// Driven by `fishingRodSystem`, which mirrors the line position each
// frame, pulses the scale on the bite-intensity sine, and blinks the
// VisibilityComponent so the sprite reads as urgent rather than static.

const WARNING_TEXTURE = 'images/scene/warning_fish_icon.png'
const WARNING_BASE_SIZE_M = 1.35
const WARNING_HOVER_OFFSET_Y = 1.4

export function createFishingWarningSprite(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(WARNING_BASE_SIZE_M, WARNING_BASE_SIZE_M, 1)
  })
  MeshRenderer.setPlane(entity)
  Billboard.create(entity, { billboardMode: BillboardMode.BM_ALL })
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({
      src: WARNING_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_CLAMP
    }),
    alphaTest: 0.5,
    castShadows: false
  })
  VisibilityComponent.create(entity, { visible: false })
  return entity
}

// Anchors the sprite a fixed offset above a target world position
// (typically the floating-hook position) and pulses its scale on a
// 0..1 intensity. `intensity` is the same sine-derived value the
// action button uses, so the in-world cue and the HUD button visibly
// pulse in lockstep.
export function updateFishingWarningSprite(
  entity: Entity,
  anchor: Vector3,
  intensity: number
): void {
  const t = Transform.getMutable(entity)
  t.position = Vector3.create(
    anchor.x,
    anchor.y + WARNING_HOVER_OFFSET_Y,
    anchor.z
  )
  const scale = WARNING_BASE_SIZE_M * (1 + 0.3 * intensity)
  t.scale = Vector3.create(scale, scale, 1)
}

export function setFishingWarningVisible(entity: Entity, visible: boolean): void {
  const cur = VisibilityComponent.getOrNull(entity)
  if (cur === null) {
    VisibilityComponent.create(entity, { visible })
    return
  }
  if (cur.visible === visible) return
  VisibilityComponent.getMutable(entity).visible = visible
}

export function destroyFishingWarningSprite(entity: Entity): void {
  engine.removeEntity(entity)
}
