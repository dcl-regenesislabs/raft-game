import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import { ActiveCook, CookStatus } from '../../components'
import { getHeldFoodId, getHeldItemKind } from '../../factories/heldItem'
import {
  getFishingBiteIntensity,
  isFishingBiting,
  isFishingLineActive
} from '../../systems/fishingRod'
import {
  getLookAtGarbageKind,
  getLookAtGrillPlatform,
  getLookAtTarget
} from '../../systems/lookAtTarget'
import { getCookableById } from '../cookableItems'
import {
  getActionButtonScale,
  isActionButtonAvailable,
  isActionButtonPressed,
  pressActionButton,
  releaseActionButton
} from '../actionButton'
import { isCraftOpen } from '../craftToggle'
import { getSelectedSlot, getSlotItem } from '../inventoryState'
import { isInventoryOpen } from '../inventoryToggle'
import { isStorageOpen } from '../storageToggle'
import { getItem } from '../items'
import {
  ACTION_BUTTON_FRAME,
  ACTION_BUTTON_ICON_INSET_PCT,
  ACTION_BUTTON_RIGHT,
  ACTION_BUTTON_SIZE,
  ACTION_BUTTON_TEXTURE,
  ACTION_BUTTON_TEXTURE_PRESSED,
  ACTION_BUTTON_TOP_PCT
} from '../theme'

// Mobile-only fire button anchored to the middle-right of the safe area.
// Hidden on desktop, while the inventory or craft panel is open, or while
// the held tool has no associated action.
//
// The frame is sized to the peak press scale so the button can grow with
// its press animation without shifting the parent.
export function ActionButton(): ReactEcs.JSX.Element | null {
  // Desktop normally has no action button — fire is bound to mouse
  // click. The fishing rod is the one exception: while a line is out,
  // the player needs an explicit retract / catch press, so the button
  // surfaces on desktop too. On a bite, the button screams (scale +
  // texture flash) so the player can't miss the 2 s reaction window.
  const fishingActive = isFishingLineActive()
  if (
    (!isMobile() && !fishingActive) ||
    !isActionButtonAvailable() ||
    isInventoryOpen() ||
    isCraftOpen() ||
    isStorageOpen()
  )
    return null
  const pressed = isActionButtonPressed()
  const biting = isFishingBiting()
  const biteIntensity = biting ? getFishingBiteIntensity() : 0
  const iconTexture =
    contextualIconTexture() ?? getSlotItem(getSelectedSlot())?.texture ?? null
  // Pulse the button visibly during a bite so the player can't miss
  // the 2 s reaction window. Combine the base press scale with a
  // bite-driven multiplier in the [1.0, 1.25] range.
  const biteScaleBoost = 1 + 0.25 * biteIntensity
  const scaledSize = Math.round(
    ACTION_BUTTON_SIZE * getActionButtonScale() * biteScaleBoost
  )
  // Flash between the rest and pressed textures during a bite so the
  // colour pops. Outside the bite window, the existing pressed-on-touch
  // behaviour drives the texture as before.
  const screaming = biting && biteIntensity > 0.5
  const buttonTexture =
    pressed || screaming ? ACTION_BUTTON_TEXTURE_PRESSED : ACTION_BUTTON_TEXTURE
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: `${ACTION_BUTTON_TOP_PCT}%`, right: ACTION_BUTTON_RIGHT },
        margin: { top: -Math.round(ACTION_BUTTON_FRAME / 2) },
        width: ACTION_BUTTON_FRAME,
        height: ACTION_BUTTON_FRAME,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: scaledSize,
          height: scaledSize,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: buttonTexture }
        }}
        onMouseDown={pressActionButton}
        onMouseUp={releaseActionButton}
      >
        {iconTexture && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: {
                top: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                bottom: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                left: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                right: `${ACTION_BUTTON_ICON_INSET_PCT}%`
              }
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: iconTexture }
            }}
          />
        )}
      </UiEntity>
    </UiEntity>
  )
}

// Returns a context-specific icon texture when the action the button
// will execute differs from "use the equipped item":
//   - Looking at a placed grill ALWAYS overrides — empty grill shows the
//     cook icon (opens the menu); a Ready cook shows the dish icon
//     (grab cooked plate); a Burned cook shows the coal icon (grab coal).
//     Cooking-in-progress hides the button entirely; see
//     `isActionButtonAvailable` for the matching visibility rule.
//   - Holding a salt-water cup while aimed at a placed purifier means
//     pressing kicks off the purify session, so the icon shows the
//     purifier instead of the salt-water cup.
// Returns null when the default equipped-slot texture should win.
function contextualIconTexture(): string | null {
  const lookTarget = getLookAtTarget()
  if (lookTarget === 'grill') return grillIconTexture()
  // Looking at a placed storage: surface the chest icon regardless of
  // what the player is holding — pressing the action button opens the
  // dual-pane menu, the held item is irrelevant.
  if (lookTarget === 'storage') return getItem('storage')?.texture ?? null
  // Floating-item pickup: show the material the player is about to
  // grab so the button reads as GRAB instead of "use equipped tool".
  // `barrel` has no inventory item (it unpacks into a wood + rope +
  // pantry bundle at bank time) so we fall back to its always-guaranteed
  // wood drop as the recognisable proxy icon.
  if (lookTarget === 'garbage') return garbageIconTexture()
  if (getHeldItemKind() !== 'cup') return null
  if (getHeldFoodId() !== 'saltWater') return null
  if (lookTarget !== 'purifier') return null
  return getItem('purifier')?.texture ?? null
}

function garbageIconTexture(): string | null {
  const kind = getLookAtGarbageKind()
  if (kind === null) return null
  const id = kind === 'barrel' ? 'wood' : kind
  return getItem(id)?.texture ?? null
}

// Picks the right grill-context icon by inspecting the targeted grill's
// `ActiveCook`. Empty / cooking states fall back to the cook-menu icon
// (cooking is hidden upstream so this only matters as a defensive
// default); ready uses the recipe output texture; burned uses coal.
function grillIconTexture(): string | null {
  const platform = getLookAtGrillPlatform()
  if (platform === null) return getItem('grill')?.texture ?? null
  const cook = ActiveCook.getOrNull(platform)
  if (cook === null) return getItem('grill')?.texture ?? null
  if (cook.status === CookStatus.Ready) {
    return getCookableById(cook.recipeId)?.texture ?? null
  }
  if (cook.status === CookStatus.Burned) {
    return getItem('coal')?.texture ?? null
  }
  return getItem('grill')?.texture ?? null
}
