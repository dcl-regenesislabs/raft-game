import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { getAnchorChargeT } from '../../systems/anchorThrower'
import { getFishingChargeT } from '../../systems/fishingRod'
import { getThrowChargeT } from '../../systems/hookThrower'
import {
  CHARGE_BAR_HEIGHT,
  CHARGE_BAR_OFFSET_Y,
  CHARGE_BAR_WIDTH,
  CHARGE_FILL_COLOR,
  CHARGE_FILL_FULL_COLOR,
  CHARGE_TRACK_COLOR
} from '../theme'

// Crosshair-anchored hook-throw charge meter. Hidden when the charge is at
// rest; switches to the "full" colour once the bar fills (the throw fires
// automatically on the same frame).
export function ChargeReticle(): ReactEcs.JSX.Element | null {
  // Show whichever charge is active this frame. The hook and fishing
  // rod can't both be charging simultaneously (only one is equipped),
  // so picking the larger value collapses the two sources cleanly.
  const t = Math.max(getThrowChargeT(), getFishingChargeT(), getAnchorChargeT())
  if (t <= 0.001) return null
  const fillWidth = Math.max(2, Math.round(CHARGE_BAR_WIDTH * t))
  const fillColor = t >= 0.999 ? CHARGE_FILL_FULL_COLOR : CHARGE_FILL_COLOR
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
          height: CHARGE_BAR_HEIGHT,
          margin: { top: CHARGE_BAR_OFFSET_Y }
        }}
        uiBackground={{ color: CHARGE_TRACK_COLOR }}
      >
        <UiEntity
          uiTransform={{
            width: fillWidth,
            height: CHARGE_BAR_HEIGHT
          }}
          uiBackground={{ color: fillColor }}
        />
      </UiEntity>
    </UiEntity>
  )
}
