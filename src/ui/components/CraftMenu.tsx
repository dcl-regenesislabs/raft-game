import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

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
  CRAFT_BUTTON_SLICE,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_BUTTON_W,
  CRAFT_DETAILS_BASE_HEIGHT,
  CRAFT_DETAILS_ROW_HEIGHT,
  CRAFT_DETAILS_WIDTH,
  CRAFT_DIVIDER_COLOR,
  CRAFT_HAVE_LOW_COLOR,
  CRAFT_HAVE_OK_COLOR,
  CRAFT_INVENTORY_BOTTOM,
  CRAFT_INVENTORY_LEFT,
  CRAFT_INVENTORY_LEFT_MOBILE,
  CRAFT_INVENTORY_SIZE,
  CRAFT_INVENTORY_SIZE_MOBILE,
  CRAFT_INVENTORY_TOP_MOBILE,
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
import { InventoryGrid } from './InventoryPanel'

// Module-level pulse so the same animation clock survives across the
// React-ECS render rebuilds. Ticked by `pressPulseTickSystem` registered
// in `index.ts`.
const craftActionPulse = createPressPulse()

// Two-pane menu: recipe list on the left, recipe details on the right,
// with a smaller copy of the inventory grid pinned to the bottom-left
// corner so the player can see their materials. Renders nothing while
// closed.
export function CraftDoubleMenu(): ReactEcs.JSX.Element | null {
  if (!isCraftOpen()) return null
  const mobile = isMobile()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%'
      }}
    >
      {/* Inventory pinned to the bottom-left on desktop. On mobile the
          bottom-left is reserved for the joystick, so the grid moves to
          the top-left where the (now hidden) stats bars normally sit. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: mobile
            ? {
                top: CRAFT_INVENTORY_TOP_MOBILE,
                left: CRAFT_INVENTORY_LEFT_MOBILE
              }
            : {
                bottom: CRAFT_INVENTORY_BOTTOM,
                left: CRAFT_INVENTORY_LEFT
              }
        }}
      >
        <InventoryGrid
          size={mobile ? CRAFT_INVENTORY_SIZE_MOBILE : CRAFT_INVENTORY_SIZE}
        />
      </UiEntity>
      {/* List + details centered in the middle of the screen. The bottom
          margin lifts them off the bottom bar. */}
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
            flexDirection: 'row',
            alignItems: 'center',
            margin: { bottom: '8%' }
          }}
        >
          <CraftItemList />
          <UiEntity uiTransform={{ width: CRAFT_PANEL_GAP, height: 1 }} />
          <CraftDetails />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function CraftItemList(): ReactEcs.JSX.Element {
  return (
    <Panel
      uiTransform={{
        width: CRAFT_LIST_WIDTH,
        height: CRAFT_LIST_HEIGHT,
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
          height: 36,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 32, height: 32 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: CRAFT_BUTTON_ICON }
          }}
        />
        <Label
          value="CRAFT"
          fontSize={18}
          color={CRAFT_TEXT_COLOR}
          uiTransform={{ margin: { left: 8 } }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 4, bottom: 6 }
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
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 3 },
        padding: { left: 6, right: 6 }
      }}
      uiBackground={selected ? { color: CRAFT_ROW_SELECTED_BG } : undefined}
      onMouseDown={() => selectCraftable(props.item.id)}
    >
      <UiEntity
        uiTransform={{ width: 34, height: 34 }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: props.item.texture }
        }}
      />
      <Label
        value={props.item.name}
        fontSize={13}
        color={selected ? CRAFT_TEXT_LIGHT_COLOR : CRAFT_TEXT_COLOR}
        uiTransform={{ flexGrow: 1, margin: { left: 8 } }}
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
          uiTransform={{ margin: { left: 10 } }}
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
        <Label value="REQUIRES" fontSize={16} color={CRAFT_TEXT_COLOR} />
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
          textureMode: 'nine-slices',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          textureSlices: {
            top: CRAFT_BUTTON_SLICE,
            right: CRAFT_BUTTON_SLICE,
            bottom: CRAFT_BUTTON_SLICE,
            left: CRAFT_BUTTON_SLICE
          },
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
        <Label value="CRAFT" fontSize={13} color={CRAFT_BUTTON_FG} />
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
        uiTransform={{ flexGrow: 1, margin: { left: 8 } }}
      />
      <Label
        value={`${have}/${props.cost.amount}`}
        fontSize={15}
        color={enough ? CRAFT_HAVE_OK_COLOR : CRAFT_HAVE_LOW_COLOR}
      />
    </UiEntity>
  )
}
