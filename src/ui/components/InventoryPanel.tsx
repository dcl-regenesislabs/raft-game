import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import { isCookOpen } from '../cookToggle'
import { getPickedIngredient, pickIngredient } from '../cookSlots'
import { isCraftOpen } from '../craftToggle'
import {
  getSelectedDragSlot,
  isSwapModeActive,
  pressSlot
} from '../inventoryDrag'
import { isInventoryOpen, setInventoryOpen } from '../inventoryToggle'
import { getActiveStorage, isStorageOpen } from '../storageToggle'
import { getStoragePicked, pressStorageSlot } from '../storageSession'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_LAYOUT,
  INVENTORY_TOTAL_SLOTS,
  type ItemDef,
  getInventorySlot,
  getItemDisplayName
} from '../items'
import {
  BAR_BOTTOM,
  CLOSE_BUTTON_INVENTORY_RIGHT,
  CLOSE_BUTTON_INVENTORY_TOP,
  COOK_NON_INGREDIENT_TINT,
  GLOW_ALPHA_PEAK_BONUS,
  GLOW_COLOR,
  INVENTORY_CELL_CENTERS_PCT,
  INVENTORY_CELL_SIZE_PCT,
  INVENTORY_GRID_CELLS,
  INVENTORY_ITEM_INSET_PCT,
  INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED,
  INVENTORY_PANEL_SIZE,
  INVENTORY_PANEL_TEXTURE
} from '../theme'
import { shakeOffset } from '../utils/shake'
import { CloseButton } from './CloseButton'
import { InventoryWithBar } from './InventoryWithBar'
import { ItemCountBadge } from './ItemCountBadge'

// Total cell count of the inventory-panel grid. Sourced from the shared
// linear layout so adjusting `items.ts` flows through to the UI.
const INVENTORY_GRID_TOTAL_CELLS = INVENTORY_LAYOUT.length - BOTTOM_BAR_SLOT_COUNT

// Bottom-center panel: 5×5 inventory grid stacked on top of the 5-slot
// hot-bar. Anchored where the standalone `BottomBar` normally lives so the
// hot-bar visually stays put when the inventory opens — the grid grows
// upward from the bar. The standalone `BottomBar` is hidden by `ui()`
// while the inventory is open so the bar shown here is the only one.
// Renders nothing while the inventory is closed.
export function InventoryPanel(): ReactEcs.JSX.Element | null {
  if (!isInventoryOpen()) return null
  // Close button overlaps the inventory's painted top-right wood frame
  // so the player has a clear "close this panel" affordance without an
  // added header bar — the inventory grid itself has no title space to
  // share, unlike the craft and cook panels. Tune the offsets via
  // CLOSE_BUTTON_INVENTORY_TOP / CLOSE_BUTTON_INVENTORY_RIGHT in theme.ts.
  const selectedDrag = getSelectedDragSlot()
  const selectedItem =
    selectedDrag !== null ? getInventorySlot(selectedDrag) : null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: BAR_BOTTOM, left: '50%' },
        margin: { left: -Math.round(INVENTORY_PANEL_SIZE / 2) }
      }}
    >
      <InventoryWithBar />
      {selectedItem !== null && (
        <SelectedItemLabel value={getItemDisplayName(selectedItem)} />
      )}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: CLOSE_BUTTON_INVENTORY_TOP,
            right: CLOSE_BUTTON_INVENTORY_RIGHT
          }
        }}
      >
        <CloseButton onPress={() => setInventoryOpen(false)} />
      </UiEntity>
    </UiEntity>
  )
}

// Persistent label that surfaces the name of the slot currently picked
// up for swapping. Anchored on the visual seam between the inventory
// grid and the hot-bar so it reads as a caption tying the two halves
// together. Rendered AFTER `InventoryWithBar` in the parent so it draws
// on top of the bar's painted top frame instead of being occluded.
function SelectedItemLabel(props: { value: string }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: INVENTORY_PANEL_SIZE - 42, left: 0 },
        width: INVENTORY_PANEL_SIZE,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          height: 24,
          padding: { left: 14, right: 14 },
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
      >
        <Label value={props.value} fontSize={14} color={Color4.White()} />
      </UiEntity>
    </UiEntity>
  )
}

// 5×5 grid panel. Used both as the standalone inventory and as the smaller
// reference grid pinned next to the craft / cook menus.
//
// `filter`, when set, switches the grid into "smart inventory" mode: the
// 30-slot linear inventory is scanned and only matching items are
// rendered, packed top-left into the grid in slot order. Non-matching
// items aren't rendered at all — the player sees just what's relevant
// for the current task. Without a filter the grid keeps its classic
// behaviour: the 25 grid slots (`BOTTOM_BAR_SLOT_COUNT`..) map 1:1 to
// UI cells and hot-bar slots are surfaced separately by `BottomBarSurface`.
export function InventoryGrid(props: {
  size?: number
  filter?: (item: ItemDef) => boolean
}): ReactEcs.JSX.Element {
  const size = props.size ?? INVENTORY_PANEL_SIZE
  const cells = buildGridCells(props.filter)
  return (
    <UiEntity
      uiTransform={{ width: size, height: size }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: INVENTORY_PANEL_TEXTURE }
      }}
    >
      {cells.map((cell) => (
        <InventoryCell
          key={cell.uiIndex}
          uiIndex={cell.uiIndex}
          globalIndex={cell.globalIndex}
        />
      ))}
    </UiEntity>
  )
}

interface GridCell {
  uiIndex: number
  globalIndex: number
}

// Decide which (UI position, global slot) pairs to render this frame.
// Without a filter the mapping is the historical one: UI cell `i` shows
// global slot `BOTTOM_BAR_SLOT_COUNT + i`. With a filter we scan every
// slot (including the hot-bar 0..4) and pack matching ones into UI
// cells starting at the top-left.
function buildGridCells(filter?: (item: ItemDef) => boolean): GridCell[] {
  if (filter === undefined) {
    return Array.from({ length: INVENTORY_GRID_TOTAL_CELLS }, (_, i) => ({
      uiIndex: i,
      globalIndex: BOTTOM_BAR_SLOT_COUNT + i
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

function InventoryCell(props: {
  uiIndex: number
  globalIndex: number
  key?: number | string
}): ReactEcs.JSX.Element {
  const col = props.uiIndex % INVENTORY_GRID_CELLS
  const row = Math.floor(props.uiIndex / INVENTORY_GRID_CELLS)
  // Position cells in percentages of the panel size, not absolute pixels.
  // The panel itself can be flex-shrunk on tall-vs-narrow viewports
  // (mobile especially), and a percentage-based layout tracks whatever
  // final size the panel actually renders at — so the cells stay aligned
  // with the painted background regardless of scaling.
  const halfCell = INVENTORY_CELL_SIZE_PCT / 2
  const leftPct = INVENTORY_CELL_CENTERS_PCT[col] - halfCell
  const topPct = INVENTORY_CELL_CENTERS_PCT[row] - halfCell

  const globalIndex = props.globalIndex
  const display = getInventorySlot(globalIndex)

  const cookOpen = isCookOpen()
  const storageOpen = isStorageOpen()
  const storagePicked = storageOpen ? getStoragePicked() : null
  const isStoragePickedHere =
    storagePicked !== null &&
    storagePicked.side === 'player' &&
    storagePicked.index === globalIndex
  const swapActive = !cookOpen && !storageOpen && isSwapModeActive()
  const isSwapSelected =
    !cookOpen && !storageOpen && getSelectedDragSlot() === globalIndex
  const isCookPicked =
    cookOpen && display !== null && getPickedIngredient() === display.id
  const shouldShake =
    (swapActive && !isSwapSelected && display !== null) ||
    isCookPicked ||
    (storageOpen &&
      storagePicked !== null &&
      !isStoragePickedHere &&
      display !== null)

  const inset =
    isSwapSelected || isStoragePickedHere
      ? INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED
      : INVENTORY_ITEM_INSET_PCT

  const shake = shouldShake
    ? shakeOffset(Date.now() / 1000)
    : { x: 0, y: 0 }

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: `${topPct}%`, left: `${leftPct}%` },
        width: `${INVENTORY_CELL_SIZE_PCT}%`,
        height: `${INVENTORY_CELL_SIZE_PCT}%`
      }}
      onMouseDown={() => {
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
              color: Color4.create(
                GLOW_COLOR.r,
                GLOW_COLOR.g,
                GLOW_COLOR.b,
                GLOW_ALPHA_PEAK_BONUS
              )
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
              color:
                cookOpen && !display.ingredient
                  ? COOK_NON_INGREDIENT_TINT
                  : undefined
            }}
          />
        )}
        <ItemCountBadge item={display} />
      </UiEntity>
    </UiEntity>
  )
}
