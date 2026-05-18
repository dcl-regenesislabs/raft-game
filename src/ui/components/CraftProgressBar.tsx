import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { getCraftProgress } from '../craftSession'
import {
  CHARGE_BAR_HEIGHT,
  CHARGE_BAR_WIDTH,
  CHARGE_FILL_COLOR,
  CHARGE_TRACK_COLOR
} from '../theme'

// Fullscreen-centered progress bar shown while a craft is running.
// Reuses the hook charge meter style for visual consistency. Cooking
// and water purification are asynchronous (place-and-wait) and do NOT
// surface in this bar — see `grillCook` / `purifierProcess`.
export function CraftProgressBar(): ReactEcs.JSX.Element {
  const t = getCraftProgress()
  const fillWidth = Math.max(2, Math.round(CHARGE_BAR_WIDTH * t))
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: CHARGE_BAR_WIDTH,
          height: CHARGE_BAR_HEIGHT
        }}
        uiBackground={{ color: CHARGE_TRACK_COLOR }}
      >
        <UiEntity
          uiTransform={{ width: fillWidth, height: CHARGE_BAR_HEIGHT }}
          uiBackground={{ color: CHARGE_FILL_COLOR }}
        />
      </UiEntity>
    </UiEntity>
  )
}
