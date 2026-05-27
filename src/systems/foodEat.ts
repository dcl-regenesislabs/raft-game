import {
  InputAction,
  PointerEventType,
  Transform,
  inputSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import {
  getHeldFoodId,
  getHeldItemEntity,
  getHeldItemKind,
  getHeldItemRest
} from '../factories/heldItem'
import { actionButtonJustPressed } from '../ui/actionButton'
import { isPointerLocked } from '../ui/cursorLock'
import { getFoodEffect } from '../ui/foodEffects'
import {
  consumeFoodById,
  drinkContainerSlot,
  getCollectedCount,
  getSelectedSlot,
  isSelectionPointerLockoutActive
} from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isWorldClickConsumed } from '../ui/worldClickGate'
import { playSfx } from '../audio/sfx'

// One-shot consume animation triggered on a single fire press. Two flavours
// based on what's equipped:
//   chew  — solid food. Pull-to-mouth pose with high-frequency jitter on
//           top, reads as rapid bites. Used for fish, potato, pasta, etc.
//   drink — water / liquid. Pull-to-mouth pose with a big pitch-back tilt,
//           no jitter, reads as tipping a cup to pour. Used for fresh /
//           salt water.
// Effects (hunger/thirst) apply at the midpoint so the stat bump lines up
// with the visible peak. A short cooldown after the gesture finishes
// prevents auto-fire from a held button on desktop.

const CHEW_DURATION_S = 1.1
const DRINK_DURATION_S = 0.8
const COOLDOWN_S = 0.15

// Shared pull-toward-mouth pose. Camera-frame deltas added on top of the
// rest pose + sway each frame.
const EAT_FORWARD_M = -0.22
const EAT_UP_M = 0.14
const EAT_SIDE_M = -0.18
const EAT_SCALE_BONUS = 0.18

// Chew jitter — three de-synced sines so consecutive bites don't line up
// into a clean vibration.
const CHEW_PITCH_DEG = -18
const CHEW_FREQ_HZ = 4.5
const CHEW_AMP_FWD_M = 0.03
const CHEW_AMP_UP_M = 0.018
const CHEW_AMP_PITCH_DEG = 5

// Drink: bigger pitch-back tilt mimes tipping the cup so the liquid pours
// into the mouth. No jitter.
const DRINK_PITCH_DEG = -25

const TWO_PI = Math.PI * 2

type EatKind = 'chew' | 'drink'

let activeKind: EatKind | null = null
let elapsed = 0
let cooldown = 0
let consumed = false
// Monotonic phase for the chew jitter sines. Doesn't reset between bites
// so consecutive chews don't visibly snap back to phase 0.
let chewPhase = 0

export function foodEatSystem(dt: number): void {
  const entity = getHeldItemEntity()
  if (entity === null) return

  if (cooldown > 0) cooldown = Math.max(0, cooldown - dt)

  const heldKind = getHeldItemKind()
  const isFoodHeld = heldKind === 'food'
  const isDrinkContainerHeld = heldKind === 'cup' && isDrinkable(getHeldFoodId())
  const isEdibleHeld = isFoodHeld || isDrinkContainerHeld

  // Single-press fire — chew/drink runs to completion regardless of whether
  // the button stays held. Mobile uses the action-button edge flag, desktop
  // uses IA_POINTER PET_DOWN with the pointer captured. We also bail when
  // an in-world entity already handled this frame's click (e.g. tapping
  // the purifier with salt water held — we want the purify session, not
  // a swig from the cup).
  const firePressed =
    !isInventoryActionLocked() &&
    !isSelectionPointerLockoutActive() &&
    !isWorldClickConsumed() &&
    (actionButtonJustPressed() ||
      (!isMobile() &&
        isPointerLocked() &&
        inputSystem.isTriggered(
          InputAction.IA_POINTER,
          PointerEventType.PET_DOWN
        )))

  if (
    isEdibleHeld &&
    activeKind === null &&
    cooldown === 0 &&
    firePressed &&
    hasEdibleInStack()
  ) {
    activeKind = classifyHeldEdible()
    elapsed = dt > 0 ? dt : 1e-6
    cooldown = COOLDOWN_S
    consumed = false
    playSfx(activeKind === 'drink' ? 'drinkWater' : 'eatFood')
  }

  if (activeKind === null) return

  const duration = activeKind === 'chew' ? CHEW_DURATION_S : DRINK_DURATION_S
  const previous = elapsed
  elapsed += dt

  // Consume at the midpoint — locks the stat bump to the visible peak and
  // prevents a long frame from skipping the consume entirely. Containers
  // (cup-of-water variants) transmute the slot back to an empty cup so
  // the player keeps the vessel; food items just decrement the stack.
  const halfway = duration * 0.5
  if (!consumed && previous < halfway && elapsed >= halfway) {
    consumed = true
    const foodId = getHeldFoodId()
    if (foodId !== null) {
      if (getHeldItemKind() === 'cup') {
        drinkContainerSlot(getSelectedSlot(), foodId)
      } else {
        consumeFoodById(foodId)
      }
    }
  }

  if (elapsed >= duration) {
    activeKind = null
    elapsed = 0
    return
  }

  const u = elapsed / duration
  // Trapezoid envelope: ramp up, hold near 1, ramp down. Drink uses a
  // longer ramp so the tilt-and-pour reads smoother; chew snaps in faster
  // so the first bite feels punchy.
  const rampPct = activeKind === 'chew' ? 0.18 : 0.3
  const intensity = envelope(u, rampPct)

  const fwdBase = EAT_FORWARD_M * intensity
  const upBase = EAT_UP_M * intensity
  const sideBase = EAT_SIDE_M * intensity
  const scaleBonus = 1 + EAT_SCALE_BONUS * intensity

  let pitchBase = 0
  let fwdJitter = 0
  let upJitter = 0
  let pitchJitter = 0
  if (activeKind === 'chew') {
    pitchBase = CHEW_PITCH_DEG * intensity
    chewPhase += dt
    const j = chewPhase * CHEW_FREQ_HZ * TWO_PI
    fwdJitter = CHEW_AMP_FWD_M * intensity * Math.sin(j)
    upJitter = CHEW_AMP_UP_M * intensity * Math.sin(j * 0.7 + 1.3)
    pitchJitter = CHEW_AMP_PITCH_DEG * intensity * Math.sin(j * 1.1 + 0.4)
  } else {
    pitchBase = DRINK_PITCH_DEG * intensity
  }

  const rest = getHeldItemRest()
  const m = Transform.getMutable(entity)
  m.position = Vector3.create(
    m.position.x + sideBase,
    m.position.y + upBase + upJitter,
    m.position.z + fwdBase + fwdJitter
  )
  m.rotation = Quaternion.multiply(
    Quaternion.fromEulerDegrees(pitchBase + pitchJitter, 0, 0),
    m.rotation
  )
  m.scale = Vector3.create(
    rest.scale.x * scaleBonus,
    rest.scale.y * scaleBonus,
    rest.scale.z * scaleBonus
  )
}

function envelope(u: number, ramp: number): number {
  if (u < ramp) return u / ramp
  if (u > 1 - ramp) return (1 - u) / ramp
  return 1
}

// Pure-thirst items (fresh/salt water) drink; everything that bumps hunger
// — even fish that also takes thirst — chews. Drink containers (held as
// cup-kind) always drink regardless of effect shape, since the visual
// "tipping a cup" gesture matches the container-with-liquid mental model.
function classifyHeldEdible(): EatKind {
  if (getHeldItemKind() === 'cup') return 'drink'
  const id = getHeldFoodId()
  if (id === null) return 'chew'
  const effect = getFoodEffect(id)
  if (effect === null) return 'chew'
  const hunger = effect.hunger ?? 0
  const hungerBonus = effect.hungerBonus ?? 0
  if (hunger === 0 && hungerBonus === 0) return 'drink'
  return 'chew'
}

// True iff the held item is something the consume gesture can act on
// right now — food with stock, or a drink container actually holding
// liquid (an empty cup is held with this kind too but mustn't trigger).
function hasEdibleInStack(): boolean {
  const id = getHeldFoodId()
  if (id === null) return false
  return getCollectedCount(id) > 0
}

// Salt-water and fresh-water cups are the two drinkable container
// variants. An empty cup ('cup') falls through and won't trigger the
// drink gesture even though it shares the 'cup' heldKind.
function isDrinkable(id: string | null): boolean {
  return id === 'saltWater' || id === 'freshWater'
}
