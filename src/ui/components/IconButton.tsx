import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import {
  INVENTORY_BUTTON_FRAME,
  INVENTORY_BUTTON_FRAME_MOBILE,
  INVENTORY_BUTTON_ICON_INSET_PCT,
  INVENTORY_BUTTON_SIZE,
  INVENTORY_BUTTON_SIZE_MOBILE,
  INVENTORY_BUTTON_TEXTURE,
  INVENTORY_BUTTON_TEXTURE_OPEN,
  INVENTORY_BUTTON_TOP
} from '../theme'

// Top-row toggle button (inventory backpack, craft saw). Both buttons share
// the same circular art and centering logic; the only differences are:
//   - which inner icon they render,
//   - how they pin horizontally (mobile %-anchor vs desktop right-inset),
//   - what state controls "open" vs "closed",
//   - what runs on press.
// Encapsulating the layout here keeps the two call sites tiny.
export interface IconButtonProps {
  open: boolean
  scale: number
  iconTexture: string
  // Desktop right-edge inset (pixels) and mobile left-edge anchor (% of
  // canvas width). Both are read each render — `isMobile()` picks one.
  rightDesktop: number
  leftPctMobile: number
  onPress: () => void
  key?: number | string
}

export function IconButton(props: IconButtonProps): ReactEcs.JSX.Element {
  const mobile = isMobile()
  const baseSize = mobile ? INVENTORY_BUTTON_SIZE_MOBILE : INVENTORY_BUTTON_SIZE
  const frameSize = mobile ? INVENTORY_BUTTON_FRAME_MOBILE : INVENTORY_BUTTON_FRAME
  const scaledSize = Math.round(baseSize * props.scale)
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: mobile
          ? {
              top: INVENTORY_BUTTON_TOP,
              left: `${props.leftPctMobile}%`
            }
          : {
              top: INVENTORY_BUTTON_TOP,
              right: props.rightDesktop
            },
        width: frameSize,
        height: frameSize,
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
