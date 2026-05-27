import { GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion } from '@dcl/sdk/math'

import {
  ActiveCook,
  CookStatus,
  PlatformConstruction
} from '../components'
import { playSfx } from '../audio/sfx'
import {
  GRILL_HOVER_BURNED,
  GRILL_HOVER_PICKUP,
  setConstructionPointerPrompt
} from '../factories/construction'
import {
  FOOD_BOB_AMP,
  FOOD_BOB_HZ,
  createPlateGlb,
  createPlateSprite,
  getFoodRestY,
  getRecipeOutputGlb,
  getRecipeOutputTexture,
  setSpriteTexture
} from '../factories/cookingSprites'

// Place-and-wait cook timeline. Iterates every grill platform that has
// an `ActiveCook` component and:
//   - advances the elapsed-time accumulator
//   - applies a tiny per-sprite Y bob so the food has a "nice effect"
//   - transitions the visuals at the 15s and 75s thresholds:
//       Cooking → Ready  (15s):  ingredient sprites are despawned and
//                                replaced by a single plate sprite.
//       Ready   → Burned (75s):  plate texture swaps to coal and the
//                                flame sprite is despawned (60 s of
//                                ready-window before the burn fires).
// Pickup (player click) is handled elsewhere — see `cookGrab.ts`.

const COOK_READY_SEC = 15
const COOK_BURN_SEC = COOK_READY_SEC + 60

const COAL_TEXTURE = 'images/cooking/coal.png'

// Spin rate for GLB hero plates above the grill, in degrees per second.
// 30°/s = one full revolution every 12 s — slow enough to read as a
// showcase turntable, not a spinner.
const GLB_PLATE_SPIN_DPS = 30

export function grillCookSystem(dt: number): void {
  for (const [platform] of engine.getEntitiesWith(ActiveCook)) {
    const state = ActiveCook.getMutable(platform)
    state.elapsedSec += dt

    // Bob Y of every active food sprite. Reading the platform's Y once
    // per iteration is cheap and lets sprites follow vertical drift on
    // the platform if any later system introduces it.
    const restY = getFoodRestY(platform)
    const phase = state.bobPhase + state.elapsedSec * FOOD_BOB_HZ * 2 * Math.PI
    for (let i = 0; i < state.foodSprites.length; i++) {
      const sprite = state.foodSprites[i]
      const t = Transform.getMutableOrNull(sprite)
      if (t === null) continue
      // Per-sprite phase shift gives the 2×2 ingredient grid a tiny
      // shimmer instead of moving in lockstep.
      t.position = {
        x: t.position.x,
        y: restY + Math.sin(phase + i * 0.7) * FOOD_BOB_AMP,
        z: t.position.z
      }
      // Hero plates (tier-4 GLBs) get a slow Y-axis spin so the 3D model
      // reads from every angle. Detected by GltfContainer presence — flat
      // sprite plates keep their fixed yaw.
      if (GltfContainer.getOrNull(sprite) !== null) {
        t.rotation = Quaternion.fromEulerDegrees(0, (state.elapsedSec * GLB_PLATE_SPIN_DPS) % 360, 0)
      }
    }

    if (state.status === CookStatus.Cooking && state.elapsedSec >= COOK_READY_SEC) {
      transitionToReady(platform, state)
      continue
    }
    if (state.status === CookStatus.Ready && state.elapsedSec >= COOK_BURN_SEC) {
      transitionToBurned(platform, state)
      continue
    }
  }
}

// Cooking → Ready. Despawns every ingredient sprite, spawns a single
// plate sprite at the centre of the grill, and rewrites foodSprites to
// hold just that plate.
function transitionToReady(
  platform: ReturnType<typeof engine.addEntity>,
  state: ReturnType<typeof ActiveCook.getMutable>
): void {
  const construction = PlatformConstruction.getOrNull(platform)
  // Without the construction component we can't recover the yaw — leave
  // the ingredients up rather than risk a misaligned plate. Edge case:
  // construction was destroyed but ActiveCook somehow lingers; the next
  // tick of `destroyPlatformEntity` should sweep both.
  if (construction === null) return
  for (const e of state.foodSprites) engine.removeEntity(e)
  // Tier-4 plates ship a GLB — spawn that instead of a flat sprite when
  // the recipe defines one. Other recipes fall back to the textured plane.
  const glb = getRecipeOutputGlb(state.recipeId)
  const plate = glb !== null
    ? createPlateGlb(platform, construction.yawDeg, glb)
    : createPlateSprite(platform, construction.yawDeg, getRecipeOutputTexture(state.recipeId))
  state.foodSprites = [plate]
  state.status = CookStatus.Ready
  playSfx('cookReady')
  // Re-enable taps with a "PICK UP" prompt — the cook session was
  // muted while ingredients were on the fire (see `cookSession.startCook`).
  setConstructionPointerPrompt(construction.child, GRILL_HOVER_PICKUP)
}

// Ready → Burned. Swaps the plate texture to coal and turns the flame
// off — the cook session is done.
function transitionToBurned(
  platform: ReturnType<typeof engine.addEntity>,
  state: ReturnType<typeof ActiveCook.getMutable>
): void {
  const construction = PlatformConstruction.getOrNull(platform)
  const plate = state.foodSprites[0]
  if (plate !== undefined) {
    // GLB plates can't have their material rewritten to coal, so swap
    // the whole entity to a flat coal sprite at the same spot. Plain
    // sprite plates just get a texture swap in place.
    const isGlb = getRecipeOutputGlb(state.recipeId) !== null
    if (isGlb && construction !== null) {
      engine.removeEntity(plate)
      state.foodSprites = [createPlateSprite(platform, construction.yawDeg, COAL_TEXTURE)]
    } else {
      setSpriteTexture(plate, COAL_TEXTURE)
    }
  }
  if (state.fireSprite !== engine.RootEntity) {
    engine.removeEntity(state.fireSprite)
    state.fireSprite = engine.RootEntity
  }
  state.status = CookStatus.Burned
  playSfx('cookBurned')
  // Swap the hover prompt to "GRAB COAL" so the player knows the cook
  // tipped over into ruined.
  if (construction !== null) {
    setConstructionPointerPrompt(construction.child, GRILL_HOVER_BURNED)
  }
}
