// Owns the scene's "you died" state. When the player's life hits zero the
// survival drain system flips this on; the UI then hides every regular HUD
// element and renders the death overlay (see `components/DeathScreen.tsx`).
// Movement is locked through an InputModifier that's reapplied on the
// transition into / out of the dead state. The Play Again button on the
// overlay calls `playAgain()` to wipe gameplay state back to the fresh-load
// baseline (full stats, default inventory, single starter platform).

import { Entity, InputModifier, engine } from '@dcl/sdk/ecs'

import { MainPlatform, Platform } from '../components'
import { setHeldItem } from '../factories/heldItem'
import { destroyPlatformEntity } from '../factories/platform'
import { clearCookSlots } from './cookSlots'
import { setCookOpen } from './cookToggle'
import { setCraftOpen } from './craftToggle'
import { resetInventoryState } from './inventoryState'
import { setInventoryOpen } from './inventoryToggle'
import { resetInventoryLayout } from './items'
import { resetLearnedRecipes } from './learnedRecipes'
import { setStat } from './statsBars'

// Fade-in durations for the death overlay. The black backdrop ramps up
// first; once it's mostly opaque the centered Panel + button fade in on
// top so the GAME OVER copy doesn't pop in over a still-visible scene.
const FADE_BACKDROP_DURATION_S = 1.5
const FADE_PANEL_DELAY_S = 1.0
const FADE_PANEL_DURATION_S = 0.6

let dead = false
let elapsedSec = 0
let lastModifierApplied: boolean | null = null

export function isGameOver(): boolean {
  return dead
}

// 0 = the moment of death (transparent), 1 = backdrop fully opaque.
export function getGameOverBackdropFade(): number {
  if (!dead) return 0
  return clamp01(elapsedSec / FADE_BACKDROP_DURATION_S)
}

// 0 = panel fully transparent, 1 = panel fully visible. Held at 0 until
// FADE_PANEL_DELAY_S so the player reads the darkening as "the world is
// going dark" before the Game Over copy appears on top.
export function getGameOverPanelFade(): number {
  if (!dead) return 0
  return clamp01((elapsedSec - FADE_PANEL_DELAY_S) / FADE_PANEL_DURATION_S)
}

export function triggerGameOver(): void {
  if (dead) return
  dead = true
  elapsedSec = 0
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// Reset every gameplay store the death-screen flow exposes back to its
// fresh-load baseline. Called from the Play Again button.
export function playAgain(): void {
  destroyNonMainPlatforms()
  resetInventoryLayout()
  resetInventoryState()
  resetLearnedRecipes()
  setStat('life', 1)
  setStat('hunger', 1)
  setStat('thirst', 1)
  setHeldItem('hook')
  setInventoryOpen(false)
  setCraftOpen(false)
  setCookOpen(false)
  // setCookOpen returns slot contents only on open→closed transitions;
  // if the menu was already closed at death-time, the slots may still
  // hold whatever the player had picked, so wipe them explicitly.
  clearCookSlots()
  dead = false
  elapsedSec = 0
}

// System: writes an InputModifier that disables every locomotion verb while
// dead, and clears it on revive. Mirrors the inventory toggle's lock pattern
// so the two locks compose without fighting each other — when both want the
// player frozen the player is frozen, and the last writer for any frame is
// the one whose state matches the mode it intends to apply.
export function gameOverInputLockSystem(dt: number): void {
  if (dead) elapsedSec += dt
  if (dead === lastModifierApplied) return
  lastModifierApplied = dead
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: dead,
      disableJog: dead,
      disableRun: dead,
      disableJump: dead,
      // Double-jump and gliding are disabled scene-wide; keep them
      // forced on so revive doesn't re-enable them.
      disableDoubleJump: true,
      disableGliding: true
    })
  })
}

function destroyNonMainPlatforms(): void {
  // Snapshot the matches before mutating: destroyPlatformEntity removes
  // entities from the engine, which would invalidate the iterator if we
  // looped while deleting.
  const victims: Entity[] = []
  for (const [entity] of engine.getEntitiesWith(Platform)) {
    if (MainPlatform.getOrNull(entity) !== null) continue
    victims.push(entity)
  }
  for (const entity of victims) destroyPlatformEntity(entity)
}
