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
  CRAFT_INVENTORY_SIZE,
  CRAFT_PANEL_PADDING_BOTTOM,
  CRAFT_PANEL_PADDING_TOP,
  CRAFT_PANEL_PADDING_X,
  CRAFT_TEXT_COLOR,
  CRAFT_DIVIDER_COLOR,
  CLOSE_BUTTON_COOK_MARGIN_RIGHT,
  CLOSE_BUTTON_COOK_MARGIN_TOP,
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
import { shakeOffset } from '../utils/shake'
import { CloseButton } from './CloseButton'
import { InventoryGrid } from './InventoryPanel'

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
            top: CRAFT_PANEL_PADDING_TOP,
            bottom: CRAFT_PANEL_PADDING_BOTTOM,
            left: CRAFT_PANEL_PADDING_X,
            right: CRAFT_PANEL_PADDING_X
          }
        }}
      >
        <StorageHeader />
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 1,
            margin: { top: 6, bottom: 12 }
          }}
          uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
        />
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PaneLabel value="INVENTORY" width={CRAFT_INVENTORY_SIZE}>
            <InventoryGrid size={CRAFT_INVENTORY_SIZE} />
          </PaneLabel>
          <UiEntity uiTransform={{ width: 24 }} />
          <PaneLabel value="STORAGE" width={CRAFT_INVENTORY_SIZE}>
            <StorageGrid size={CRAFT_INVENTORY_SIZE} />
          </PaneLabel>
        </UiEntity>
      </Panel>
    </UiEntity>
  )
}

function StorageHeader(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 44,
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <Label
        value="STORAGE"
        fontSize={22}
        color={CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ flexGrow: 1, height: '100%' }}
      />
      <UiEntity
        uiTransform={{
          margin: {
            top: CLOSE_BUTTON_COOK_MARGIN_TOP,
            right: CLOSE_BUTTON_COOK_MARGIN_RIGHT
          }
        }}
      >
        <CloseButton onPress={() => closeStorageMenu()} />
      </UiEntity>
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
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          margin: { bottom: 6 }
        }}
      >
        <Label value={props.value} fontSize={16} color={CRAFT_TEXT_COLOR} />
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
