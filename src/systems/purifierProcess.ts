import { Entity, engine } from '@dcl/sdk/ecs'

import { PlatformConstruction, PurifierState } from '../components'
import { playSfx } from '../audio/sfx'
import { setPurifierHoverPrompt } from '../factories/construction'
import { createFlameSprite } from '../factories/cookingSprites'

const PROMPT_ADD_SALT = 'Add salt water'

// Tracks the last hover signature written to each purifier child so the
// system only re-emits PointerEvents on actual transitions. Keyed by
// the construction-child entity ID since PointerEvents lives there,
// not on the platform. Signature includes both the primary text and
// whether the fuel ("Add wood") entry is currently shown, so flipping
// either re-emits.
const lastPromptByChild = new Map<Entity, string>()

function pickPrimaryPrompt(freshAmount: number): string {
  if (freshAmount > 0) {
    const pct = Math.round(freshAmount * 100)
    return `Drink purified water ${pct}%`
  }
  return PROMPT_ADD_SALT
}

function syncPurifierPrompt(
  child: Entity,
  primaryText: string,
  showFuel: boolean
): void {
  const sig = `${primaryText}|${showFuel ? '1' : '0'}`
  if (lastPromptByChild.get(child) === sig) return
  lastPromptByChild.set(child, sig)
  setPurifierHoverPrompt(child, primaryText, showFuel)
}

// Seconds of fire required to drain a 100%-full salt bowl into a
// 100%-full fresh bowl. By design 2 salt-cup pours + half a wood log
// (FUEL_PER_WOOD_SEC = 30) net out to exactly 1 fresh-water cup, so
// these two constants must stay in lockstep — change one without the
// other and the recipe falls out of balance.
const SECONDS_TO_FULL_PURIFY = 15
export const FUEL_PER_WOOD_SEC = 30
// One log at a time — no stacking. The purifier rejects further wood
// while `fireSec > 0`, so this cap exists only as a defensive ceiling
// (a single FUEL_PER_WOOD_SEC pour can never exceed it).
export const MAX_FIRE_SEC = FUEL_PER_WOOD_SEC

const CONVERSION_RATE_PER_SEC = 1 / SECONDS_TO_FULL_PURIFY

// Drives the per-purifier place-and-wait loop:
//   - While `fireSec > 0`, drain it by dt, animate the flame sprite,
//     and transfer salt → fresh at CONVERSION_RATE_PER_SEC (clamped so
//     neither side overshoots 0 / 1).
//   - When `fireSec` runs out, destroy the flame sprite and zero the
//     ref so `addFuelToPurifier` can respawn it on the next F-press.
// Input (pour / collect / add wood) is handled in
// `constructionInteract`; this system is the passive simulation.

export function purifierProcessSystem(dt: number): void {
  for (const [platform, , pc] of engine.getEntitiesWith(
    PurifierState,
    PlatformConstruction
  )) {
    const state = PurifierState.getMutable(platform)
    if (state.fireSec > 0) {
      state.fireSec = Math.max(0, state.fireSec - dt)

      // Convert salt → fresh while there's salt to draw from AND the
      // output bowl isn't already full. The min() pair clamps the
      // delta so we never overshoot 0 on the input or 1 on the output
      // even when dt spikes.
      if (state.saltAmount > 0 && state.freshAmount < 1) {
        const want = CONVERSION_RATE_PER_SEC * dt
        const delta = Math.min(want, state.saltAmount, 1 - state.freshAmount)
        state.saltAmount -= delta
        state.freshAmount += delta
      }

      // Tear the flame down the frame fuel runs out so the visual
      // matches the simulation. The sprite is a top-level entity, not
      // a Transform child of the construction, so this cleanup is
      // mandatory — SDK7 won't cascade-remove it.
      if (state.fireSec <= 0 && state.flameSprite !== engine.RootEntity) {
        engine.removeEntity(state.flameSprite)
        state.flameSprite = engine.RootEntity
      }
    } else if (state.flameSprite !== engine.RootEntity) {
      // Defensive: if the flame sprite ref survived an external state
      // mutation, make sure it's torn down.
      engine.removeEntity(state.flameSprite)
      state.flameSprite = engine.RootEntity
    }

    // Refresh the hover text so the player always sees the correct
    // verb for the current bowl state. The "Add wood" entry is hidden
    // while the fire is burning (no log stacking — one at a time).
    // `syncPurifierPrompt` no-ops when nothing changed.
    syncPurifierPrompt(
      pc.child,
      pickPrimaryPrompt(state.freshAmount),
      state.fireSec <= 0
    )
  }
}

// Adds one log's worth of fire time to the given purifier and lights
// the flame sprite if it isn't already burning. Called from
// `constructionInteract` on F-press; returns false if the purifier is
// already at MAX_FIRE_SEC (so the caller can skip consuming the wood).
// Local-frame nudge that lifts the purifier flame above the firebox
// opening and shifts it a hair to the right of the salt bowl. Tuned
// against the GLB; tweak these two numbers to reposition.
const PURIFIER_FLAME_OFFSET = { right: 0.1, up: 0.1 } as const

export function addFuelToPurifier(platform: Entity): boolean {
  const state = PurifierState.getMutableOrNull(platform)
  if (state === null) return false
  // No stacking — once the fire is lit you wait for it to burn out
  // before adding another log. The hover prompt for "Add wood" also
  // hides while fireSec > 0, so this guard is the defensive backstop
  // for the one-frame window before the prompt update lands.
  if (state.fireSec > 0) return false
  state.fireSec = Math.min(MAX_FIRE_SEC, state.fireSec + FUEL_PER_WOOD_SEC)
  playSfx('fireIgnite')
  if (state.flameSprite === engine.RootEntity) {
    const pc = PlatformConstruction.getOrNull(platform)
    const yaw = pc !== null ? pc.yawDeg : 0
    state.flameSprite = createFlameSprite(platform, yaw, PURIFIER_FLAME_OFFSET)
  }
  return true
}
