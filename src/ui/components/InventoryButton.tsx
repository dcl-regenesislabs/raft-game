import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getInventoryButtonScale,
  isInventoryOpen,
  toggleInventory
} from '../inventoryToggle'
import {
  INVENTORY_BUTTON_ICON,
  INVENTORY_BUTTON_RIGHT,
  INVENTORY_BUTTON_TOP
} from '../theme'
import { IconButton } from './IconButton'

// Backpack toggle, anchored to the safe-area top-right corner.
export function InventoryButton(): ReactEcs.JSX.Element {
  return (
    <IconButton
      open={isInventoryOpen()}
      scale={getInventoryButtonScale()}
      iconTexture={INVENTORY_BUTTON_ICON}
      top={INVENTORY_BUTTON_TOP}
      right={INVENTORY_BUTTON_RIGHT}
      onPress={toggleInventory}
    />
  )
}
