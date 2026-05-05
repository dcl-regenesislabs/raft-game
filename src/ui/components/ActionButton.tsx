import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import { getHeldFoodId, getHeldItemKind } from '../../factories/heldItem'
import { getLookAtTarget } from '../../systems/lookAtTarget'
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
  if (
    !isMobile() ||
    !isActionButtonAvailable() ||
    isInventoryOpen() ||
    isCraftOpen()
  )
    return null
  const pressed = isActionButtonPressed()
  const iconTexture =
    contextualIconTexture() ?? getSlotItem(getSelectedSlot())?.texture ?? null
  const scaledSize = Math.round(ACTION_BUTTON_SIZE * getActionButtonScale())
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
          texture: {
            src: pressed ? ACTION_BUTTON_TEXTURE_PRESSED : ACTION_BUTTON_TEXTURE
          }
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
//   - Looking at a placed grill ALWAYS overrides — pressing opens the
//     cook menu regardless of what's equipped (see `isActionButtonAvailable`
//     for the matching visibility rule).
//   - Holding a salt-water cup while aimed at a placed purifier means
//     pressing kicks off the purify session, so the icon shows the
//     purifier instead of the salt-water cup.
// Returns null when the default equipped-slot texture should win.
function contextualIconTexture(): string | null {
  const lookTarget = getLookAtTarget()
  if (lookTarget === 'grill') return getItem('grill')?.texture ?? null
  if (getHeldItemKind() !== 'cup') return null
  if (getHeldFoodId() !== 'saltWater') return null
  if (lookTarget !== 'purifier') return null
  return getItem('purifier')?.texture ?? null
}
