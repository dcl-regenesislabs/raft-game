import { isMobile } from '@dcl/sdk/platform'
import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getInventoryButtonScale,
  isInventoryOpen,
  toggleInventory
} from '../inventoryToggle'
import {
  INVENTORY_BUTTON_ICON,
  INVENTORY_BUTTON_RIGHT,
  INVENTORY_BUTTON_RIGHT_DESKTOP,
  INVENTORY_BUTTON_TOP,
  INVENTORY_BUTTON_TOP_DESKTOP
} from '../theme'
import { IconButton } from './IconButton'

// Backpack toggle, anchored to the safe-area top-right corner.
export function InventoryButton(): ReactEcs.JSX.Element {
  const top = isMobile() ? INVENTORY_BUTTON_TOP : INVENTORY_BUTTON_TOP_DESKTOP
  const right = isMobile() ? INVENTORY_BUTTON_RIGHT : INVENTORY_BUTTON_RIGHT_DESKTOP
  return (
    <IconButton
      open={isInventoryOpen()}
      scale={getInventoryButtonScale()}
      iconTexture={INVENTORY_BUTTON_ICON}
      top={top}
      right={right}
      onPress={toggleInventory}
    />
  )
}
