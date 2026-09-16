import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { INVESTIGATIONS, chapter, investigationBypassed, requiredChapter, recipeUnlocked } from '../../progression/state'
import { CRAFTABLE_ITEMS } from '../craftableItems'
import { CRAFT_STATION_NAMES } from '../../expansion/catalog'
import { beginUiTouch } from '../mobileControlsState'
import { setCraftOpen } from '../craftToggle'
import { Panel } from '../panel'
import { UI_ACCENT, UI_CELL, UI_INK, UI_MUTED } from '../visualTheme'
import { CRAFT_LIST_WIDTH, CRAFT_DETAILS_WIDTH } from '../theme'
import { MenuList, resetMenuPage } from './MenuList'
import { CloseButton } from './CloseButton'
let selected = 0
const yellow = Color4.create(1, .78, .22, 1)
export function InvestigationPanels(props: { height: number }): ReactEcs.JSX.Element {
  const research = INVESTIGATIONS[selected]
  const unlocked = investigationBypassed() || chapter() > research.level || (research.level > 1 && chapter() === research.level)
  const recipes = CRAFTABLE_ITEMS.filter(item => requiredChapter(item.id) === research.level)
  return <UiEntity uiTransform={{ flexDirection: 'row' }}>
    <Panel uiTransform={{ width: CRAFT_LIST_WIDTH, height: props.height, padding: 24, flexDirection: 'column' }}>
      <UiEntity uiTransform={{ height: 48, flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
        <Label value="Investigation" color={UI_INK} fontSize={20} uiTransform={{ flexGrow: 1, height: 48 }} />
        <CloseButton onPress={() => setCraftOpen(false)} />
      </UiEntity>
      <MenuList id="investigation-goals" height={props.height - 104} rowHeight={62}>
        {INVESTIGATIONS.map((entry, index) => <UiEntity key={entry.title}
          uiTransform={{ height: 58, margin: { bottom: 4 }, borderRadius: 8, flexShrink: 0 }}
          uiBackground={{ color: selected === index ? UI_ACCENT : UI_CELL }}
          onMouseDown={beginUiTouch} onMouseUp={() => { beginUiTouch(); selected = index; resetMenuPage('investigation-rewards') }}>
          <Label value={`${investigationBypassed() || chapter() > entry.level || (entry.level > 1 && chapter() === entry.level) ? '✓' : '◇'}  ${entry.title}`} fontSize={17} color={UI_INK} uiTransform={{ width: '100%', height: '100%' }} />
        </UiEntity>)}
      </MenuList>
    </Panel>
    <UiEntity uiTransform={{ width: 12, height: 1 }} />
    <Panel uiTransform={{ width: CRAFT_DETAILS_WIDTH, height: props.height, padding: 24, flexDirection: 'column' }}>
      <Label value={research.title} fontSize={22} color={UI_INK} uiTransform={{ width: '100%', height: 36, flexShrink: 0 }} />
      <Label value={investigationBypassed() ? 'ALL RECIPES UNLOCKED' : unlocked ? 'DISCOVERED' : research.level === 1 ? '◆  FOLLOW THE SURVIVAL GUIDE' : '◆  COMPLETE THE OBJECTIVE'} fontSize={14} color={yellow} uiTransform={{ width: '100%', height: 28, flexShrink: 0 }} />
      <Label value={research.description} fontSize={15} color={UI_MUTED} textAlign="top-left" uiTransform={{ width: '100%', height: 110, flexShrink: 0 }} />
      <MenuList id="investigation-rewards" height={props.height - 222} rowHeight={52}>
        {recipes.map(item => <UiEntity key={item.id} uiTransform={{ height: 48, margin: { bottom: 4 }, flexShrink: 0, flexDirection: 'row', alignItems: 'center' }}>
          <UiEntity uiTransform={{ width: 40, height: 40 }} uiBackground={{ texture: { src: item.texture }, textureMode: 'stretch' }} />
          <UiEntity uiTransform={{ flexGrow: 1, flexDirection: 'column', margin: { left: 8 } }}>
            <Label value={`${recipeUnlocked(item.id) ? '✓' : '◇'} ${item.name}`} color={UI_INK} fontSize={14} textAlign="middle-left" uiTransform={{ width: '100%', height: 24 }} />
            <Label value={CRAFT_STATION_NAMES[item.station ?? ''] ?? 'Basic crafting'} color={UI_MUTED} fontSize={12} textAlign="middle-left" uiTransform={{ width: '100%', height: 20 }} />
          </UiEntity>
        </UiEntity>)}
      </MenuList>
    </Panel>
  </UiEntity>
}
