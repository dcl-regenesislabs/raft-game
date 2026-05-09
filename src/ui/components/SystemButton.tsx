import ReactEcs from '@dcl/sdk/react-ecs'

import { isSystemMenuOpen } from '../systemSession'
import { getSystemButtonScale, toggleSystemMenu } from '../systemToggle'
import {
  INVENTORY_BUTTON_TOP,
  SYSTEM_BUTTON_ICON,
  SYSTEM_BUTTON_RIGHT
} from '../theme'
import { IconButton } from './IconButton'

// Top-right toggle for the SAVE / LOAD / RESTART menu. Shares the
// circular IconButton frame with the inventory/craft toggles so the
// three buttons read as a single row.
export function SystemButton(): ReactEcs.JSX.Element {
  return (
    <IconButton
      open={isSystemMenuOpen()}
      scale={getSystemButtonScale()}
      iconTexture={SYSTEM_BUTTON_ICON}
      top={INVENTORY_BUTTON_TOP}
      right={SYSTEM_BUTTON_RIGHT}
      onPress={toggleSystemMenu}
    />
  )
}
