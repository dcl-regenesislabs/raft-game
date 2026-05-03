import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import {
  getActionButtonScale,
  isActionButtonAvailable,
  isActionButtonPressed,
  pressActionButton,
  releaseActionButton
} from '../actionButton'
import { getSelectedSlot, getSlotItem } from '../inventoryState'
import { isInventoryOpen } from '../inventoryToggle'
import {
  ACTION_BUTTON_FRAME,
  ACTION_BUTTON_ICON_INSET_PCT,
  ACTION_BUTTON_RIGHT,
  ACTION_BUTTON_SIZE,
  ACTION_BUTTON_TEXTURE,
  ACTION_BUTTON_TEXTURE_PRESSED
} from '../theme'

// Mobile-only fire button. Hidden on desktop, while the inventory panel is
// open, or while the held tool has no associated action.
//
// Two-layer wrapper:
//   1) Outer column pinned to the right edge → vertical centering.
//   2) Fixed-size frame holding the button centered inside it. The button
//      itself changes size with the press animation; the frame stays
//      constant so the button grows from its centre instead of shifting
//      toward one edge.
export function ActionButton(): ReactEcs.JSX.Element | null {
  if (!isMobile() || !isActionButtonAvailable() || isInventoryOpen()) return null
  const pressed = isActionButtonPressed()
  const iconTexture = getSlotItem(getSelectedSlot())?.texture ?? null
  const scaledSize = Math.round(ACTION_BUTTON_SIZE * getActionButtonScale())
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, right: 0 },
        width: ACTION_BUTTON_FRAME + ACTION_BUTTON_RIGHT,
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-end',
        padding: { right: ACTION_BUTTON_RIGHT }
      }}
    >
      <UiEntity
        uiTransform={{
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
    </UiEntity>
  )
}
