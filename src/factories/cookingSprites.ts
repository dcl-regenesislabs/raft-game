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
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { GrillFire } from '../components'
import { getCookableById, type CookableItem } from '../ui/cookableItems'
import { getItem, getMaterialDef } from '../ui/items'

// Sprites for the place-and-wait cook flow on a grill. Spawned by
// `cookSession.startCook` when the player confirms a recipe; cleaned up
// by `cookGrab.grabCookOutput` (player picks up the dish) or
// `destroyPlatformEntity` (raft is bitten / hammered). All sprites are
// TOP-LEVEL entities, NOT Transform children of the grill GLB —
// billboards under non-uniformly-scaled parents render with their
// plane normal pointing up at the sky, so we live at world coords.

// Animated flame sheet (4×3, 11 frames + 1 empty cell).
const GRILL_FIRE_TEXTURE = 'images/scene/fire_sprite.png'
const GRILL_FIRE_WORLD_W = 0.28
const GRILL_FIRE_WORLD_H = 0.4
// World-Y above the grill platform's origin (which sits at platform
// centre Y) — lands the flame just above the cooking surface.
const GRILL_FIRE_WORLD_Y_OFFSET = 0.35
// Push the flame a hair forward along the grill's facing direction so
// it sits over the cook plate, not the back of the GLB.
const GRILL_FIRE_FORWARD_OFFSET = 0.05

// Food sprites sit above the flame so the player can read what's
// cooking from any horizontal angle.
const FOOD_Y_OFFSET = 0.62
// Plate (cooked recipe) and coal share this size — they're the same
// "single object on the grill" beat, just different textures.
const PLATE_SIZE_M = 0.4
// Each ingredient sprite is smaller so 4 of them fit in a tidy 2×2
// micro-grid above the flame.
const ING_SIZE_M = 0.18
const ING_GRID_SPACING = 0.13

// Local-space offsets (right axis, forward axis, both in metres) used
// to lay out ingredient sprites in a 2×2 micro-grid. Picked per
// ingredient count so 1/2/3/4 ingredients all read tidy. The values
// are pre-rotated by the grill's yaw at spawn time so the layout
// stays grill-aligned.
const ING_LAYOUTS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[0, 0]],
  2: [[-ING_GRID_SPACING, 0], [ING_GRID_SPACING, 0]],
  3: [
    [-ING_GRID_SPACING, -ING_GRID_SPACING],
    [ING_GRID_SPACING, -ING_GRID_SPACING],
    [0, ING_GRID_SPACING]
  ],
  4: [
    [-ING_GRID_SPACING, -ING_GRID_SPACING],
    [ING_GRID_SPACING, -ING_GRID_SPACING],
    [-ING_GRID_SPACING, ING_GRID_SPACING],
    [ING_GRID_SPACING, ING_GRID_SPACING]
  ]
}

// Y-axis bob applied per-frame by `grillCookSystem`. Constants exported
// so the system can read them without duplicating tuning values.
export const FOOD_BOB_AMP = 0.03
export const FOOD_BOB_HZ = 1.0

// Returns the food sprite's resting world Y for a given grill platform.
// `grillCookSystem` adds a sin-wave bob on top of this each frame.
export function getFoodRestY(platform: Entity): number {
  return Transform.get(platform).position.y + FOOD_Y_OFFSET
}

// Billboarded animated flame plane. Driven by `grillFireSystem` which
// re-emits the UV window each frame so the cell advances through the
// spritesheet.
export function createFlameSprite(platform: Entity, yawDeg: number): Entity {
  const platformPos = Transform.get(platform).position
  const yawRad = (yawDeg * Math.PI) / 180
  const forwardX = Math.sin(yawRad) * GRILL_FIRE_FORWARD_OFFSET
  const forwardZ = Math.cos(yawRad) * GRILL_FIRE_FORWARD_OFFSET
  const sprite = engine.addEntity()
  Transform.create(sprite, {
    position: Vector3.create(
      platformPos.x + forwardX,
      platformPos.y + GRILL_FIRE_WORLD_Y_OFFSET,
      platformPos.z + forwardZ
    ),
    scale: Vector3.create(GRILL_FIRE_WORLD_W, GRILL_FIRE_WORLD_H, GRILL_FIRE_WORLD_W)
  })
  Billboard.create(sprite, { billboardMode: BillboardMode.BM_Y })
  Material.setBasicMaterial(sprite, {
    texture: Material.Texture.Common({
      src: GRILL_FIRE_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_CLAMP
    }),
    alphaTest: 0.5,
    castShadows: false
  })
  GrillFire.create(sprite, {
    frameTimer: 0,
    currentFrame: Math.floor(Math.random() * 11)
  })
  return sprite
}

// Spawns the per-ingredient sprites laid flat above the grill flame.
// Returns the array of created entities (1–4 of them, one per unique
// ingredient). The grill yaw rotates the micro-grid so it stays aligned
// with the cooking surface no matter which way the grill is facing.
export function createIngredientSprites(
  platform: Entity,
  yawDeg: number,
  recipe: CookableItem
): Entity[] {
  const platformPos = Transform.get(platform).position
  const layout = ING_LAYOUTS[recipe.ingredients.length] ?? ING_LAYOUTS[4]
  const yawRad = (yawDeg * Math.PI) / 180
  const cosY = Math.cos(yawRad)
  const sinY = Math.sin(yawRad)
  const sprites: Entity[] = []
  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ing = recipe.ingredients[i]
    // Ingredients land in the inventory as collectibles, so they're
    // looked up via getItem; the `wood` fuel comes from the material
    // catalog instead. Either branch returns the texture path.
    const def = getItem(ing.itemId) ?? getMaterialDef(ing.itemId)
    if (def === undefined || def === null) continue
    const [lx, lz] = layout[i] ?? [0, 0]
    // 2D yaw rotation around Y (CCW when looking down). Matches the
    // forward/right basis used elsewhere in the scene.
    const dx = lx * cosY + lz * sinY
    const dz = -lx * sinY + lz * cosY
    sprites.push(
      spawnFlatSprite(
        Vector3.create(platformPos.x + dx, platformPos.y + FOOD_Y_OFFSET, platformPos.z + dz),
        yawDeg,
        def.texture,
        ING_SIZE_M
      )
    )
  }
  return sprites
}

// Single flat plate / coal sprite at the centre of the grill.
export function createPlateSprite(
  platform: Entity,
  yawDeg: number,
  texture: string
): Entity {
  const platformPos = Transform.get(platform).position
  return spawnFlatSprite(
    Vector3.create(platformPos.x, platformPos.y + FOOD_Y_OFFSET, platformPos.z),
    yawDeg,
    texture,
    PLATE_SIZE_M
  )
}

// Replaces the basic material on an existing flat sprite — used to
// swap the plate texture to coal at the burn transition without
// rebuilding the entity.
export function setSpriteTexture(entity: Entity, texture: string): void {
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({ src: texture }),
    alphaTest: 0.5,
    castShadows: false
  })
}

// Looks up the cooked-recipe output texture for the plate sprite.
// Falls back to the recipe's own texture (always present on
// CookableItem) so a missing item-registry entry doesn't crash the
// cook transition.
export function getRecipeOutputTexture(recipeId: string): string {
  const recipe = getCookableById(recipeId)
  return recipe?.texture ?? ''
}

// --- internals ---

function spawnFlatSprite(
  position: Vector3,
  yawDeg: number,
  texture: string,
  sizeM: number
): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position,
    // Lay the plane flat with its normal pointing +Y, then yaw to keep
    // the texture's "up" aligned with the grill's facing direction.
    rotation: Quaternion.multiply(
      Quaternion.fromEulerDegrees(0, yawDeg, 0),
      Quaternion.fromEulerDegrees(-90, 0, 0)
    ),
    // Plane's local axes are X/Y (Z is its normal direction); after the
    // -90° X rotation, the world-Y dimension is the plane's local Y,
    // which is now flat on the ground plane along world-Z. Both
    // in-plane dimensions take `sizeM`; the Y here is unused but kept
    // at 1 for sanity.
    scale: Vector3.create(sizeM, sizeM, 1)
  })
  MeshRenderer.setPlane(entity)
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({ src: texture }),
    alphaTest: 0.5,
    castShadows: false
  })
  return entity
}

