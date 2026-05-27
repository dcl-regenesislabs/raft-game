import { isMobile } from '@dcl/sdk/platform'
import ReactEcs from '@dcl/sdk/react-ecs'

import { isSystemMenuOpen } from '../systemSession'
import { getSystemButtonScale, toggleSystemMenu } from '../systemToggle'
import {
  INVENTORY_BUTTON_TOP,
  INVENTORY_BUTTON_TOP_DESKTOP,
  SYSTEM_BUTTON_ICON,
  SYSTEM_BUTTON_RIGHT,
  SYSTEM_BUTTON_RIGHT_DESKTOP
} from '../theme'
import { IconButton } from './IconButton'

// Top-right toggle for the SAVE / LOAD / RESTART menu. Shares the
// circular IconButton frame with the inventory/craft toggles so the
// three buttons read as a single row.
export function SystemButton(): ReactEcs.JSX.Element {
  const top = isMobile() ? INVENTORY_BUTTON_TOP : INVENTORY_BUTTON_TOP_DESKTOP
  const right = isMobile() ? SYSTEM_BUTTON_RIGHT : SYSTEM_BUTTON_RIGHT_DESKTOP
  return (
    <IconButton
      open={isSystemMenuOpen()}
      scale={getSystemButtonScale()}
      iconTexture={SYSTEM_BUTTON_ICON}
      top={top}
      right={right}
      onPress={toggleSystemMenu}
    />
  )
}
