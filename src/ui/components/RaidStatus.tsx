import { t } from '../../i18n/index'
import { objectiveTop } from '../progressionHud'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getExpansionStatus } from '../../expansion/runtime'
import { UI_GLASS, UI_INK } from '../visualTheme'
import { getMobileLayout } from '../mobileLayout'
import { isMobile } from '@dcl/sdk/platform'

const DESKTOP_WIDTH = 520

// Active raid/rescue feedback only. Tutorial owns all step-by-step guidance.
export function RaidStatus(): ReactEcs.JSX.Element | null {
  const status = getExpansionStatus()
  if (!status) return null
  // Rendered outside SafeArea, centered between the guide and menu cluster.
  const area = getMobileLayout()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: isMobile()
          ? { top: '5%', left: '35%' }
          : { top: objectiveTop(), left: area.left + Math.round((area.width - DESKTOP_WIDTH) / 2) },
        width: isMobile() ? '30%' : DESKTOP_WIDTH,
        height: 48,
        flexDirection: 'column',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: UI_GLASS }}
    >
      <Label value={t(status)} fontSize={16} color={UI_INK} uiTransform={{ width: '100%', height: 42 }} />
    </UiEntity>
  )
}
