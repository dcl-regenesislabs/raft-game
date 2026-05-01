import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import { getDestroyHoverTarget } from '../systems/raftBuilder'
import {
  SLOT_COUNT,
  getPressProgress,
  getSelectedSlot,
  getSlotItems,
  selectSlot
} from './inventoryState'

const BANNER_BG = Color4.create(0.85, 0.18, 0.18, 0.85)
const BANNER_FG = Color4.White()

const BAR_TEXTURE = 'images/hud/bottom-bar.png'
const BAR_WIDTH = 600
const BAR_HEIGHT = 150
// The bar artwork is a wooden frame with five evenly-spaced cream cells.
// These percentages were measured from the source PNG (2508×627) so slot
// content lines up with the painted cells regardless of bar size.
const SLOT_AREA_LEFT_PCT = 4.5
const SLOT_AREA_RIGHT_PCT = 4.5
const SLOT_AREA_TOP_PCT = 14
const SLOT_AREA_BOTTOM_PCT = 14
// Idle icon inset (each side) — leaves a margin inside the painted cell.
const ITEM_INSET_PCT_IDLE = 12
// Selected resting inset — icon overflows the cell so it pops above the bar.
const ITEM_INSET_PCT_SELECTED = -10
// Peak overshoot inset added by the press pulse on top of resting state.
const ITEM_INSET_PCT_PEAK_BONUS = -8

// Selected glow overlay color (warm gold to read on the brown frame).
const GLOW_COLOR = Color4.create(1.0, 0.85, 0.35, 1.0)
const GLOW_ALPHA_SELECTED = 0.35
const GLOW_ALPHA_PEAK_BONUS = 0.45

// React-ECS render runs every frame; reading scene state directly here is the
// idiomatic pattern (no useState/useEffect).
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui)
}

function ui(): ReactEcs.JSX.Element {
  const showDestroy = getDestroyHoverTarget() !== null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: { top: 80 }
      }}
    >
      {showDestroy && (
        <UiEntity
          uiTransform={{
            width: 320,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: BANNER_BG }}
        >
          <Label value="DELETE PLATFORM" fontSize={24} color={BANNER_FG} />
        </UiEntity>
      )}

      <BottomBar />
    </UiEntity>
  )
}

function BottomBar(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        positionType: 'absolute',
        position: { bottom: 24 },
        alignSelf: 'center'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: BAR_TEXTURE }
      }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: `${SLOT_AREA_TOP_PCT}%`,
            bottom: `${SLOT_AREA_BOTTOM_PCT}%`,
            left: `${SLOT_AREA_LEFT_PCT}%`,
            right: `${SLOT_AREA_RIGHT_PCT}%`
          },
          flexDirection: 'row',
          alignItems: 'stretch',
          justifyContent: 'space-between'
        }}
      >
        {getSlotItems().map((src, i) => (
          <Slot key={i} index={i} itemTexture={src} />
        ))}
      </UiEntity>
    </UiEntity>
  )
}

function Slot(props: {
  index: number
  itemTexture: string | null
  key?: number | string
}): ReactEcs.JSX.Element {
  const isSelected = getSelectedSlot() === props.index
  // 0 = idle, 1 = just pressed; decays linearly. Squared for a snappier
  // ease-out so the icon pops fast and settles slower.
  const pressLinear = getPressProgress(props.index)
  const pressEase = pressLinear * pressLinear

  // Resting size depends on selection; press pulse adds an overshoot on top.
  const restInset = isSelected ? ITEM_INSET_PCT_SELECTED : ITEM_INSET_PCT_IDLE
  const inset = restInset + ITEM_INSET_PCT_PEAK_BONUS * pressEase

  const glowAlpha = isSelected
    ? GLOW_ALPHA_SELECTED + GLOW_ALPHA_PEAK_BONUS * pressEase
    : GLOW_ALPHA_PEAK_BONUS * pressEase
  const showGlow = glowAlpha > 0.01

  return (
    <UiEntity
      uiTransform={{
        width: `${100 / SLOT_COUNT}%`,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseDown={() => selectSlot(props.index)}
    >
      {showGlow && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '8%', bottom: '8%', left: '8%', right: '8%' }
          }}
          uiBackground={{
            color: Color4.create(GLOW_COLOR.r, GLOW_COLOR.g, GLOW_COLOR.b, glowAlpha)
          }}
        />
      )}

      {props.itemTexture && (
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
            texture: { src: props.itemTexture }
          }}
        />
      )}
    </UiEntity>
  )
}
