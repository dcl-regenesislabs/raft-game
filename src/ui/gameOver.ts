import { hydratePlayerPosition } from './playerPosition'
import { GRID_ORIGIN } from '../factories/platform'
import { FloatingGarbage } from '../components'
import { destroyFloatingGarbage } from '../factories/floatingGarbage'
import { resetProgress, campaignMode, CampaignMode, metric } from '../progression/state'
import { clearCheckpoint, restoreCheckpoint } from '../progression/checkpoint'
import { DEBUG_MODE } from '../config/gameConfig'
import { resetGarbageSpawner } from '../systems/garbageSpawner'
import { cancelSharkAttacks } from '../systems/sharkDirector'
import { resetEventScheduler } from '../systems/eventScheduler'
import { resetHookThrowerState } from '../systems/hookThrower'
import { resetFishingRodState } from '../systems/fishingRod'
import { resetRaftBuilderState } from '../systems/raftBuilder'
import { resetConstructionPlacementState } from '../systems/constructionPlacement'
import { resetAnchorThrowerState } from '../systems/anchorThrower'
import { resetAnchorState } from '../systems/anchorState'
import { closeStorageMenu } from './storageToggle'
import { setSystemMenuOpen } from './systemSession'
import { protectPanelDismissal } from './inventoryToggle'
import { resetExpansion } from '../expansion/runtime'
import { applyConfiguredGameMode } from '../runtime/sceneFlow'
import { restartTutorial } from './tutorialState'
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
import { resetPlayTimer, startPlayTimer } from '../systems/playTimer'
import { resetWinState } from './winScreen'
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
  metric('deaths')
  dead = true
  elapsedSec = 0
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// Reset every gameplay store the death-screen flow exposes back to its
// fresh-load baseline. Called from the Play Again button.
function clearTransientActions(): void {
  setInventoryOpen(false)
  setCraftOpen(false)
  setCookOpen(false)
  closeStorageMenu()
  setSystemMenuOpen(false)
  clearCookSlots()
  resetHookThrowerState()
  resetFishingRodState()
  resetRaftBuilderState()
  resetConstructionPlacementState()
  resetAnchorThrowerState()
  resetAnchorState()
  cancelSharkAttacks()
  resetExpansion()
  resetWinState()
  protectPanelDismissal()
}
export function retryChapter(): void {
  clearTransientActions()
  if (!restoreCheckpoint()) { playAgain(); return }
  metric('retries')
  dead = false
  elapsedSec = 0
}
export function startTestMode(mode: CampaignMode): void {
  if (!DEBUG_MODE) return
  resetProgress(mode)
  playAgain()
}
export function playAgain(): void {
  clearTransientActions()
  resetProgress(campaignMode())
  clearCheckpoint()
  resetEventScheduler()
  resetGarbageSpawner()
  for (const [entity] of [...engine.getEntitiesWith(FloatingGarbage)]) destroyFloatingGarbage(entity)
  restartTutorial()
  destroyNonMainPlatforms()
  resetInventoryLayout()
  resetInventoryState()
  resetLearnedRecipes()
  resetPlayTimer()
  startPlayTimer()
  resetExpansion()
  resetWinState()
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
  applyConfiguredGameMode()
  hydratePlayerPosition({ x: GRID_ORIGIN.x, y: GRID_ORIGIN.y + 1, z: GRID_ORIGIN.z })
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
      // Run, double-jump and gliding are disabled scene-wide; keep
      // them forced on so revive doesn't re-enable any of them.
      disableRun: true,
      disableJump: dead,
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
