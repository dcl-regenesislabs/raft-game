import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import { getRaftBuilderMode } from '../../systems/raftBuilder'
import {
  PLATFORM_COST,
  getPlatformMaterialAvailable
} from '../../systems/raft/platformCost'
import { isCookOpen } from '../cookToggle'
import { getPickedIngredient, pickIngredient } from '../cookSlots'
import {
  getSelectedDragSlot,
  isSwapModeActive,
  pressSlot
} from '../inventoryDrag'
import {
  getBottomBarSelectedLabel,
  getPressProgress,
  getSelectedSlot,
  selectSlot
} from '../inventoryState'
import { isInventoryOpen } from '../inventoryToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  getCatalogItem,
  getInventorySlot
} from '../items'
import {
  BAR_BOTTOM,
  BAR_HEIGHT,
  BAR_SCALE,
  BAR_TEXTURE,
  BAR_WIDTH,
  COOK_NON_INGREDIENT_TINT,
  GLOW_ALPHA_PEAK_BONUS,
  GLOW_ALPHA_SELECTED,
  GLOW_COLOR,
  ITEM_INSET_PCT_IDLE,
  ITEM_INSET_PCT_PEAK_BONUS,
  ITEM_INSET_PCT_SELECTED,
  ITEM_INSET_PCT_SWAP_SELECTED,
  SLOT_CENTERS_PCT,
  slotSizePx,
  slotTopPx
} from '../theme'
import { shakeOffset } from '../utils/shake'
import { DurabilityBar } from './DurabilityBar'
import { ItemCountBadge } from './ItemCountBadge'

// Bottom-center toolbar holding BOTTOM_BAR_SLOT_COUNT slots. The painted
// background art positions the cells; each slot is positioned absolutely
// at its measured cell centre so the items line up with the painting at
// any bar size.
export function BottomBar(): ReactEcs.JSX.Element {
  const width = Math.round(BAR_WIDTH * BAR_SCALE)
  // While the hammer is in placing mode the cost label takes over the
  // slot the transient name label normally occupies — never both at once,
  // since they'd stack on the same anchor and overlap visually.
  const showCost = getRaftBuilderMode() === 'placing'
  const label = showCost ? null : getBottomBarSelectedLabel()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: BAR_BOTTOM, left: '50%' },
        margin: { left: -Math.round(width / 2) }
      }}
    >
      {showCost && <BottomBarPlatformCostLabel width={width} />}
      {label !== null && <BottomBarSelectedLabel value={label} width={width} />}
      <BottomBarSurface width={width} />
    </UiEntity>
  )
}

// Red used for material rows where the player doesn't have enough to
// build. Softer than pure red so it reads as a warning, not an error.
const COST_INSUFFICIENT_COLOR = Color4.create(1, 0.45, 0.45, 1)

// Sits above the hot-bar while the hammer is in placing mode and shows
// each material in the platform recipe as "Name have/need", with the
// number turning red when the player is short of that material.
// Pixel size of the inline material icon rendered next to each count.
// Slightly larger than the label cap height so the icon dominates the
// row visually but doesn't push the pill taller than its 28px height.
const COST_ICON_SIZE = 22
const COST_ROW_GAP = 12

function BottomBarPlatformCostLabel(props: {
  width: number
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '100%', left: 0 },
        width: props.width,
        height: 32,
        margin: { bottom: 4 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          height: 32,
          padding: { left: 12, right: 12 },
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row'
        }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.55) }}
      >
        {PLATFORM_COST.map((row, i) => (
          <PlatformCostRow
            key={row.id}
            id={row.id}
            amount={row.amount}
            showSeparator={i > 0}
          />
        ))}
      </UiEntity>
    </UiEntity>
  )
}

function PlatformCostRow(props: {
  id: string
  amount: number
  showSeparator: boolean
  key?: number | string
}): ReactEcs.JSX.Element {
  const have = getPlatformMaterialAvailable(props.id)
  const ok = have >= props.amount
  const color = ok ? Color4.White() : COST_INSUFFICIENT_COLOR
  const def = getCatalogItem(props.id)
  const iconTexture = def?.texture ?? null
  return (
    <UiEntity
      uiTransform={{
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        margin: { left: props.showSeparator ? COST_ROW_GAP : 0 }
      }}
    >
      {iconTexture !== null && (
        <UiEntity
          uiTransform={{
            width: COST_ICON_SIZE,
            height: COST_ICON_SIZE,
            margin: { right: 4 }
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: iconTexture }
          }}
        />
      )}
      <Label value={`${have}/${props.amount}`} fontSize={16} color={color} />
    </UiEntity>
  )
}

// Transient label that floats just above the hot-bar for ~1.5s after the
// player switches the equipped slot. Hidden by `BottomBar` once the
// state-side timer in `inventoryState` has elapsed (returns null).
function BottomBarSelectedLabel(props: {
  value: string
  width: number
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '100%', left: 0 },
        width: props.width,
        height: 28,
        margin: { bottom: 4 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          height: 28,
          padding: { left: 12, right: 12 },
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.55) }}
      >
        <Label value={props.value} fontSize={16} color={Color4.White()} />
      </UiEntity>
    </UiEntity>
  )
}

// Inline variant — same painted bar + slots, but laid out by the parent
// instead of anchored to the viewport. Used by `InventoryWithBar` so the
// hot-bar can attach directly under the inventory grid (and scale to a
// smaller width inside the craft menu).
export function BottomBarSurface(props: {
  width?: number
}): ReactEcs.JSX.Element {
  const width = props.width ?? BAR_WIDTH
  // Source art is BAR_WIDTH × BAR_HEIGHT — keep the aspect ratio when
  // resizing so the painted cells stay aligned with the absolute slot
  // positions computed below.
  const height = Math.round(width * (BAR_HEIGHT / BAR_WIDTH))
  return (
    <UiEntity
      uiTransform={{ width, height }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: BAR_TEXTURE }
      }}
    >
      {Array.from({ length: BOTTOM_BAR_SLOT_COUNT }, (_, i) => (
        <Slot key={i} index={i} barWidth={width} barHeight={height} />
      ))}
    </UiEntity>
  )
}

function Slot(props: {
  index: number
  barWidth: number
  barHeight: number
  key?: number | string
}): ReactEcs.JSX.Element {
  const isSelected = getSelectedSlot() === props.index
  // 0 = idle, 1 = just pressed; decays linearly. Squared for a snappier
  // ease-out so the icon pops fast and settles slower.
  const pressLinear = getPressProgress(props.index)
  const pressEase = pressLinear * pressLinear

  const cookOpen = isCookOpen()
  const swapActive = !cookOpen && isSwapModeActive()
  const isSwapSelected = !cookOpen && getSelectedDragSlot() === props.index
  const display = getInventorySlot(props.index)
  // While the cook menu is up, "shaking" instead means "this slot is the
  // currently picked ingredient" — same visual cue, repurposed so the
  // player can see which inventory item they're about to drop.
  const isCookPicked =
    cookOpen && display !== null && getPickedIngredient() === display.id
  const shouldShake =
    (swapActive && !isSwapSelected && display !== null) || isCookPicked

  // Resting size depends on state. Swap-selected wins because the picked-up
  // item should be the visually largest; otherwise fall back to the existing
  // equipped/idle inset.
  const restInset = isSwapSelected
    ? ITEM_INSET_PCT_SWAP_SELECTED
    : isSelected
      ? ITEM_INSET_PCT_SELECTED
      : ITEM_INSET_PCT_IDLE
  const inset = restInset + ITEM_INSET_PCT_PEAK_BONUS * pressEase

  const baseGlow = isSelected
    ? GLOW_ALPHA_SELECTED + GLOW_ALPHA_PEAK_BONUS * pressEase
    : GLOW_ALPHA_PEAK_BONUS * pressEase
  const glowAlpha = isSwapSelected
    ? Math.max(baseGlow, GLOW_ALPHA_PEAK_BONUS)
    : baseGlow
  const showGlow = glowAlpha > 0.01

  const slotSize = slotSizePx(props.barWidth)
  const slotTop = slotTopPx(props.barWidth, props.barHeight)
  const centerPx = (SLOT_CENTERS_PCT[props.index] / 100) * props.barWidth
  const leftPx = Math.round(centerPx - slotSize / 2)

  // Apply per-slot shake only to the inner contents (icon + glow + badge),
  // so the slot's hit-rect stays anchored to its painted cell. The shake
  // is just a visual nudge inside the cell.
  const shake = shouldShake
    ? shakeOffset(Date.now() / 1000)
    : { x: 0, y: 0 }

  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: slotTop, left: leftPx },
        width: slotSize,
        height: slotSize,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseDown={() => {
        if (isCookOpen()) {
          if (display !== null) pickIngredient(display.id)
          return
        }
        if (isInventoryOpen()) pressSlot(props.index)
        else selectSlot(props.index)
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
        {showGlow && (
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { top: '8%', bottom: '8%', left: '8%', right: '8%' }
            }}
            uiBackground={{
              color: Color4.create(
                GLOW_COLOR.r,
                GLOW_COLOR.g,
                GLOW_COLOR.b,
                glowAlpha
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
              // the player sees at a glance which hot-bar slots can be
              // dropped into a recipe and which can't.
              color:
                cookOpen && !display.ingredient
                  ? COOK_NON_INGREDIENT_TINT
                  : undefined
            }}
          />
        )}

        <ItemCountBadge item={display} />
        <DurabilityBar slotIndex={props.index} />
      </UiEntity>
    </UiEntity>
  )
}
