import { isMobile } from '@dcl/sdk/platform'
import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getCraftButtonScale,
  isCraftOpen,
  toggleCraft
} from '../craftToggle'
import {
  CRAFT_BUTTON_ICON,
  CRAFT_BUTTON_RIGHT,
  CRAFT_BUTTON_RIGHT_DESKTOP,
  INVENTORY_BUTTON_TOP,
  INVENTORY_BUTTON_TOP_DESKTOP
} from '../theme'
import { IconButton } from './IconButton'

// Saw toggle, anchored top-right one button-size to the left of the
// backpack so the visible edges sit flush. Shares the inventory button's
// top offset so the two read as a single row.
export function CraftButton(): ReactEcs.JSX.Element {
  const top = isMobile() ? INVENTORY_BUTTON_TOP : INVENTORY_BUTTON_TOP_DESKTOP
  const right = isMobile() ? CRAFT_BUTTON_RIGHT : CRAFT_BUTTON_RIGHT_DESKTOP
  return (
    <IconButton
      open={isCraftOpen()}
      scale={getCraftButtonScale()}
      iconTexture={CRAFT_BUTTON_ICON}
      top={top}
      right={right}
      onPress={toggleCraft}
    />
  )
}
