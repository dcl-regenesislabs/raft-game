import { Color4 } from '@dcl/sdk/math'
import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { equipInventorySlot } from '../../systems/nativeEquipment'
import { isSlotSelectable } from '../inventoryState'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { Panel } from '../panel'
import { UI_BORDER,UI_CELL,UI_GOLD,UI_INK,UI_MUTED,UI_PAPER } from '../visualTheme'

import { getPickedIngredient,pickIngredient } from '../cookSlots'
import { isCookOpen } from '../cookToggle'
import { isCraftOpen } from '../craftToggle'
import { getSelectedDragSlot,pressSlot } from '../inventoryDrag'
import { isEquipmentPickerOpen,isInventoryOpen,setInventoryOpen } from '../inventoryToggle'
import { INVENTORY_TOTAL_SLOTS,type ItemDef,getInventorySlot,getItemDisplayName } from '../items'
import { getStoragePicked,pressStorageSlot } from '../storageSession'
import { getActiveStorage,isStorageOpen } from '../storageToggle'
import {
COOK_NON_INGREDIENT_TINT,
GLOW_ALPHA_PEAK_BONUS,
GLOW_COLOR,
INVENTORY_ITEM_INSET_PCT,
INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED,
INVENTORY_PANEL_SIZE
} from '../theme'
import { CloseButton } from './CloseButton'
import { DurabilityBar } from './DurabilityBar'
import { ItemCountBadge } from './ItemCountBadge'

// Total cell count of the inventory-panel grid. Sourced from the shared
// linear layout so adjusting `items.ts` flows through to the UI.
const INVENTORY_GRID_TOTAL_CELLS = INVENTORY_TOTAL_SLOTS

// One safe-area backpack with twenty-five freely assignable slots.
export function InventoryPanel(): ReactEcs.JSX.Element | null {
  if (!isInventoryOpen() || isEquipmentPickerOpen()) return null
  const layout = getMobileLayout(true)
  const size = Math.min(720, layout.width - 32, layout.height - 112)
  const selected = getSelectedDragSlot()
  const item = selected === null ? null : getInventorySlot(selected)
  return (
    <Panel
      uiTransform={{
        positionType: 'absolute',
        position: { top: '50%', left: '50%' },
        margin: { left: -size / 2, top: -(size + 80) / 2 },
        width: size,
        flexDirection: 'column'
      }}
    >
      <UiEntity
        uiTransform={{ width: size, height: 80, padding: 12, borderRadius: 10 }}
      >
        <Label
          value="BACKPACK"
          fontSize={24}
          color={UI_INK}
          textAlign="middle-left"
          uiTransform={{ width: size - 80, height: 30 }}
        />
        <Label
          value={item ? getItemDisplayName(item) : 'Tap an item, then another slot to move it.'}
          fontSize={14}
          color={UI_MUTED}
          textAlign="middle-left"
          uiTransform={{ positionType: 'absolute', position: { top: 44, left: 12 }, width: size - 200, height: 24 }}
        />
        {selected !== null && isSlotSelectable(selected) && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { right: 72, top: 24 },
              width: 104,
              height: 42,
              borderRadius: 6
            }}
            uiBackground={{ color: UI_CELL }}
            onMouseDown={beginUiTouch}
            onMouseUp={() => {
              equipInventorySlot(selected)
            }}
          >
            <Label value="EQUIP" fontSize={16} color={UI_INK} uiTransform={{ width: '100%', height: '100%' }} />
          </UiEntity>
        )}
        <UiEntity uiTransform={{ positionType: 'absolute', position: { top: 12, right: 12 } }}>
          <CloseButton onPress={() => setInventoryOpen(false)} />
        </UiEntity>
      </UiEntity>
      <InventoryGrid size={size} />
    </Panel>
  )
}

// Five columns by five rows: all twenty-five inventory slots, without a separate hotbar.
export function InventoryGrid(props: { size?: number; filter?: (item: ItemDef) => boolean }): ReactEcs.JSX.Element {
  const size = props.size ?? INVENTORY_PANEL_SIZE
  const cells = buildGridCells(props.filter)
  return (
    <UiEntity
      uiTransform={{ width: size, height: size, borderRadius: 14 }}
      uiBackground={{
        color: UI_PAPER
      }}
    >
      {cells.map((cell) => (
        <InventoryCell key={cell.uiIndex} uiIndex={cell.uiIndex} globalIndex={cell.globalIndex} />
      ))}
    </UiEntity>
  )
}

interface GridCell {
  uiIndex: number
  globalIndex: number
}

// An optional filter packs matching inventory items without changing their slot IDs.
function buildGridCells(filter?: (item: ItemDef) => boolean): GridCell[] {
  if (filter === undefined) {
    return Array.from({ length: INVENTORY_GRID_TOTAL_CELLS }, (_, i) => ({
      uiIndex: i,
      globalIndex: i
    }))
  }
  const cells: GridCell[] = []
  for (
    let globalIndex = 0;
    globalIndex < INVENTORY_TOTAL_SLOTS && cells.length < INVENTORY_GRID_TOTAL_CELLS;
    globalIndex++
  ) {
    const item = getInventorySlot(globalIndex)
    if (item !== null && filter(item)) {
      cells.push({ uiIndex: cells.length, globalIndex })
    }
  }
  return cells
}

function InventoryCell(props: { uiIndex: number; globalIndex: number; key?: number | string }): ReactEcs.JSX.Element {
  const col = props.uiIndex % 5
  const row = Math.floor(props.uiIndex / 5)
  const leftPct = col * 20 + 1.2
  const topPct = row * 20 + 1.2

  const globalIndex = props.globalIndex
  const display = getInventorySlot(globalIndex)

  const cookOpen = isCookOpen()
  const storageOpen = isStorageOpen()
  const storagePicked = storageOpen ? getStoragePicked() : null
  const isStoragePickedHere =
    storagePicked !== null && storagePicked.side === 'player' && storagePicked.index === globalIndex
  const isSwapSelected = !cookOpen && !storageOpen && getSelectedDragSlot() === globalIndex
  const isCookPicked = cookOpen && display !== null && getPickedIngredient() === display.id
  const inset =
    isSwapSelected || isStoragePickedHere ? INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED : INVENTORY_ITEM_INSET_PCT

  const shake = { x: 0, y: 0 }

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: `${topPct}%`, left: `${leftPct}%` },
        width: '17.6%',
        height: '17.6%',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isSwapSelected || isStoragePickedHere || isCookPicked ? UI_GOLD : UI_BORDER
      }}
      uiBackground={{ color: UI_CELL }}
      onMouseDown={() => {
        beginUiTouch()
        // Inventory grid is read-only while the craft menu is open — no
        // selection, no swap, the player just sees their materials and
        // crafted stock alongside the recipe.
        if (isCraftOpen()) return
        // While the cook menu is open, clicking an inventory slot picks
        // up its item as the next placement instead of starting a swap.
        // Non-ingredient items are silently ignored by `pickIngredient`.
        if (isCookOpen()) {
          if (display !== null) pickIngredient(display.id)
          return
        }
        // While the storage menu is open, route clicks through the
        // dual-pane pick/place state machine instead of the regular
        // swap. The active storage entity is the transfer target.
        if (isStorageOpen()) {
          const active = getActiveStorage()
          if (active === null) return
          pressStorageSlot('player', globalIndex, active)
          return
        }
        pressSlot(globalIndex)
      }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: shake.y,
            left: shake.x,
            right: -shake.x,
            bottom: -shake.y
          }
        }}
      >
        {isSwapSelected && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { top: '4%', bottom: '4%', left: '4%', right: '4%' }
            }}
            uiBackground={{
              color: Color4.create(GLOW_COLOR.r, GLOW_COLOR.g, GLOW_COLOR.b, GLOW_ALPHA_PEAK_BONUS)
            }}
          />
        )}
        {display !== null && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: {
                top: `${inset}%`,
                bottom: `${inset}%`,
                left: `${inset}%`,
                right: `${inset}%`
              }
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: display.texture },
              // Dim non-ingredient icons while the cook menu is open so
              // the player sees at a glance which slots can be dropped
              // into a recipe and which can't.
              color: cookOpen && !display.ingredient ? COOK_NON_INGREDIENT_TINT : undefined
            }}
          />
        )}
        <ItemCountBadge item={display} />
        <DurabilityBar slotIndex={globalIndex} />
      </UiEntity>
    </UiEntity>
  )
}
