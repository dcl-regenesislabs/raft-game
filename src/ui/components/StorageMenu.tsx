import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import {
  closeStorageMenu,
  getActiveStorage,
  isStorageOpen
} from '../storageToggle'
import {
  getStoragePicked,
  getStorageSlotCount,
  pressStorageSlot,
  readStorageSlot
} from '../storageSession'
import { getCatalogItem } from '../items'
import { Panel } from '../panel'
import {
  CRAFT_TEXT_COLOR,
  COUNT_BADGE_BG,
  COUNT_BADGE_FG,
  GLOW_ALPHA_PEAK_BONUS,
  GLOW_COLOR,
  INVENTORY_CELL_CENTERS_PCT,
  INVENTORY_CELL_SIZE_PCT,
  INVENTORY_GRID_CELLS,
  INVENTORY_ITEM_INSET_PCT,
  INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED,
  INVENTORY_PANEL_TEXTURE
} from '../theme'

// Storage menu uses tighter padding than the craft menu — there's no
// long materials list to breathe around, just two grids side by side, so
// large frame insets just look like wasted border.
const STORAGE_GRID_SIZE = 400
const STORAGE_PANEL_PADDING_X = 16
const STORAGE_PANEL_PADDING_TOP = 8
const STORAGE_PANEL_PADDING_BOTTOM = 12
// Each grid's wood-frame texture eats ~11% of its width as decorative
// border. With 400px grids that's ~44px of dead space on each inner edge,
// so we slide the right pane left to overlap the two frames into one.
const STORAGE_PANE_OVERLAP = -40
import { shakeOffset } from '../utils/shake'
import { CloseButton } from './CloseButton'
import { InventoryWithBar } from './InventoryWithBar'

// Dual-pane storage panel. Renders nothing while the menu is closed.
//
// Layout:
//   [ player inventory grid (25 slots 5..29) ]   →   [ storage grid (25 slots) ]
//
// The player's existing bottom bar stays rendered underneath through the
// normal HUD chain, so all 30 player slots are reachable while the menu
// is open. Click handling for the player pane lives in InventoryPanel /
// BottomBar — they detect `isStorageOpen()` and route to
// `pressStorageSlot('player', i, activeStorage)`.
//
// The storage pane is rendered locally because its slots come from a
// per-entity component (`StorageContents`), not the global inventory
// layout, so we can't reuse the existing InventoryGrid code unmodified.
export function StorageMenu(): ReactEcs.JSX.Element | null {
  if (!isStorageOpen()) return null
  const active = getActiveStorage()
  if (active === null) return null

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
      }}
    >
      <Panel
        uiTransform={{
          flexDirection: 'column',
          alignItems: 'center',
          padding: {
            top: STORAGE_PANEL_PADDING_TOP,
            bottom: STORAGE_PANEL_PADDING_BOTTOM,
            left: STORAGE_PANEL_PADDING_X,
            right: STORAGE_PANEL_PADDING_X
          }
        }}
      >
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PaneLabel value="INVENTORY" width={STORAGE_GRID_SIZE}>
            <InventoryWithBar size={STORAGE_GRID_SIZE} />
          </PaneLabel>
          <UiEntity
            uiTransform={{
              margin: { left: STORAGE_PANE_OVERLAP }
            }}
          >
            <PaneLabel value="STORAGE" width={STORAGE_GRID_SIZE}>
              <StorageGrid size={STORAGE_GRID_SIZE} />
            </PaneLabel>
          </UiEntity>
        </UiEntity>
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: -18, right: -18 }
          }}
        >
          <CloseButton onPress={() => closeStorageMenu()} />
        </UiEntity>
      </Panel>
    </UiEntity>
  )
}

function PaneLabel(props: {
  value: string
  width: number
  children?: ReactEcs.JSX.Element | (ReactEcs.JSX.Element | null)[] | null
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: props.width,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          margin: { top: 14, bottom: -16 }
        }}
      >
        <Label value={props.value} fontSize={14} color={CRAFT_TEXT_COLOR} />
      </UiEntity>
      {props.children}
    </UiEntity>
  )
}

function StorageGrid(props: { size: number }): ReactEcs.JSX.Element {
  const total = getStorageSlotCount()
  const cells = Array.from({ length: total }, (_, i) => i)
  return (
    <UiEntity
      uiTransform={{ width: props.size, height: props.size }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: INVENTORY_PANEL_TEXTURE }
      }}
    >
      {cells.map((index) => (
        <StorageCell key={index} uiIndex={index} />
      ))}
    </UiEntity>
  )
}

function StorageCell(props: {
  uiIndex: number
  key?: number | string
}): ReactEcs.JSX.Element | null {
  const active = getActiveStorage()
  if (active === null) return null

  const col = props.uiIndex % INVENTORY_GRID_CELLS
  const row = Math.floor(props.uiIndex / INVENTORY_GRID_CELLS)
  const halfCell = INVENTORY_CELL_SIZE_PCT / 2
  const leftPct = INVENTORY_CELL_CENTERS_PCT[col] - halfCell
  const topPct = INVENTORY_CELL_CENTERS_PCT[row] - halfCell

  const slot = readStorageSlot(active, props.uiIndex)
  const def = slot.id === '' ? null : getCatalogItem(slot.id)

  const picked = getStoragePicked()
  const isPickedHere =
    picked !== null && picked.side === 'storage' && picked.index === props.uiIndex
  const shouldShake =
    picked !== null && !isPickedHere && def !== null

  const inset = isPickedHere
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
        const a = getActiveStorage()
        if (a === null) return
        pressStorageSlot('storage', props.uiIndex, a)
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
        {isPickedHere && (
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
        {def !== null && (
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
              texture: { src: def.texture }
            }}
          />
        )}
        {def !== null && def.stackable && slot.count > 0 && (
          <CountBadge count={slot.count} />
        )}
      </UiEntity>
    </UiEntity>
  )
}

function CountBadge(props: { count: number }): ReactEcs.JSX.Element {
  return (
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
      <Label value={`${props.count}`} fontSize={14} color={COUNT_BADGE_FG} />
    </UiEntity>
  )
}
