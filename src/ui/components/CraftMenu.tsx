import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import {
  CRAFTABLE_ITEMS,
  type CraftableItem,
  type MaterialCost,
  getCraftableById
} from '../craftableItems'
import {
  canStartCraft,
  startCraft
} from '../craftSession'
import {
  getSelectedCraftableId,
  isCraftOpen,
  selectCraftable
} from '../craftToggle'
import { getCollectedCount } from '../inventoryState'
import { getMaterialDef } from '../items'
import { Panel } from '../panel'
import { createPressPulse } from '../pressPulse'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_FRAME_H,
  CRAFT_BUTTON_FRAME_W,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_ICON,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_BUTTON_W,
  CRAFT_DETAILS_BASE_HEIGHT,
  CRAFT_DETAILS_ROW_HEIGHT,
  CRAFT_DETAILS_WIDTH,
  CRAFT_DIVIDER_COLOR,
  CRAFT_HAVE_LOW_COLOR,
  CRAFT_HAVE_OK_COLOR,
  CRAFT_INVENTORY_BOTTOM_DESKTOP,
  CRAFT_INVENTORY_LEFT,
  CRAFT_INVENTORY_LEFT_DESKTOP,
  CRAFT_INVENTORY_SIZE,
  CRAFT_INVENTORY_TOP,
  CRAFT_LIST_HEIGHT,
  CRAFT_LIST_WIDTH,
  CRAFT_PANEL_GAP,
  CRAFT_PANEL_PADDING_BOTTOM,
  CRAFT_PANEL_PADDING_TOP,
  CRAFT_PANEL_PADDING_X,
  CRAFT_ROW_SELECTED_BG,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR,
  CRAFT_TEXT_LIGHT_COLOR
} from '../theme'
import { InventoryWithBar } from './InventoryWithBar'

// Module-level pulse so the same animation clock survives across the
// React-ECS render rebuilds. Ticked by `pressPulseTickSystem` registered
// in `index.ts`.
const craftActionPulse = createPressPulse()

// Mobile: single horizontal row anchored to the top-left edge — mini
// inventory, recipe list, recipe details — flush against each other so
// the three elements read as one craft surface. The stats bars normally
// in the top-left corner are hidden while the craft menu is open, so
// this row is free to claim that real estate.
//
// Desktop: the mini inventory detaches and pins to the bottom-left
// (matching the stats bars' desktop anchor); the list + details cluster
// floats top-center.
//
// Renders nothing while closed.
export function CraftDoubleMenu(): ReactEcs.JSX.Element | null {
  if (!isCraftOpen()) return null
  if (isMobile()) {
    return (
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: CRAFT_INVENTORY_TOP, left: CRAFT_INVENTORY_LEFT },
          flexDirection: 'row',
          alignItems: 'flex-start'
        }}
      >
        <InventoryWithBar size={CRAFT_INVENTORY_SIZE} />
        <UiEntity uiTransform={{ width: CRAFT_PANEL_GAP, height: 1 }} />
        <CraftItemList />
        <UiEntity uiTransform={{ width: CRAFT_PANEL_GAP, height: 1 }} />
        <CraftDetails />
      </UiEntity>
    )
  }
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%'
      }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            bottom: CRAFT_INVENTORY_BOTTOM_DESKTOP,
            left: CRAFT_INVENTORY_LEFT_DESKTOP
          }
        }}
      >
        <InventoryWithBar size={CRAFT_INVENTORY_SIZE} />
      </UiEntity>
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          width: '100%',
          height: '100%',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}
      >
        <CraftItemList />
        <UiEntity uiTransform={{ width: CRAFT_PANEL_GAP, height: 1 }} />
        <CraftDetails />
      </UiEntity>
    </UiEntity>
  )
}

function CraftItemList(): ReactEcs.JSX.Element {
  // Mobile tucks the list a bit up-and-left so it visually meshes with
  // the mini inventory directly to its left. Desktop floats the
  // list+details cluster on its own at top-center, so the nudge would
  // just push it off-axis.
  const margin = isMobile() ? { left: -25, top: -60 } : undefined
  return (
    <Panel
      uiTransform={{
        width: CRAFT_LIST_WIDTH,
        height: CRAFT_LIST_HEIGHT,
        flexDirection: 'column',
        margin,
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
          height: 44,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 40, height: 40 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: CRAFT_BUTTON_ICON }
          }}
        />
        <Label
          value="CRAFT"
          fontSize={22}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-left"
          uiTransform={{ flexGrow: 1, height: '100%', margin: { left: 10 } }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 6, bottom: 8 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      {CRAFTABLE_ITEMS.map((item) => (
        <CraftItemRow key={item.id} item={item} />
      ))}
    </Panel>
  )
}

function CraftItemRow(props: {
  item: CraftableItem
  key?: number | string
}): ReactEcs.JSX.Element {
  const selected = getSelectedCraftableId() === props.item.id
  return (
    <UiEntity
      uiTransform={{
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 4 },
        padding: { left: 8, right: 8 }
      }}
      uiBackground={selected ? { color: CRAFT_ROW_SELECTED_BG } : undefined}
      onMouseDown={() => selectCraftable(props.item.id)}
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
    </UiEntity>
  )
}

function CraftDetails(): ReactEcs.JSX.Element | null {
  const id = getSelectedCraftableId()
  const item = id !== null ? getCraftableById(id) : null
  if (item === null) return null
  // Detail panel grows with the recipe so the wood frame hugs the content
  // rather than leaving an empty stretch under short recipes.
  const height =
    CRAFT_DETAILS_BASE_HEIGHT + CRAFT_DETAILS_ROW_HEIGHT * item.cost.length
  return (
    <Panel
      uiTransform={{
        width: CRAFT_DETAILS_WIDTH,
        height,
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
          height: 44,
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
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 6, bottom: 8 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      <Label
        value={item.description}
        fontSize={13}
        color={CRAFT_TEXT_DIM_COLOR}
        textAlign="top-left"
        uiTransform={{ width: '100%', height: 80 }}
      />
      <UiEntity
        uiTransform={{
          height: CRAFT_BUTTON_FRAME_H + 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: { top: 4, bottom: 4 }
        }}
      >
        <Label
          value="REQUIRES"
          fontSize={16}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-left"
          uiTransform={{ height: '100%' }}
        />
        <CraftActionButton item={item} />
      </UiEntity>
      {item.cost.map((cost) => (
        <CraftCostRow key={cost.materialId} cost={cost} />
      ))}
    </Panel>
  )
}

function CraftActionButton(props: {
  item: CraftableItem
}): ReactEcs.JSX.Element {
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
          width: w,
          height: h,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          // Dim the button when materials are short so the player gets a
          // visual cue that pressing it won't start a craft.
          color: enabled
            ? Color4.create(1, 1, 1, 1)
            : Color4.create(1, 1, 1, 0.45)
        }}
        onMouseDown={() => {
          if (!enabled) return
          craftActionPulse.press()
          startCraft(props.item.id)
        }}
      >
        <Label
          value="CRAFT"
          fontSize={13}
          color={CRAFT_BUTTON_FG}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function CraftCostRow(props: {
  cost: MaterialCost
  key?: number | string
}): ReactEcs.JSX.Element {
  const def = getMaterialDef(props.cost.materialId)
  const have = getCollectedCount(props.cost.materialId)
  const enough = have >= props.cost.amount
  const label = def?.id.toUpperCase() ?? props.cost.materialId.toUpperCase()
  const texture = def?.texture
  return (
    <UiEntity
      uiTransform={{
        height: CRAFT_DETAILS_ROW_HEIGHT - 8,
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
        uiTransform={{ height: '100%' }}
      />
    </UiEntity>
  )
}
