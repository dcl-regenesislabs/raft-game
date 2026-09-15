import { UI_INK, UI_CELL } from '../visualTheme'
import { isMobile } from '@dcl/sdk/platform'
import { beginUiTouch } from '../mobileControlsState'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { CLOSE_BUTTON_SIZE, CLOSE_BUTTON_TEXTURE } from '../theme'

// Round wood-framed red X used as the close affordance on every main
// HUD panel (craft, inventory, cook). Stays self-contained so panels
// can drop it wherever fits — most pin it absolutely to their top-right
// corner so it visually overlaps the painted wood frame without
// disturbing the inner content layout.
export function CloseButton(props: {
  onPress: () => void
  size?: number
}): ReactEcs.JSX.Element {
  const size = props.size ?? CLOSE_BUTTON_SIZE
  return (
    <UiEntity
      uiTransform={{ width: size, height: size, borderRadius: 10 }}
      uiBackground={{
        color: UI_CELL
      }}
      onMouseDown={isMobile() ? beginUiTouch : props.onPress}
        onMouseUp={isMobile() ? props.onPress : undefined}
    ><Label value="×" fontSize={28} color={UI_INK} uiTransform={{ width: '100%', height: '100%' }} /></UiEntity>
  )
}
