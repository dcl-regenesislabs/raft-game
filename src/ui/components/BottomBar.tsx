import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import {
  getSelectedDragSlot,
  isSwapModeActive,
  pressSlot
} from '../inventoryDrag'
import {
  getPressProgress,
  getSelectedSlot,
  selectSlot
} from '../inventoryState'
import { isInventoryOpen } from '../inventoryToggle'
import { BOTTOM_BAR_SLOT_COUNT, getInventorySlot } from '../items'
import {
  BAR_BOTTOM,
  BAR_HEIGHT,
  BAR_TEXTURE,
  BAR_WIDTH,
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
import { ItemCountBadge } from './ItemCountBadge'

// Bottom-center toolbar holding BOTTOM_BAR_SLOT_COUNT slots. The painted
// background art positions the cells; each slot is positioned absolutely
// at its measured cell centre so the items line up with the painting at
// any bar size.
export function BottomBar(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        positionType: 'absolute',
        position: { bottom: BAR_BOTTOM, left: '50%' },
        margin: { left: -Math.round(BAR_WIDTH / 2) }
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: BAR_TEXTURE }
      }}
    >
      {Array.from({ length: BOTTOM_BAR_SLOT_COUNT }, (_, i) => (
        <Slot key={i} index={i} barWidth={BAR_WIDTH} barHeight={BAR_HEIGHT} />
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

  const swapActive = isSwapModeActive()
  const isSwapSelected = getSelectedDragSlot() === props.index
  const display = getInventorySlot(props.index)
  const shouldShake = swapActive && !isSwapSelected && display !== null

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
              texture: { src: display.texture }
            }}
          />
        )}

        <ItemCountBadge item={display} />
      </UiEntity>
    </UiEntity>
  )
}
