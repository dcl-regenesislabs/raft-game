import { Color4 } from '@dcl/sdk/math'
import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { getMobileLayout } from '../mobileLayout'
import { UI_BORDER,UI_CELL,UI_GOLD,UI_MUTED,UI_PAPER } from '../visualTheme'

import { getCatalogItem } from '../items'
import { Panel } from '../panel'
import { getStoragePicked,getStorageSlotCount,pressStorageSlot,readStorageSlot } from '../storageSession'
import { closeStorageMenu,getActiveStorage,isStorageOpen } from '../storageToggle'
import {
COUNT_BADGE_BG,
COUNT_BADGE_FG,
CRAFT_TEXT_COLOR,
GLOW_ALPHA_PEAK_BONUS,
GLOW_COLOR,
INVENTORY_GRID_CELLS,
INVENTORY_ITEM_INSET_PCT,
INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED
} from '../theme'
import { CloseButton } from './CloseButton'
import { InventoryWithBar } from './InventoryWithBar'

// Storage menu uses tighter padding than the craft menu — there's no
// long materials list to breathe around, just two grids side by side, so
// large frame insets just look like wasted border.
const STORAGE_GRID_SIZE = 400
const STORAGE_PANEL_PADDING_X = 16
const STORAGE_PANEL_PADDING_BOTTOM = 12
// All thirty backpack slots and twenty-five storage slots share equal cell sizes.
export function StorageMenu(): ReactEcs.JSX.Element | null {
  if (!isStorageOpen()) return null
  const active = getActiveStorage()
  if (active === null) return null
  const size = Math.min(STORAGE_GRID_SIZE, (getMobileLayout().width - 64) / 2, (getMobileLayout().height - 112) / 1.192)

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
            top: 54,
            bottom: STORAGE_PANEL_PADDING_BOTTOM,
            left: STORAGE_PANEL_PADDING_X,
            right: STORAGE_PANEL_PADDING_X
          }
        }}
      >
        <Label
          value="Tap an item, then a destination slot to move it."
          fontSize={16}
          color={UI_MUTED}
          textAlign="middle-left"
          uiTransform={{
            positionType: 'absolute',
            position: { top: 12, left: 16 },
            width: (size * 11) / 6 - 56,
            height: 32
          }}
        />
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center'
          }}
        >
          <PaneLabel value="BACKPACK" width={size}>
            <InventoryWithBar size={size} />
          </PaneLabel>
          <UiEntity
            uiTransform={{
              margin: { left: 12 }
            }}
          >
            <PaneLabel value="STORAGE" width={(size * 5) / 6}>
              <StorageGrid size={(size * 5) / 6} />
            </PaneLabel>
          </UiEntity>
        </UiEntity>
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: 8, right: 8 }
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
          margin: { top: 0, bottom: 8 }
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
        color: UI_PAPER
      }}
    >
      {cells.map((index) => (
        <StorageCell key={index} uiIndex={index} />
      ))}
    </UiEntity>
  )
}

function StorageCell(props: { uiIndex: number; key?: number | string }): ReactEcs.JSX.Element | null {
  const active = getActiveStorage()
  if (active === null) return null

  const col = props.uiIndex % INVENTORY_GRID_CELLS
  const row = Math.floor(props.uiIndex / INVENTORY_GRID_CELLS)
  const leftPct = col * 20 + 1.8
  const topPct = row * 20 + 1.8

  const slot = readStorageSlot(active, props.uiIndex)
  const def = slot.id === '' ? null : getCatalogItem(slot.id)

  const picked = getStoragePicked()
  const isPickedHere = picked !== null && picked.side === 'storage' && picked.index === props.uiIndex

  const inset = isPickedHere ? INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED : INVENTORY_ITEM_INSET_PCT

  const shake = { x: 0, y: 0 }

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: `${topPct}%`, left: `${leftPct}%` },
        width: '16.4%',
        height: '16.4%',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isPickedHere ? UI_GOLD : UI_BORDER
      }}
      uiBackground={{ color: UI_CELL }}
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
              color: Color4.create(GLOW_COLOR.r, GLOW_COLOR.g, GLOW_COLOR.b, GLOW_ALPHA_PEAK_BONUS)
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
        {def !== null && def.stackable && slot.count > 0 && <CountBadge count={slot.count} />}
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
