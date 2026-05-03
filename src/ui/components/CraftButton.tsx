import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getCraftButtonScale,
  isCraftOpen,
  toggleCraft
} from '../craftToggle'
import {
  CRAFT_BUTTON_ICON,
  CRAFT_BUTTON_LEFT_PCT_MOBILE,
  CRAFT_BUTTON_RIGHT_DESKTOP
} from '../theme'
import { IconButton } from './IconButton'

// Saw toggle, sitting one button-size to the left of the backpack on
// desktop, and 14% to the left of the backpack on mobile.
export function CraftButton(): ReactEcs.JSX.Element {
  return (
    <IconButton
      open={isCraftOpen()}
      scale={getCraftButtonScale()}
      iconTexture={CRAFT_BUTTON_ICON}
      rightDesktop={CRAFT_BUTTON_RIGHT_DESKTOP}
      leftPctMobile={CRAFT_BUTTON_LEFT_PCT_MOBILE}
      onPress={toggleCraft}
    />
  )
}
