import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getInventoryButtonScale,
  isInventoryOpen,
  toggleInventory
} from '../inventoryToggle'
import {
  INVENTORY_BUTTON_ICON,
  INVENTORY_BUTTON_LEFT_PCT_MOBILE,
  INVENTORY_BUTTON_RIGHT_DESKTOP
} from '../theme'
import { IconButton } from './IconButton'

// Backpack toggle. Top-right on desktop, anchored at 70% from the left on
// mobile so it sits in the upper-right region without crowding the action
// button column.
export function InventoryButton(): ReactEcs.JSX.Element {
  return (
    <IconButton
      open={isInventoryOpen()}
      scale={getInventoryButtonScale()}
      iconTexture={INVENTORY_BUTTON_ICON}
      rightDesktop={INVENTORY_BUTTON_RIGHT_DESKTOP}
      leftPctMobile={INVENTORY_BUTTON_LEFT_PCT_MOBILE}
      onPress={toggleInventory}
    />
  )
}
