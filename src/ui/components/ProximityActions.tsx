import { getRaftBuilderMode } from '../../systems/raftBuilder'
import { getConstructionPlacementMode } from '../../systems/constructionPlacement'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'
import { getProximityConstruction } from '../../systems/lookAtTarget'
import { resolveMobileControls } from '../../systems/touchControls'
import { pressProximityAction } from '../../systems/constructionInteract'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { UI_GLASS, UI_BORDER, UI_INK } from '../visualTheme'

// Multiple independent actions for the renderer-selected nearby structure.
export function ProximityActions(): ReactEcs.JSX.Element | null {
  const nearby = getProximityConstruction()
  if (!nearby || getRaftBuilderMode() !== 'idle' || getConstructionPlacementMode() !== 'idle') return null
  const state = resolveMobileControls()
  const actions = [
    { ...state.e, secondary: false, key: 'E' },
    { ...state.f, secondary: true, key: 'F' }
  ].filter((action) => action.visible)
  if (!actions.length) return null
  const area = getMobileLayout(true)
  const centerX = (area.left + area.width + area.right) / 2
  const centerY = (area.top + area.height + area.bottom) / 2
  // Keep the first action beside the crosshair; additional actions grow downward.
  // Clamp to hardware-safe bounds without changing the touch target size.
  const left = Math.max(area.left, Math.min(centerX + 28, area.left + area.width - 232))
  const top = Math.max(area.top, Math.min(centerY - 32, area.top + area.height - actions.length * 72))
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { left, top },
        width: 232,
        flexDirection: 'column'
      }}
    >
      {actions.map((action) => (
        <UiEntity
          key={`${nearby.platform}-${action.key}`}
          uiTransform={{
            width: 232,
            height: 64,
            margin: { bottom: 8 },
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: UI_BORDER,
            flexDirection: 'row',
            alignItems: 'center'
          }}
          uiBackground={{ color: UI_GLASS }}
          onMouseDown={beginUiTouch}
          onMouseUp={() => pressProximityAction(nearby.platform, action.secondary)}
        >
          {action.icon && (
            <UiEntity
              uiTransform={{ width: 40, height: 40, margin: { right: 10 } }}
              uiBackground={{ textureMode: 'stretch', texture: { src: action.icon } }}
            />
          )}
          <Label
            value={`${isMobile() ? '' : action.key + '  '}${action.label}`}
            fontSize={16}
            color={UI_INK}
            textAlign="middle-left"
            uiTransform={{ width: 158, height: 44 }}
          />
        </UiEntity>
      ))}
    </UiEntity>
  )
}
