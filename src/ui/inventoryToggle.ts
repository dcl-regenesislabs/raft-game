// Inventory open/close toggle button. Mirrors the press-animation shape used
// by `actionButton` so the two HUD buttons feel consistent: a brief scale-up
// on tap that decays with a squared-linear ease. The actual inventory panel
// is rendered elsewhere; this module owns the boolean open-state and the
// per-press animation clock.

import { InputModifier, PointerLock, engine } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import { playSfx } from '../audio/sfx'
import { isFishingLineActive } from '../systems/fishingRod'
import { isCookOpen, setCookOpen } from './cookToggle'
import { isCraftOpen, setCraftOpen } from './craftToggle'
import { isCrafting } from './craftSession'
import { isGameOver } from './gameOver'
import { cancelSelection } from './inventoryDrag'
import {
  closeStorageMenu,
  isStorageActionLocked,
  isStorageOpen
} from './storageToggle'
import { isSystemMenuOpen, setSystemMenuOpen } from './systemSession'

const PRESS_DURATION_S = 0.32
const PRESS_PEAK_BONUS = 0.18
// Brief lockout after closing the inventory: the same click that hits the
// backpack button to close also fires IA_POINTER, which would otherwise be
// read by tool systems as a fresh attack/throw. The lockout swallows item
// actions for a moment so the close-click never doubles as a tool press.
const POST_CLOSE_LOCKOUT_S = 1.0

let open = false
let pressElapsedSec = PRESS_DURATION_S + 1
let postCloseLockoutSec = 0
// Tracks the last open-state we wrote to the player's InputModifier so we
// only mutate the component on transitions instead of every frame.
let lastModifierApplied: boolean | null = null
// Tracks the last "any HUD panel is up" state we wrote to PointerLock so
// we release the cursor exactly once on open and leave the player free
// to re-lock by clicking anywhere when they're done.
let lastPanelOpenApplied: boolean | null = null

export function isInventoryOpen(): boolean {
  return open
}

// True while any HUD panel is up (inventory or craft), within the brief
// post-close lockout window, or a craft is in progress. Tool systems
// should gate item-action triggers on this so menu clicks don't leak
// through to tool actions and players can't fire while a timed task is
// running.
export function isInventoryActionLocked(): boolean {
  return (
    open ||
    postCloseLockoutSec > 0 ||
    isCraftOpen() ||
    isCookOpen() ||
    isStorageActionLocked() ||
    isSystemMenuOpen() ||
    isCrafting() ||
    isGameOver()
  )
}

// Direct setter — used by `craftToggle` to close the inventory when the
// craft panel opens. Does NOT trigger the press pulse: the pulse is the
// "you pressed this button" feedback and should only fire when the user
// actually clicked the inventory button, not when another button closed it.
export function setInventoryOpen(target: boolean): void {
  if (open === target) return
  const wasOpen = open
  open = target
  if (wasOpen && !target) {
    postCloseLockoutSec = POST_CLOSE_LOCKOUT_S
    cancelSelection()
  }
}

export function toggleInventory(): void {
  const next = !open
  setInventoryOpen(next)
  playSfx(next ? 'inventoryOpen' : 'inventoryClose')
  // Press feedback fires here because it represents the user clicking
  // the inventory button — not the state change itself.
  pressElapsedSec = 0
  // Mutually exclusive with craft, cook and storage: opening the
  // inventory closes any of those so only one panel is up at a time.
  if (next && isCraftOpen()) setCraftOpen(false)
  if (next && isCookOpen()) setCookOpen(false)
  if (next && isStorageOpen()) closeStorageMenu()
  if (next && isSystemMenuOpen()) setSystemMenuOpen(false)
}

// Runs every frame: advances the press-pulse clock, and on any change to
// the lock state writes an InputModifier to the player. Movement locks
// when the inventory or craft panel is up OR while a craft / purify
// session is running OR while a fishing line is out (the player needs to
// hold position while waiting for a bite).
export function inventoryToggleResetSystem(dt: number): void {
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
  if (postCloseLockoutSec > 0) {
    postCloseLockoutSec = Math.max(0, postCloseLockoutSec - dt)
  }
  const lock =
    open ||
    isCraftOpen() ||
    isCookOpen() ||
    isStorageOpen() ||
    isSystemMenuOpen() ||
    isCrafting() ||
    isFishingLineActive()
  if (lock !== lastModifierApplied) {
    lastModifierApplied = lock
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({
        disableWalk: lock,
        disableJog: lock,
        // Run, double-jump and gliding are disabled scene-wide; keep
        // them forced on so unlocking the inventory doesn't re-enable any.
        disableRun: true,
        disableJump: lock,
        disableDoubleJump: true,
        disableGliding: true
      })
    })
  }
  // Release the OS mouse cursor when a HUD panel opens so the player can
  // click panel buttons with a visible cursor, and re-lock it when the
  // last panel closes so the player goes straight back into FPS aim
  // without an extra click. Activity locks (in-progress craft / fishing)
  // are intentionally excluded — the player still aims tools in the
  // world during those. Writes only on transitions of the panel-open
  // edge. PointerLock is a desktop concept with no effect on mobile, so
  // skip the writes there entirely.
  if (!isMobile()) {
    const panelOpen =
      open ||
      isCraftOpen() ||
      isCookOpen() ||
      isStorageOpen() ||
      isSystemMenuOpen() ||
      isGameOver()
    if (panelOpen !== lastPanelOpenApplied) {
      PointerLock.createOrReplace(engine.CameraEntity, {
        isPointerLocked: !panelOpen
      })
      lastPanelOpenApplied = panelOpen
    }
  }
}

export function getInventoryButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
