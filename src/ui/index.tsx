import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { getThrowChargeT } from '../systems/hookThrower'
import { getDestroyHoverTarget } from '../systems/raftBuilder'
import {
  getActionButtonScale,
  isActionButtonAvailable,
  isActionButtonPressed,
  pressActionButton,
  releaseActionButton
} from './actionButton'
import {
  addCollected,
  getCollectedCount,
  getPressProgress,
  getSelectedSlot,
  getSlotItem,
  selectSlot
} from './inventoryState'
import {
  getSelectedDragSlot,
  isSwapModeActive,
  pressBackground,
  pressSlot
} from './inventoryDrag'
import {
  getInventoryButtonScale,
  isInventoryOpen,
  toggleInventory
} from './inventoryToggle'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_LAYOUT,
  getInventorySlot,
  type ItemDef
} from './items'

// Shake animation for non-selected slots while swap-mode is active.
// Single global oscillator — every shaking slot uses the same offset so
// they sway as a group, rather than each slot juddering on its own phase.
// Tuned subtle: small amplitude, modest frequency.
const SHAKE_FREQ_HZ = 5
const SHAKE_AMP_PX = 1.5
const SHAKE_OMEGA = 2 * Math.PI * SHAKE_FREQ_HZ

function shakeOffset(timeSec: number): { x: number; y: number } {
  // y at quarter-period offset from x → tiny circular sway rather than
  // a pure horizontal shimmy. Both axes share the same global time.
  return {
    x: Math.round(SHAKE_AMP_PX * Math.sin(SHAKE_OMEGA * timeSec)),
    y: Math.round(SHAKE_AMP_PX * Math.sin(SHAKE_OMEGA * timeSec + Math.PI / 2))
  }
}

const BANNER_BG = Color4.create(0.85, 0.18, 0.18, 0.85)
const BANNER_FG = Color4.White()

const BAR_TEXTURE = 'images/hud/bottom-bar.png'
const BAR_WIDTH_DESKTOP = 600
const BAR_HEIGHT_DESKTOP = 150
// Mobile uses the same bar size as desktop, just docked to the screen edge.
const BAR_WIDTH_MOBILE = BAR_WIDTH_DESKTOP
const BAR_HEIGHT_MOBILE = BAR_HEIGHT_DESKTOP
const BAR_BOTTOM_DESKTOP = 24
// Mobile bar can poke a few pixels past the bottom edge — there's no safe-area
// margin on the explorer, so it reads as "stuck to the bottom".
const BAR_BOTTOM_MOBILE = -10
// Painted cell positions, measured from the source PNG (2508×627) by sampling
// the cream pixels. The cells are NOT evenly distributed across the bar:
// the wood frame leaves ~9% margin on each end and the cells sit ~17% apart
// center-to-center. Using justify-content:space-between would push the outer
// slots past the painted cells, so each slot is positioned absolutely on its
// measured center instead.
const SLOT_CENTERS_PCT = [15.77, 32.78, 49.8, 66.81, 83.77]
const SLOT_WIDTH_PCT = 14
// Item textures are square (324×324). The bar is rendered at BAR_WIDTH × BAR_HEIGHT,
// so a slot sized purely in % would be non-square and stretch the item.
// Lock each slot to a square pixel size that fits inside the painted cell.
function slotSizePx(barWidth: number): number {
  return Math.round((SLOT_WIDTH_PCT / 100) * barWidth)
}
function slotTopPx(barWidth: number, barHeight: number): number {
  return Math.round((barHeight - slotSizePx(barWidth)) / 2)
}
// Idle icon inset (each side) — leaves a margin inside the painted cell.
const ITEM_INSET_PCT_IDLE = 7
// Selected resting inset — overflows the cell so the icon stays "popped"
// while selected, instead of settling smaller.
const ITEM_INSET_PCT_SELECTED = -8
// Peak overshoot inset added by the press pulse on top of resting state.
const ITEM_INSET_PCT_PEAK_BONUS = -8
// Swap-mode selection: even more negative inset so the picked-up item
// reads as visibly larger than its resting state — the user's signal
// that this is the slot they're about to swap.
const ITEM_INSET_PCT_SWAP_SELECTED = -22

// Selected glow overlay color (warm gold to read on the brown frame).
const GLOW_COLOR = Color4.create(1.0, 0.85, 0.35, 1.0)
const GLOW_ALPHA_SELECTED = 0
const GLOW_ALPHA_PEAK_BONUS = 0.45

// Charge meter shown at the crosshair while the player holds the throw button.
const CHARGE_BAR_WIDTH = 120
const CHARGE_BAR_HEIGHT = 8
// Vertical offset from screen center; positive = below the crosshair so the
// meter doesn't obscure the aim point.
const CHARGE_BAR_OFFSET_Y = 32
const CHARGE_TRACK_COLOR = Color4.create(0, 0, 0, 0.55)
const CHARGE_FILL_COLOR = Color4.create(1, 0.78, 0.25, 1)
const CHARGE_FILL_FULL_COLOR = Color4.create(1, 0.35, 0.2, 1)

// Mobile action button (right side, vertically centered).
const ACTION_BUTTON_TEXTURE = 'images/hud/button.png'
const ACTION_BUTTON_TEXTURE_PRESSED = 'images/hud/selected-button.png'
const ACTION_BUTTON_SIZE = 180
const ACTION_BUTTON_RIGHT = 32
// Reserved size of the centering frame that holds the button. Has to be
// large enough to fit the button at its peak press-up scale (1 + bonus)
// so the button can grow without shifting the frame and reading as a
// "drift to the left".
const ACTION_BUTTON_FRAME = Math.round(ACTION_BUTTON_SIZE * 1.25)
// Inset (each side, %) the tool icon sits inside the circle button so it
// fits within the painted cream center rather than the brown ring.
const ACTION_BUTTON_ICON_INSET_PCT = 22

// Inventory panel. The art (`inventory.png`) is a 900×900 PNG with a 5×5
// grid of cream cells inset in a brown frame. Cell centers and widths were
// sampled from the source by histogramming bright pixels — the cells sit on
// a regular ~16% grid with each cell ~13.4% wide.
const INVENTORY_PANEL_TEXTURE = 'images/hud/inventory.png'
// Match the bottom bar's width so the inventory's left edge lines up with
// the bar's left edge. Source art is square, so the panel is square too.
const INVENTORY_PANEL_SIZE = BAR_WIDTH_DESKTOP
const INVENTORY_GRID_CELLS = 5
const INVENTORY_CELL_CENTERS_PCT = [17.8, 33.8, 49.8, 65.8, 81.8]
const INVENTORY_CELL_SIZE_PCT = 13.4
// Inset the item icon a hair inside the painted cell so it doesn't bleed
// into the cream-to-brown transition pixels.
const INVENTORY_ITEM_INSET_PCT = 10
// Swap-selected cells overflow the painted cell so the picked-up item
// stands out from the shaking neighbours.
const INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED = -10
// Total cell count of the inventory-panel grid. Sourced from the shared
// linear layout so adjusting `items.ts` flows through to the UI.
const INVENTORY_GRID_TOTAL_CELLS = INVENTORY_LAYOUT.length - BOTTOM_BAR_SLOT_COUNT

// Test-only: seed every stackable item across the whole inventory (bottom
// bar + grid) with a random count in [1, 200] so the count badges are
// visible without having to actually collect anything in-world. Drop this
// IIFE once the gameplay collectors fully populate the inventory.
;(() => {
  for (const item of INVENTORY_LAYOUT) {
    if (item === null || !item.stackable) continue
    addCollected(item.id, 1 + Math.floor(Math.random() * 200))
  }
})()

// Count badge styling. Used by both the bottom-bar slots and the inventory
// grid cells so the visual stays consistent.
const COUNT_BADGE_BG = Color4.create(0, 0, 0, 0.7)
const COUNT_BADGE_FG = Color4.White()

// Inventory open/close toggle (top-right). Reuses the same circular button
// art as the action button, with the backpack as the inner icon.
const INVENTORY_BUTTON_TEXTURE = 'images/hud/button.png'
const INVENTORY_BUTTON_TEXTURE_OPEN = 'images/hud/selected-button.png'
const INVENTORY_BUTTON_ICON = 'images/hud/backpack.png'
const INVENTORY_BUTTON_SIZE = ACTION_BUTTON_SIZE
// Mirror the bottom bar's edge-hug — a small negative inset so the button
// pokes a hair past the canvas top edge instead of sitting in mid-air.
const INVENTORY_BUTTON_TOP = -10
// Mobile keeps the button anchored at 70% from the left so it sits in
// the upper-right region without crowding the edge of the touch target.
// Desktop pins it flush to the right with a small inset (no overlap with
// the action-button column on the right side, since the action button is
// mobile-only).
const INVENTORY_BUTTON_LEFT_PCT_MOBILE = 70
const INVENTORY_BUTTON_RIGHT_DESKTOP = 32
// Same trick as the action button: an outer frame sized to the peak-press
// scale prevents the button from shifting when it grows.
const INVENTORY_BUTTON_FRAME = Math.round(INVENTORY_BUTTON_SIZE * 1.25)
const INVENTORY_BUTTON_ICON_INSET_PCT = 24

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
      // Any click that doesn't land on a slot (or on the slot's parents
      // forwarding the press) cancels the current swap selection. Slot
      // handlers set `interactionThisFrame` so this background handler
      // skips when a slot was the actual click target this frame.
      onMouseDown={pressBackground}
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
      <ActionButton />
      <InventoryButton />
      <InventoryPanel />
      <ChargeReticle />
    </UiEntity>
  )
}

function InventoryPanel(): ReactEcs.JSX.Element | null {
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
      <UiEntity
        uiTransform={{
          width: INVENTORY_PANEL_SIZE,
          height: INVENTORY_PANEL_SIZE,
          margin: { left: barShiftX, bottom: '10%' }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: INVENTORY_PANEL_TEXTURE }
        }}
      >
        {Array.from({ length: INVENTORY_GRID_TOTAL_CELLS }, (_, i) => (
          <InventoryCell key={i} index={i} />
        ))}
      </UiEntity>
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
      onMouseDown={() => pressSlot(globalIndex)}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: shake.y, left: shake.x, right: -shake.x, bottom: -shake.y }
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

function InventoryButton(): ReactEcs.JSX.Element {
  const open = isInventoryOpen()
  const scaledSize = Math.round(INVENTORY_BUTTON_SIZE * getInventoryButtonScale())
  // Desktop: pin flush to the top-right corner. Mobile: keep at the
  // existing 70%-from-left anchor (the right edge there is reserved for
  // the on-screen action button).
  const mobile = isMobile()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: mobile
          ? {
              top: INVENTORY_BUTTON_TOP,
              left: `${INVENTORY_BUTTON_LEFT_PCT_MOBILE}%`
            }
          : {
              top: INVENTORY_BUTTON_TOP,
              right: INVENTORY_BUTTON_RIGHT_DESKTOP
            },
        width: INVENTORY_BUTTON_FRAME,
        height: INVENTORY_BUTTON_FRAME,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: scaledSize,
          height: scaledSize,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: {
            src: open ? INVENTORY_BUTTON_TEXTURE_OPEN : INVENTORY_BUTTON_TEXTURE
          }
        }}
        onMouseDown={toggleInventory}
      >
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: {
              top: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              bottom: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              left: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`,
              right: `${INVENTORY_BUTTON_ICON_INSET_PCT}%`
            }
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: INVENTORY_BUTTON_ICON }
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function ActionButton(): ReactEcs.JSX.Element | null {
  if (!isMobile() || !isActionButtonAvailable() || isInventoryOpen()) return null
  const pressed = isActionButtonPressed()
  const iconTexture = getSlotItem(getSelectedSlot())?.texture ?? null
  const scaledSize = Math.round(ACTION_BUTTON_SIZE * getActionButtonScale())
  // Two-layer wrapper:
  //   1) Outer column pinned to the right edge → vertical centering.
  //   2) Fixed-size frame that holds the button centered inside it. The
  //      button itself changes size with the press animation; the frame
  //      stays constant so the button grows from its center instead of
  //      shifting toward one edge.
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, right: 0 },
        width: ACTION_BUTTON_FRAME + ACTION_BUTTON_RIGHT,
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-end',
        padding: { right: ACTION_BUTTON_RIGHT }
      }}
    >
      <UiEntity
        uiTransform={{
          width: ACTION_BUTTON_FRAME,
          height: ACTION_BUTTON_FRAME,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <UiEntity
          uiTransform={{
            width: scaledSize,
            height: scaledSize,
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              src: pressed ? ACTION_BUTTON_TEXTURE_PRESSED : ACTION_BUTTON_TEXTURE
            }
          }}
          onMouseDown={pressActionButton}
          onMouseUp={releaseActionButton}
        >
          {iconTexture && (
            <UiEntity
              uiTransform={{
                positionType: 'absolute',
                position: {
                  top: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                  bottom: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                  left: `${ACTION_BUTTON_ICON_INSET_PCT}%`,
                  right: `${ACTION_BUTTON_ICON_INSET_PCT}%`
                }
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: iconTexture }
              }}
            />
          )}
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function ChargeReticle(): ReactEcs.JSX.Element | null {
  const t = getThrowChargeT()
  if (t <= 0.001) return null
  const fillWidth = Math.max(2, Math.round(CHARGE_BAR_WIDTH * t))
  const fillColor = t >= 0.999 ? CHARGE_FILL_FULL_COLOR : CHARGE_FILL_COLOR
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
      <UiEntity
        uiTransform={{
          width: CHARGE_BAR_WIDTH,
          height: CHARGE_BAR_HEIGHT,
          margin: { top: CHARGE_BAR_OFFSET_Y }
        }}
        uiBackground={{ color: CHARGE_TRACK_COLOR }}
      >
        <UiEntity
          uiTransform={{
            width: fillWidth,
            height: CHARGE_BAR_HEIGHT
          }}
          uiBackground={{ color: fillColor }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function BottomBar(): ReactEcs.JSX.Element {
  // isMobile() (from @dcl/sdk/platform) is the authoritative platform check —
  // canvas width in virtual pixels is unreliable since DCL phones report
  // large widths.
  const mobile = isMobile()
  const barWidth = mobile ? BAR_WIDTH_MOBILE : BAR_WIDTH_DESKTOP
  const barHeight = mobile ? BAR_HEIGHT_MOBILE : BAR_HEIGHT_DESKTOP
  const barBottom = mobile ? BAR_BOTTOM_MOBILE : BAR_BOTTOM_DESKTOP
  // Shift the mobile bar to the right by 1/5 of its width so it doesn't sit
  // dead-center under the action button on touch devices.
  const barShiftX = mobile ? Math.round(barWidth / 5) : 0
  return (
    <UiEntity
      uiTransform={{
        width: barWidth,
        height: barHeight,
        positionType: 'absolute',
        position: { bottom: barBottom },
        alignSelf: 'center',
        margin: { left: barShiftX }
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: BAR_TEXTURE }
      }}
    >
      {Array.from({ length: BOTTOM_BAR_SLOT_COUNT }, (_, i) => (
        <Slot key={i} index={i} barWidth={barWidth} barHeight={barHeight} />
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
          position: { top: shake.y, left: shake.x, right: -shake.x, bottom: -shake.y }
        }}
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

// Reusable per-cell count chip. Renders nothing for items that aren't
// stackable, or for stackable items the player has zero of, so empty
// material slots stay visually clean.
function ItemCountBadge(props: {
  item: ItemDef | null
  key?: number | string
}): ReactEcs.JSX.Element | null {
  const item = props.item
  if (item === null || !item.stackable) return null
  const count = getCollectedCount(item.id)
  if (count <= 0) return null
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
      <Label value={`${count}`} fontSize={14} color={COUNT_BADGE_FG} />
    </UiEntity>
  )
}
