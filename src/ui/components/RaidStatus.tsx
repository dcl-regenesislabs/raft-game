import { objective, isSandbox, chapter } from '../../progression/state'
import { protectPanelDismissal } from '../inventoryToggle'
import { isObjectiveExpanded, objectiveTop, toggleObjective } from '../progressionHud'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getExpansionStatus } from '../../expansion/runtime'
import { UI_GLASS, UI_INK } from '../visualTheme'
import { getMobileLayout } from '../mobileLayout'
import { isMobile } from '@dcl/sdk/platform'

const DESKTOP_WIDTH = 520

// Event-only objective feedback, above the crosshair and away from action buttons.
export function RaidStatus(): ReactEcs.JSX.Element | null {
  const expanded = isObjectiveExpanded()
  const status = getExpansionStatus()
  if (!status && isSandbox()) return null
  const guide = objective()
  const text = status ?? `${chapter()}/6 · ${guide.title} ${expanded ? '−' : '+'}`
  // Rendered outside SafeArea: desktop centres a fixed-width pill on the
  // interactable area so it never drifts into the tutorial or menu buttons.
  const area = getMobileLayout()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: isMobile()
          ? { top: '5%', left: '35%' }
          : { top: objectiveTop(), left: area.left + Math.round((area.width - DESKTOP_WIDTH) / 2) },
        width: isMobile() ? '30%' : DESKTOP_WIDTH,
        height: expanded ? 130 : 48,
        flexDirection: 'column',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: UI_GLASS }}
      onMouseDown={protectPanelDismissal}
      onMouseUp={() => { protectPanelDismissal(); toggleObjective() }}
    >
      <Label value={text} fontSize={16} color={UI_INK} uiTransform={{ width: '100%', height: 42 }} />
      {expanded && <Label value={guide.detail} fontSize={15} color={UI_INK} uiTransform={{ width: '96%', height: 80 }} />}
    </UiEntity>
  )
}
