import { Color4 } from '@dcl/sdk/math'
import { guidedRecipe } from '../../progression/state'
import { InvestigationPanels } from './Investigation'
import { getCraftContextKind } from '../craftContext'
import { CRAFT_STATION_NAMES, getExpansionItem } from '../../expansion/catalog'
import {
  filterCraftRecipes,
  getCraftCategories,
  getCraftCategoryIcon,
  resolveCraftSelection,
  type CraftFilter
} from '../craftCategories'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { UI_ACCENT, UI_CELL, UI_INK } from '../visualTheme'
import { MenuList, resetMenuPage, revealMenuItem } from './MenuList'

import { type CraftableItem, type MaterialCost, getCraftableById } from '../craftableItems'
import { canStartCraft, getCraftBlockReason, startCraft } from '../craftSession'
import { craftOpenRevision, craftGuidePulse, getSelectedCraftableId, isCraftOpen, selectCraftable, setCraftOpen } from '../craftToggle'
import { getMaterialDef } from '../items'
import { Panel } from '../panel'
import { createPressPulse } from '../pressPulse'
import { getCombinedCount } from '../storageSession'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_FRAME_H,
  CRAFT_BUTTON_FRAME_W,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_W,
  CRAFT_DETAILS_ROW_HEIGHT,
  CRAFT_DETAILS_WIDTH,
  CRAFT_DIVIDER_COLOR,
  CRAFT_HAVE_LOW_COLOR,
  CRAFT_HAVE_OK_COLOR,
  CRAFT_LIST_HEIGHT,
  CRAFT_LIST_WIDTH,
  CRAFT_PANEL_PADDING_BOTTOM,
  CRAFT_PANEL_PADDING_TOP,
  CRAFT_PANEL_PADDING_X,
  CRAFT_ROW_SELECTED_BG,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR,
  CRAFT_TEXT_LIGHT_COLOR
} from '../theme'
import { CloseButton } from './CloseButton'

// Module-level pulse so the same animation clock survives across the
// React-ECS render rebuilds. Ticked by `pressPulseTickSystem` registered
// in `index.ts`.
const craftActionPulse = createPressPulse()

let category: CraftFilter = 'resources'
let lastOpen = -1
const GUIDE_YELLOW = Color4.create(1, 0.78, 0.22, 1)
function GuideMarker(): ReactEcs.JSX.Element {
  return <Label value="◆" fontSize={18 + 7 * craftGuidePulse()} color={GUIDE_YELLOW} uiTransform={{ width: 24, height: 24, flexShrink: 0 }} />
}
let lastContext: string | null | undefined = undefined

function chooseCategory(next: CraftFilter): void {
  beginUiTouch()
  if (category !== next) {
    category = next
    resetMenuPage('craft-recipes')
    selectCraftable(null)
  }
}

export function CraftDoubleMenu(): ReactEcs.JSX.Element | null {
  if (!isCraftOpen()) {
    return null
  }
  const context = getCraftContextKind()
  const opening = context !== lastContext || lastOpen !== craftOpenRevision()
  if (opening) {
    lastOpen = craftOpenRevision()
    const target = getCraftableById(guidedRecipe() ?? '')
    category = target && (target.station ?? null) === context ? target.category : getCraftCategories().find(c => c.id !== 'investigation')?.id ?? 'investigation'
    lastContext = context
    resetMenuPage('craft-recipes')
    resetMenuPage('craft-categories')
    selectCraftable(target && target.category === category ? target.id : null)
  }
  if (!getCraftCategories().some((entry) => entry.id === category)) category = getCraftCategories()[0].id
  const area = getMobileLayout()
  const listHeight = Math.min(CRAFT_LIST_HEIGHT, area.height - 32)
  const recipes = filterCraftRecipes(category)
  if (opening) {
    const categories = getCraftCategories()
    revealMenuItem('craft-categories', categories.findIndex(c => c.id === category), categories.length, listHeight - 24, 64, true)
    revealMenuItem('craft-recipes', recipes.findIndex(item => item.id === guidedRecipe()), recipes.length, listHeight - 104, 54)
  }
  selectCraftable(resolveCraftSelection(recipes, getSelectedCraftableId()))
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
      }}
    >
      <Panel
        accent={false}
        uiTransform={{ width: 212, height: listHeight, flexShrink: 0, padding: 12, flexDirection: 'column', margin: { right: 12 } }}
      >
        <CategoryList height={listHeight - 24} />
      </Panel>
      {category === 'investigation' ? <InvestigationPanels height={listHeight} /> : <UiEntity uiTransform={{ flexDirection: 'row' }}>
        <CraftItemList listHeight={listHeight} recipes={recipes} />
        <UiEntity uiTransform={{ width: 12, height: 1 }} />
        <CraftDetails listHeight={listHeight} />
      </UiEntity>}
    </UiEntity>
  )
}

function CategoryList(props: { height: number }): ReactEcs.JSX.Element {
  return (
    <MenuList id="craft-categories" height={props.height} rowHeight={64} compact>
      {getCraftCategories().map((entry) => (
        <UiEntity
          key={entry.id}
          uiTransform={{
            width: '100%',
            height: 56,
            flexDirection: 'row',
            padding: { left: 8, right: 8 },
            flexShrink: 0,
            margin: { bottom: 8 },
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'flex-start'
          }}
          uiBackground={{ color: category === entry.id ? UI_ACCENT : UI_CELL }}
          onMouseDown={beginUiTouch}
          onMouseUp={() => chooseCategory(entry.id)}
        >
          {getCraftableById(guidedRecipe() ?? '')?.category === entry.id && <UiEntity uiTransform={{ positionType: 'absolute', position: { top: -5, right: -5 } }}><GuideMarker /></UiEntity>}
          <UiEntity
            uiTransform={{ width: 40, height: 40, flexShrink: 0 }}
            uiBackground={{ textureMode: 'stretch', texture: { src: getCraftCategoryIcon(entry.id) } }}
          />
          <Label
            value={entry.name}
            fontSize={14}
            color={UI_INK}
            textAlign="middle-left"
            uiTransform={{ flexGrow: 1, height: 52, margin: { left: 8 } }}
          />
        </UiEntity>
      ))}
    </MenuList>
  )
}

function CraftItemList(props: { listHeight: number; recipes: readonly CraftableItem[] }): ReactEcs.JSX.Element {
  const stationName = CRAFT_STATION_NAMES[getCraftContextKind() ?? ''] ?? 'Basic crafting'
  const categoryName =
    getCraftCategories().find((entry) => entry.id === category)?.name ?? stationName
  const contentHeight = props.listHeight - 104
  return (
    <Panel uiTransform={{ width: CRAFT_LIST_WIDTH, height: props.listHeight, flexDirection: 'column', padding: 24 }}>
      <UiEntity uiTransform={{ height: 48, flexShrink: 0, flexDirection: 'row', alignItems: 'center' }}>
        <Label
          value={categoryName}
          fontSize={20}
          color={UI_INK}
          textAlign="middle-left"
          uiTransform={{ flexGrow: 1, height: 48 }}
        />
        <CloseButton onPress={() => setCraftOpen(false)} />
      </UiEntity>
      {props.recipes.length === 0 ? (
        <Label
          value="No recipes in this category."
          fontSize={16}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="top-left"
          uiTransform={{ width: '100%', height: contentHeight }}
        />
      ) : (
        <MenuList id="craft-recipes" height={contentHeight} rowHeight={54}>
          {props.recipes.map((item) => (
            <CraftItemRow key={item.id} item={item} />
          ))}
        </MenuList>
      )}
    </Panel>
  )
}

function CraftItemRow(props: { item: CraftableItem; key?: number | string }): ReactEcs.JSX.Element {
  const selected = getSelectedCraftableId() === props.item.id
  const guided = guidedRecipe() === props.item.id
  return (
    <UiEntity
      uiTransform={{
        height: 50,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 4 },
        padding: { left: 8, right: 8 },
        borderRadius: 8
      }}
      uiBackground={guided && craftGuidePulse() > 0 ? { color: Color4.create(0.55 + craftGuidePulse() * 0.3, 0.43, 0.15, 0.55) } : selected ? { color: CRAFT_ROW_SELECTED_BG } : undefined}
      onMouseDown={beginUiTouch}
      onMouseUp={() => selectCraftable(props.item.id)}
    >
      <UiEntity
        uiTransform={{ width: 44, height: 44 }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: props.item.texture }
        }}
      />
      <Label
        value={props.item.name}
        fontSize={16}
        color={selected ? CRAFT_TEXT_LIGHT_COLOR : CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ flexGrow: 1, height: '100%', margin: { left: 10 } }}
      />
      {guided && <GuideMarker />}
      <Label
        value={canStartCraft(props.item.id) ? '✓' : '—'}
        fontSize={16}
        color={canStartCraft(props.item.id) ? CRAFT_HAVE_OK_COLOR : CRAFT_TEXT_DIM_COLOR}
        uiTransform={{ width: 24, height: 44, flexShrink: 0 }}
      />
    </UiEntity>
  )
}

function CraftDetails(props: { listHeight: number }): ReactEcs.JSX.Element | null {
  const id = getSelectedCraftableId()
  const item = id !== null ? getCraftableById(id) : null
  if (item === null)
    return (
      <Panel uiTransform={{ width: CRAFT_DETAILS_WIDTH, height: props.listHeight, padding: 24 }}>
        <Label
          value="Choose a recipe to see its materials and craft it."
          fontSize={18}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="top-left"
          uiTransform={{ width: '100%', height: 120 }}
        />
      </Panel>
    )
  return (
    <Panel
      uiTransform={{
        width: CRAFT_DETAILS_WIDTH,
        height: props.listHeight,
        flexDirection: 'column',
        padding: {
          top: CRAFT_PANEL_PADDING_TOP,
          bottom: CRAFT_PANEL_PADDING_BOTTOM,
          left: CRAFT_PANEL_PADDING_X,
          right: CRAFT_PANEL_PADDING_X
        }
      }}
    >
      <UiEntity
        uiTransform={{
          height: 48,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 44, height: 44 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: item.texture }
          }}
        />
        <Label
          value={item.name}
          fontSize={20}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-left"
          uiTransform={{ flexGrow: 1, height: '100%', margin: { left: 10 } }}
        />
      </UiEntity>
      {guidedRecipe() === item.id && <Label value="◆  NEXT OBJECTIVE" fontSize={14} color={GUIDE_YELLOW} uiTransform={{ width: '100%', height: 26, flexShrink: 0 }} />}
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 6, bottom: 8 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      <UiEntity uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column', overflow: 'scroll' }}>
        <Label
          value={item.description}
          fontSize={15}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="top-left"
          uiTransform={{ width: '100%', height: 128, flexShrink: 0 }}
        />
        {item.cost.map((cost) => (
          <CraftCostRow key={cost.materialId} cost={cost} />
        ))}
      </UiEntity>
      <UiEntity
        uiTransform={{
          height: CRAFT_BUTTON_FRAME_H + 6,
          flexShrink: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: { top: 4, bottom: 4 }
        }}
      >
        <Label
          value={`MAKES ${item.outputCount ?? 1}`}
          fontSize={16}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-left"
          uiTransform={{ width: 100, height: '100%' }}
        />
        <CraftActionButton item={item} />
      </UiEntity>
    </Panel>
  )
}

function CraftActionButton(props: { item: CraftableItem }): ReactEcs.JSX.Element {
  const scale = craftActionPulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * scale)
  const h = Math.round(CRAFT_BUTTON_H * scale)
  const enabled = canStartCraft(props.item.id)
  return (
    <UiEntity
      uiTransform={{
        width: CRAFT_BUTTON_FRAME_W,
        height: CRAFT_BUTTON_FRAME_H,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          borderRadius: 10,
          width: w,
          height: h,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          // Dim the button when materials are short so the player gets a
          // visual cue that pressing it won't start a craft.
          color: enabled ? UI_ACCENT : UI_CELL
        }}
        onMouseDown={beginUiTouch}
        onMouseUp={() => {
          if (!enabled) return
          craftActionPulse.press()
          startCraft(props.item.id)
        }}
      >
        <Label
          value={getCraftBlockReason(props.item.id) ?? 'CRAFT'}
          fontSize={15}
          color={enabled ? CRAFT_BUTTON_FG : UI_INK}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function CraftCostRow(props: { cost: MaterialCost; key?: number | string }): ReactEcs.JSX.Element {
  const def = getMaterialDef(props.cost.materialId)
  // Uses the same player + storage total as canStartCraft.
  const have = getCombinedCount(props.cost.materialId)
  const enough = have >= props.cost.amount
  const label = (
    getExpansionItem(props.cost.materialId)?.name ?? props.cost.materialId.replace(/_/g, ' ')
  ).toUpperCase()
  const texture = def?.texture
  return (
    <UiEntity
      uiTransform={{
        height: CRAFT_DETAILS_ROW_HEIGHT - 8,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 8 }
      }}
    >
      {texture !== undefined && (
        <UiEntity
          uiTransform={{ width: 36, height: 36 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: texture }
          }}
        />
      )}
      <Label
        value={label}
        fontSize={14}
        color={CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ flexGrow: 1, height: '100%', margin: { left: 8 } }}
      />
      <Label
        value={`${have}/${props.cost.amount}`}
        fontSize={15}
        color={enough ? CRAFT_HAVE_OK_COLOR : CRAFT_HAVE_LOW_COLOR}
        textAlign="middle-right"
        uiTransform={{ width: 100, height: '100%' }}
      />
    </UiEntity>
  )
}
