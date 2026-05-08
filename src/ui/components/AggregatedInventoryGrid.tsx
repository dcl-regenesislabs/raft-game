import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getPickedIngredient, pickIngredient } from '../cookSlots'
import { isCookOpen } from '../cookToggle'
import { isCraftOpen } from '../craftToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_TOTAL_SLOTS,
  type ItemDef,
  getCatalogItem,
  getInventorySlot
} from '../items'
import { collectStorageItemIds, getCombinedCount } from '../storageSession'
import {
  COUNT_BADGE_BG,
  COUNT_BADGE_FG,
  INVENTORY_CELL_CENTERS_PCT,
  INVENTORY_CELL_SIZE_PCT,
  INVENTORY_GRID_CELLS,
  INVENTORY_ITEM_INSET_PCT,
  INVENTORY_PANEL_SIZE,
  INVENTORY_PANEL_TEXTURE
} from '../theme'
import { shakeOffset } from '../utils/shake'

// Inventory grid variant for the cook and craft menus. One cell per
// distinct stackable item id present anywhere — player inventory or any
// placed storage — with the count badge summing player + every storage.
//
// Behaviour matches the regular `InventoryGrid` filter mode (only
// matching items render, packed top-left), but cells are keyed by item
// id instead of inventory slot index. Items the player no longer
// carries personally still appear if a storage holds some.
//
// Click behaviour piggybacks on the cook menu's existing
// `pickIngredient` flow. Picking is still gated by the player's pocket
// count (`pickIngredient` rejects when 0) — the COOK button likewise
// stays disabled until materials are physically in the player's
// inventory. The aggregated badge is awareness-only; it does not unlock
// either action. The craft menu treats the grid as read-only.
const INVENTORY_GRID_TOTAL_CELLS =
  INVENTORY_TOTAL_SLOTS - BOTTOM_BAR_SLOT_COUNT

interface AggregatedCell {
  item: ItemDef
  count: number
}

export function AggregatedInventoryGrid(props: {
  size?: number
  filter?: (item: ItemDef) => boolean
}): ReactEcs.JSX.Element {
  const size = props.size ?? INVENTORY_PANEL_SIZE
  const cells = buildAggregatedCells(props.filter)
  return (
    <UiEntity
      uiTransform={{ width: size, height: size }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: INVENTORY_PANEL_TEXTURE }
      }}
    >
      {cells.map((cell, i) => (
        <AggregatedInventoryCell
          key={cell.item.id}
          uiIndex={i}
          item={cell.item}
          count={cell.count}
        />
      ))}
    </UiEntity>
  )
}

function buildAggregatedCells(
  filter?: (item: ItemDef) => boolean
): AggregatedCell[] {
  const cells: AggregatedCell[] = []
  const seen = new Set<string>()
  // Player inventory first, in slot order, so layouts stay stable across
  // pickups and storage motion.
  for (
    let slot = 0;
    slot < INVENTORY_TOTAL_SLOTS && cells.length < INVENTORY_GRID_TOTAL_CELLS;
    slot++
  ) {
    const item = getInventorySlot(slot)
    if (item === null) continue
    if (!item.stackable) continue
    if (seen.has(item.id)) continue
    if (filter !== undefined && !filter(item)) continue
    seen.add(item.id)
    cells.push({ item, count: getCombinedCount(item.id) })
  }
  // Storage-only items (the player no longer carries any but a chest
  // does) appended after the player's items so the player's familiar
  // layout doesn't shift when storage contents change.
  const storageIds = collectStorageItemIds()
  for (const id of storageIds) {
    if (cells.length >= INVENTORY_GRID_TOTAL_CELLS) break
    if (seen.has(id)) continue
    const item = getCatalogItem(id)
    if (item === null) continue
    if (!item.stackable) continue
    if (filter !== undefined && !filter(item)) continue
    seen.add(id)
    cells.push({ item, count: getCombinedCount(id) })
  }
  return cells
}

function AggregatedInventoryCell(props: {
  uiIndex: number
  item: ItemDef
  count: number
  key?: number | string
}): ReactEcs.JSX.Element {
  const col = props.uiIndex % INVENTORY_GRID_CELLS
  const row = Math.floor(props.uiIndex / INVENTORY_GRID_CELLS)
  const halfCell = INVENTORY_CELL_SIZE_PCT / 2
  const leftPct = INVENTORY_CELL_CENTERS_PCT[col] - halfCell
  const topPct = INVENTORY_CELL_CENTERS_PCT[row] - halfCell

  const cookOpen = isCookOpen()
  const picked = cookOpen ? getPickedIngredient() : null
  const isPicked = picked !== null && picked === props.item.id
  const shouldShake = picked !== null && !isPicked

  const inset = INVENTORY_ITEM_INSET_PCT
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
        if (isCraftOpen()) return
        if (isCookOpen()) pickIngredient(props.item.id)
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
            texture: { src: props.item.texture }
          }}
        />
        {props.count > 0 && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { bottom: '4%', right: '4%' },
              minWidth: 20,
              height: 20,
              padding: { left: 4, right: 4 },
              alignItems: 'center',
              justifyContent: 'center'
            }}
            uiBackground={{ color: COUNT_BADGE_BG }}
          >
            <Label
              value={`${props.count}`}
              fontSize={14}
              color={COUNT_BADGE_FG}
            />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  )
}
