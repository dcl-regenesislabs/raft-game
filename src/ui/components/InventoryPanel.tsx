import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { isCraftOpen } from '../craftToggle'
import {
  getSelectedDragSlot,
  isSwapModeActive,
  pressSlot
} from '../inventoryDrag'
import { isInventoryOpen } from '../inventoryToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_LAYOUT,
  getInventorySlot
} from '../items'
import {
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
import { ItemCountBadge } from './ItemCountBadge'

// Total cell count of the inventory-panel grid. Sourced from the shared
// linear layout so adjusting `items.ts` flows through to the UI.
const INVENTORY_GRID_TOTAL_CELLS = INVENTORY_LAYOUT.length - BOTTOM_BAR_SLOT_COUNT

// Fullscreen overlay holding the inventory grid, centered just above the
// bottom bar. Renders nothing while the inventory is closed.
export function InventoryPanel(): ReactEcs.JSX.Element | null {
  if (!isInventoryOpen()) return null
  // Mirror the bottom bar's mobile right-shift so the inventory's left edge
  // tracks the bar's left edge across platforms.
  const mobile = isMobile()
  const barShiftX = mobile ? Math.round(INVENTORY_PANEL_SIZE / 5) : 0
  return (
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
      <UiEntity uiTransform={{ margin: { left: barShiftX, bottom: '10%' } }}>
        <InventoryGrid />
      </UiEntity>
    </UiEntity>
  )
}

// 5×5 grid panel. Used both as the standalone inventory and as the smaller
// reference grid pinned next to the craft menu.
export function InventoryGrid(props: { size?: number }): ReactEcs.JSX.Element {
  const size = props.size ?? INVENTORY_PANEL_SIZE
  return (
    <UiEntity
      uiTransform={{ width: size, height: size }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: INVENTORY_PANEL_TEXTURE }
      }}
    >
      {Array.from({ length: INVENTORY_GRID_TOTAL_CELLS }, (_, i) => (
        <InventoryCell key={i} index={i} />
      ))}
    </UiEntity>
  )
}

function InventoryCell(props: {
  index: number
  key?: number | string
}): ReactEcs.JSX.Element {
  const col = props.index % INVENTORY_GRID_CELLS
  const row = Math.floor(props.index / INVENTORY_GRID_CELLS)
  // Position cells in percentages of the panel size, not absolute pixels.
  // The panel itself can be flex-shrunk on tall-vs-narrow viewports
  // (mobile especially), and a percentage-based layout tracks whatever
  // final size the panel actually renders at — so the cells stay aligned
  // with the painted background regardless of scaling.
  const halfCell = INVENTORY_CELL_SIZE_PCT / 2
  const leftPct = INVENTORY_CELL_CENTERS_PCT[col] - halfCell
  const topPct = INVENTORY_CELL_CENTERS_PCT[row] - halfCell

  // Grid cells are addressed in [0..24]; the global layout index sits
  // beyond the bottom bar so the swap system maps every UI cell back to
  // the single linear inventory.
  const globalIndex = BOTTOM_BAR_SLOT_COUNT + props.index
  const display = getInventorySlot(globalIndex)

  const swapActive = isSwapModeActive()
  const isSwapSelected = getSelectedDragSlot() === globalIndex
  const shouldShake = swapActive && !isSwapSelected && display !== null

  const inset = isSwapSelected
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
              texture: { src: display.texture }
            }}
          />
        )}
        <ItemCountBadge item={display} />
      </UiEntity>
    </UiEntity>
  )
}
