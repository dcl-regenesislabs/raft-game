import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import {
  INVENTORY_BUTTON_FRAME,
  INVENTORY_BUTTON_ICON_INSET_PCT,
  INVENTORY_BUTTON_SIZE,
  INVENTORY_BUTTON_TEXTURE,
  INVENTORY_BUTTON_TEXTURE_OPEN
} from '../theme'

// Top-row toggle button (inventory backpack, craft saw). Both buttons share
// the same circular art and centering logic; the only differences are:
//   - which inner icon they render,
//   - distance from the safe-area right edge,
//   - what state controls "open" vs "closed",
//   - what runs on press.
// All anchored top-right with a single `right` offset that maps each
// button into the same row.
export interface IconButtonProps {
  open: boolean
  scale: number
  iconTexture: string
  // Distance (px) from the safe-area top edge to the button frame.
  top: number
  // Distance (px) from the safe-area right edge to the button frame.
  right: number
  onPress: () => void
  key?: number | string
}

export function IconButton(props: IconButtonProps): ReactEcs.JSX.Element {
  const scaledSize = Math.round(INVENTORY_BUTTON_SIZE * props.scale)
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: props.top, right: props.right },
        width: INVENTORY_BUTTON_FRAME,
        height: INVENTORY_BUTTON_FRAME,
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
            src: props.open
              ? INVENTORY_BUTTON_TEXTURE_OPEN
              : INVENTORY_BUTTON_TEXTURE
          }
        }}
        onMouseDown={props.onPress}
      >
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: {
              top: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              bottom: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              left: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              right: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`
            }
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: props.iconTexture }
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}
