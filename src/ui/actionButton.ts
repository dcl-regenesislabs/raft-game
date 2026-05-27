// Mobile action button state. The on-screen circular button on the right of
// the HUD drives a virtual pointer that the tool systems (hook/spear/hammer)
// read in place of the real `IA_POINTER` press on mobile. Edge flags are
// cleared at the end of each frame by `actionButtonResetSystem`, registered
// last in `index.ts` so every reader sees the edge during its own tick.

import { ActiveCook, CookStatus } from '../components'
import { isFishingLineActive } from '../systems/fishingRod'
import { getLookAtGrillPlatform, getLookAtTarget } from '../systems/lookAtTarget'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { getSelectedSlot, getSlotHasAction } from './inventoryState'

let pressed = false
let edgePressed = false
let edgeReleased = false

// Press feedback: scale up by a small amount on press, then ease back to
// 1.0 with a squared-linear decay — same shape the inventory slots use
// when they're tapped, so the two animations feel consistent.
const PRESS_DURATION_S = 0.32
const PRESS_PEAK_BONUS = 0.18
let pressElapsedSec = PRESS_DURATION_S + 1 // start idle (no animation in flight)

export function pressActionButton(): void {
  if (pressed) return
  pressed = true
  edgePressed = true
  pressElapsedSec = 0
}

export function releaseActionButton(): void {
  if (!pressed) return
  pressed = false
  edgeReleased = true
}

export function isActionButtonPressed(): boolean {
  return pressed
}

export function actionButtonJustPressed(): boolean {
  return edgePressed
}

export function actionButtonJustReleased(): boolean {
  return edgeReleased
}

// Visible only when the currently selected slot is flagged as having
// an executable action (see `hasAction` on each SLOTS entry). The
// empty-cup case adds a per-target gate: the action button means
// "fill the cup with what I'm pointing at", so it should only surface
// while the camera is actually aimed at water — otherwise the button
// would dangle uselessly on the HUD whenever the player holds an
// empty cup.
//
// Looking at a placed grill ALWAYS surfaces the button regardless of the
// held slot's own action, because the grill override (open the cook
// menu / pick up the cooked plate / grab the coal) is the dominant
// action whenever the camera is on a grill — see `ActionButton.tsx`
// for the matching icon swap. The one exception is a cook-in-progress:
// the player can't act on the grill until the food is ready or burned,
// so the button hides during that window (the ingredient sprites on
// the fire already communicate "in progress").
export function isActionButtonAvailable(): boolean {
  // Looking at a floating debris item in pickup range — surface the
  // button as the GRAB action regardless of the held slot. See
  // `systems/garbageGrab.ts` for the matching handler. Checked before
  // the grill/storage paths so the closest-thing-in-front-of-you wins
  // when a floating item happens to drift over a placed construction.
  if (getLookAtTarget() === 'garbage') return true
  if (getLookAtTarget() === 'grill') {
    const platform = getLookAtGrillPlatform()
    if (platform === null) return true
    const cook = ActiveCook.getOrNull(platform)
    if (cook === null) return true
    return cook.status !== CookStatus.Cooking
  }
  // Aimed at a placed storage — surface the button regardless of the
  // selected slot's own action so mobile players can open the chest.
  if (getLookAtTarget() === 'storage') return true
  if (getLookAtTarget() === 'purifier') return true
  // Fishing line is out — surface the button as the contextual
  // retract / catch trigger. The same press fires the catch during
  // the bite window. This intentionally also unlocks visibility on
  // desktop (see ActionButton.tsx) since otherwise there'd be no way
  // to retract on desktop without a separate keybind.
  if (isFishingLineActive()) return true
  if (!getSlotHasAction(getSelectedSlot())) return false
  if (getHeldItemKind() === 'cup' && getHeldFoodId() === 'cup') {
    return getLookAtTarget() === 'water'
  }
  return true
}

// Clears the single-frame edge flags. Must run after every system that reads
// them, i.e. last in the system list. Also advances the press animation
// clock so the UI can read the current scale each frame.
export function actionButtonResetSystem(dt: number): void {
  edgePressed = false
  edgeReleased = false
  if (pressElapsedSec <= PRESS_DURATION_S) pressElapsedSec += dt
}

export function getActionButtonScale(): number {
  if (pressElapsedSec >= PRESS_DURATION_S) return 1
  // Squared-linear decay from 1 → 0 over the duration. Peak bonus is applied
  // immediately on press, eases out smoothly.
  const linear = 1 - pressElapsedSec / PRESS_DURATION_S
  const ease = linear * linear
  return 1 + PRESS_PEAK_BONUS * ease
}
