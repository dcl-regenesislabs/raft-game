import ReactEcs from '@dcl/sdk/react-ecs'

import {
  getCraftButtonScale,
  isCraftOpen,
  toggleCraft
} from '../craftToggle'
import { CRAFT_BUTTON_ICON, CRAFT_BUTTON_RIGHT } from '../theme'
import { IconButton } from './IconButton'

// Saw toggle, anchored top-right one button-size to the left of the
// backpack so the visible edges sit flush.
export function CraftButton(): ReactEcs.JSX.Element {
  return (
    <IconButton
      open={isCraftOpen()}
      scale={getCraftButtonScale()}
      iconTexture={CRAFT_BUTTON_ICON}
      right={CRAFT_BUTTON_RIGHT}
      onPress={toggleCraft}
    />
  )
}
