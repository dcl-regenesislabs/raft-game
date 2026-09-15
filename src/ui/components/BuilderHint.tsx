import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getRaftBuilderMode, getDestroyHoverTarget } from '../../systems/raftBuilder'
import { getMobileLayout } from '../mobileLayout'
import { UI_GLASS, UI_INK, UI_MUTED } from '../visualTheme'
import { BUILD_ICON, ERASE_ICON } from '../buildControlIcons'

// One quiet, non-interactive prompt explains what the large action button does.
export function BuilderHint(): ReactEcs.JSX.Element | null {
  const mode = getRaftBuilderMode()
  if (mode === 'idle') return null
  const erase = mode === 'destroying'
  const area = getMobileLayout(true)
  const centerX = (area.left + area.width + area.right) / 2
  const centerY = (area.top + area.height + area.bottom) / 2
  return <UiEntity uiTransform={{ positionType: 'absolute', position: {
    left: Math.max(area.left, Math.min(centerX + 24, area.left + area.width - 250)),
    top: Math.max(area.top, Math.min(centerY - 28, area.top + area.height - 56))
  }, width: 250, height: 56, padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }} uiBackground={{ color: UI_GLASS }}>
    <UiEntity uiTransform={{ width: 32, height: 32, margin: { right: 8 } }} uiBackground={{ textureMode: 'stretch', texture: { src: erase ? ERASE_ICON : BUILD_ICON } }} />
    <UiEntity uiTransform={{ width: 190, height: 40, flexDirection: 'column' }}>
      <Label value={erase ? 'Erase mode' : 'Build mode'} fontSize={15} color={UI_INK} textAlign="middle-left" uiTransform={{ width: 190, height: 20 }} />
      <Label value={erase ? (getDestroyHoverTarget() === null ? 'Aim at a removable tile' : 'Tap large eraser to remove') : 'Green preview: tap large hammer'} fontSize={10} color={UI_MUTED} textAlign="middle-left" uiTransform={{ width: 190, height: 20 }} />
    </UiEntity>
  </UiEntity>
}
