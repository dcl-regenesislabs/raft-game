import { Transform, engine } from '@dcl/sdk/ecs'

import {
  ActiveCook,
  CookStatus,
  PlatformConstruction
} from '../components'
import {
  FOOD_BOB_AMP,
  FOOD_BOB_HZ,
  createPlateSprite,
  getFoodRestY,
  getRecipeOutputTexture,
  setSpriteTexture
} from '../factories/cookingSprites'

// Place-and-wait cook timeline. Iterates every grill platform that has
// an `ActiveCook` component and:
//   - advances the elapsed-time accumulator
//   - applies a tiny per-sprite Y bob so the food has a "nice effect"
//   - transitions the visuals at the 60s and 120s thresholds:
//       Cooking → Ready  (60s):  ingredient sprites are despawned and
//                                replaced by a single plate sprite.
//       Ready   → Burned (120s): plate texture swaps to coal and the
//                                flame sprite is despawned.
// Pickup (player click) is handled elsewhere — see `cookGrab.ts`.

const COOK_READY_SEC = 60
const COOK_BURN_SEC = 120

const COAL_TEXTURE = 'images/cooking/coal.png'

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
    }

    if (state.status === CookStatus.Cooking && state.elapsedSec >= COOK_READY_SEC) {
      transitionToReady(platform, state)
      continue
    }
    if (state.status === CookStatus.Ready && state.elapsedSec >= COOK_BURN_SEC) {
      transitionToBurned(state)
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
  const plate = createPlateSprite(
    platform,
    construction.yawDeg,
    getRecipeOutputTexture(state.recipeId)
  )
  state.foodSprites = [plate]
  state.status = CookStatus.Ready
}

// Ready → Burned. Swaps the plate texture to coal and turns the flame
// off — the cook session is done.
function transitionToBurned(
  state: ReturnType<typeof ActiveCook.getMutable>
): void {
  const plate = state.foodSprites[0]
  if (plate !== undefined) setSpriteTexture(plate, COAL_TEXTURE)
  if (state.fireSprite !== engine.RootEntity) {
    engine.removeEntity(state.fireSprite)
    state.fireSprite = engine.RootEntity
  }
  state.status = CookStatus.Burned
}
