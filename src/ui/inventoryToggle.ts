// Inventory open/close toggle button. Mirrors the press-animation shape used
// by `actionButton` so the two HUD buttons feel consistent: a brief scale-up
// on tap that decays with a squared-linear ease. The actual inventory panel
// is rendered elsewhere; this module owns the boolean open-state and the
// per-press animation clock.

import { InputModifier, engine } from '@dcl/sdk/ecs'

import { isCraftOpen, setCraftOpen } from './craftToggle'
import { isCrafting } from './craftSession'
import { cancelSelection } from './inventoryDrag'
import { isPurifying } from './purifySession'

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

export function isInventoryOpen(): boolean {
  return open
}

// True while any HUD panel is up (inventory or craft), within the brief
// post-close lockout window, or a craft / purify is in progress. Tool
// systems should gate item-action triggers on this so menu clicks
// don't leak through to tool actions and players can't fire while a
// timed task is running.
export function isInventoryActionLocked(): boolean {
  return (
    open ||
    postCloseLockoutSec > 0 ||
    isCraftOpen() ||
    isCrafting() ||
    isPurifying()
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
  // Press feedback fires here because it represents the user clicking
  // the inventory button — not the state change itself.
  pressElapsedSec = 0
  // Mutually exclusive with craft: opening the inventory closes the craft
  // panel so only one panel is up at a time.
  if (next && isCraftOpen()) setCraftOpen(false)
}

// Runs every frame: advances the press-pulse clock, and on any change to
// the lock state writes an InputModifier to the player. Movement locks
// when the inventory is up OR while a craft session is running.
export function inventoryToggleResetSystem(dt: number): void {
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
  if (postCloseLockoutSec > 0) {
    postCloseLockoutSec = Math.max(0, postCloseLockoutSec - dt)
  }
  const lock = open || isCrafting() || isPurifying()
  if (lock === lastModifierApplied) return
  lastModifierApplied = lock
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: lock,
      disableJog: lock,
      disableRun: lock,
      disableJump: lock,
      disableDoubleJump: lock,
      disableGliding: lock
    })
  })
}

export function getInventoryButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
