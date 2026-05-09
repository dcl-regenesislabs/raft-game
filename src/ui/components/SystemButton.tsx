import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { isSystemMenuOpen } from '../systemSession'
import { getSystemButtonScale, toggleSystemMenu } from '../systemToggle'
import {
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_LIGHT_COLOR,
  INVENTORY_BUTTON_FRAME,
  INVENTORY_BUTTON_SIZE,
  INVENTORY_BUTTON_TEXTURE,
  INVENTORY_BUTTON_TEXTURE_OPEN,
  INVENTORY_BUTTON_TOP,
  SYSTEM_BUTTON_LABEL,
  SYSTEM_BUTTON_RIGHT
} from '../theme'

// Top-right toggle for the SAVE / LOAD / RESTART menu. Mirrors the
// circular IconButton frame used by inventory and craft, but renders a
// text label inside instead of a texture — there isn't a system icon
// asset, and a 3-letter label reads clearly at button size.
export function SystemButton(): ReactEcs.JSX.Element {
  const open = isSystemMenuOpen()
  const scale = getSystemButtonScale()
  const scaledSize = Math.round(INVENTORY_BUTTON_SIZE * scale)
  const labelColor = open ? CRAFT_TEXT_LIGHT_COLOR : CRAFT_TEXT_COLOR
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: INVENTORY_BUTTON_TOP, right: SYSTEM_BUTTON_RIGHT },
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
            src: open ? INVENTORY_BUTTON_TEXTURE_OPEN : INVENTORY_BUTTON_TEXTURE
          }
        }}
        onMouseDown={toggleSystemMenu}
      >
        <Label
          value={SYSTEM_BUTTON_LABEL}
          fontSize={Math.round(scaledSize * 0.22)}
          color={labelColor}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

