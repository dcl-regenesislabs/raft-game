// Inventory open/close toggle button. Mirrors the press-animation shape used
// by `actionButton` so the two HUD buttons feel consistent: a brief scale-up
// on tap that decays with a squared-linear ease. The actual inventory panel
// is rendered elsewhere; this module owns the boolean open-state and the
// per-press animation clock.

import { InputModifier, engine } from '@dcl/sdk/ecs'

import { cancelSelection } from './inventoryDrag'

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

// True while the inventory is open OR within the brief post-close lockout
// window. Tool systems should gate item-action triggers on this, not on
// `isInventoryOpen` alone, so the closing click doesn't leak through.
export function isInventoryActionLocked(): boolean {
  return open || postCloseLockoutSec > 0
}

export function toggleInventory(): void {
  const wasOpen = open
  open = !open
  pressElapsedSec = 0
  if (wasOpen && !open) {
    postCloseLockoutSec = POST_CLOSE_LOCKOUT_S
    // Drop any in-flight selection — the player can't see the panel anymore.
    cancelSelection()
  }
}

// Runs every frame: advances the press-pulse clock, and on any change to
// the open-state writes an InputModifier to the player so movement is
// locked while the inventory is up.
export function inventoryToggleResetSystem(dt: number): void {
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
  if (postCloseLockoutSec > 0) {
    postCloseLockoutSec = Math.max(0, postCloseLockoutSec - dt)
  }
  if (open === lastModifierApplied) return
  lastModifierApplied = open
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableWalk: open,
      disableJog: open,
      disableRun: open,
      disableJump: open,
      disableDoubleJump: open,
      disableGliding: open
    })
  })
}

export function getInventoryButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
