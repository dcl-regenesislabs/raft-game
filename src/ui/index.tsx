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
  getCraftButtonScale,
  getSelectedCraftableId,
  isCraftOpen,
  selectCraftable,
  toggleCraft
} from './craftToggle'
import {
  CRAFTABLE_ITEMS,
  type CraftableItem,
  type MaterialCost,
  getCraftableById
} from './craftableItems'
import {
  canStartCraft,
  getCraftProgress,
  isCrafting,
  startCraft
} from './craftSession'
import {
  BOTTOM_BAR_SLOT_COUNT,
  INVENTORY_LAYOUT,
  getInventorySlot,
  getMaterialDef,
  type ItemDef
} from './items'
import { getNotification } from './notification'
import { Panel } from './panel'
import { createPressPulse } from './pressPulse'
import { type StatKind, getStat } from './statsBars'

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

// Craft double-menu sizes. The list and details panels render centered
// using the nine-sliced `panel.png` background; the inventory grid is
// pinned to the bottom-left corner at a smaller size so the centered
// panels have breathing room in the middle of the screen.
const CRAFT_LIST_WIDTH = 320
const CRAFT_LIST_HEIGHT = 624
const CRAFT_DETAILS_WIDTH = 480
// Inventory grid size when shown alongside the craft panels. Smaller than
// the standalone inventory so it doesn't dominate the bottom-left corner.
const CRAFT_INVENTORY_SIZE = 420
const CRAFT_INVENTORY_LEFT = 32
const CRAFT_INVENTORY_BOTTOM = 32
// Craft details panel grows with the recipe — header + description + the
// REQUIRES row + one row per material.
const CRAFT_DETAILS_BASE_HEIGHT = 376
const CRAFT_DETAILS_ROW_HEIGHT = 58
const CRAFT_PANEL_GAP = 16
// Inset content past the painted bevel. Horizontal padding is bigger
// than vertical so labels and counts don't crowd the painted left/right
// frame; top padding is larger than bottom so the header sits visibly
// inside the wood frame instead of hugging the top bevel.
const CRAFT_PANEL_PADDING_X = 56
const CRAFT_PANEL_PADDING_TOP = 64
const CRAFT_PANEL_PADDING_BOTTOM = 44
// Dark brown text reads against the cream panel center; the cream variant
// is for rows with a dark inset (selected craftable).
const CRAFT_TEXT_COLOR = Color4.create(0.3, 0.18, 0.1, 1)
const CRAFT_TEXT_DIM_COLOR = Color4.create(0.45, 0.3, 0.18, 1)
const CRAFT_TEXT_LIGHT_COLOR = Color4.create(0.97, 0.92, 0.78, 1)
const CRAFT_DIVIDER_COLOR = Color4.create(0.3, 0.18, 0.1, 0.5)
const CRAFT_ROW_SELECTED_BG = Color4.create(0, 0, 0, 0.55)
const CRAFT_BUTTON_TEXTURE = 'images/hud/red_button.png'
const CRAFT_BUTTON_FG = Color4.White()
const CRAFT_BUTTON_W = 110
const CRAFT_BUTTON_H = 38
// Frame sized to the peak press scale (1 + peakBonus, generously rounded
// to 1.25×) so the button can grow without shifting the parent row.
const CRAFT_BUTTON_FRAME_W = Math.round(CRAFT_BUTTON_W * 1.25)
const CRAFT_BUTTON_FRAME_H = Math.round(CRAFT_BUTTON_H * 1.25)
// red_button.png has rounded ends; nine-slice keeps the corners pixel-correct
// when the size doesn't match the source aspect ratio.
const CRAFT_BUTTON_SLICE = 0.2

// Notification banner. Sits above every other HUD element and slides in
// from offscreen when `showNotification` is called. Width is fixed so the
// pill doesn't reflow as the message changes; the resting top inset gives
// it a small margin from the screen edge.
const NOTIFICATION_WIDTH = 520
const NOTIFICATION_HEIGHT = 96
const NOTIFICATION_TOP_INSET = 32
const NOTIFICATION_PADDING_X = 48
const NOTIFICATION_TEXT_COLOR = Color4.create(0.3, 0.18, 0.1, 1)
const NOTIFICATION_FONT_SIZE = 22

// Stats bars (life / hunger / thirst), bottom-left of the screen.
// Source art `bar.png` is 600×124. The cream icon cell sits on the left,
// followed by a wood-framed dark track that we fill left-to-right.
// Percentages were measured from the source PNG.
const STATS_BAR_TEXTURE = 'images/hud/bar.png'
const STATS_BAR_WIDTH = 280
const STATS_BAR_HEIGHT = Math.round(STATS_BAR_WIDTH * (124 / 600))
const STATS_BAR_GAP = 6
const STATS_BAR_LEFT = 64
const STATS_BAR_BOTTOM = 24
// Painted dark-track inset within the bar art. Fill grows from FILL_LEFT
// rightward up to FILL_RIGHT_LIMIT at 100%. Right limit stops at the
// painted dark-track edge so 100% doesn't bleed onto the wood frame.
const STATS_FILL_LEFT_PCT = 21
const STATS_FILL_RIGHT_LIMIT_PCT = 95
const STATS_FILL_TOP_PCT = 32
const STATS_FILL_BOTTOM_PCT = 30
// Icon cell bounds — generously oversized so the icons read big against
// the bar. Negative top/left lets the icon overflow the painted cream
// cell and sit visually larger than the cell itself.
const STATS_ICON_LEFT_PCT = 0
const STATS_ICON_TOP_PCT = 0
const STATS_ICON_WIDTH_PCT = 26*0.8
const STATS_ICON_HEIGHT_PCT = 120*0.8
// No inset — icons are tight crops, so let them fill the icon cell.
const STATS_ICON_INSET_PCT = 0
const STAT_ICON_TEXTURES: Record<StatKind, string> = {
  life: 'images/hud/icons/life.png',
  hunger: 'images/hud/icons/hungry.png',
  thirst: 'images/hud/icons/thirst.png'
}
// Tints for each stat — kept in the warm/saturated range so they read
// against the brown frame.
const STAT_FILL_COLORS: Record<StatKind, ReturnType<typeof Color4.create>> = {
  life: Color4.create(0.85, 0.18, 0.18, 1),
  hunger: Color4.create(1.0, 0.6, 0.18, 1),
  thirst: Color4.create(0.25, 0.65, 1.0, 1)
}
const STATS_ORDER: readonly StatKind[] = ['life', 'hunger', 'thirst']

// Module-level pulse so the same animation clock survives across the
// React-ECS render rebuilds. Ticked by `pressPulseTickSystem` registered
// in `index.ts`.
const craftActionPulse = createPressPulse()
const CRAFT_HAVE_OK_COLOR = Color4.create(0.7, 1, 0.5, 1)
const CRAFT_HAVE_LOW_COLOR = Color4.create(1, 0.55, 0.3, 1)

// Craft menu toggle (left of the backpack). Reuses the same circular button
// art and sizing as the inventory button, with the saw as the inner icon.
const CRAFT_BUTTON_ICON = 'images/hud/saw.png'
// Sit one button-size to the left of the backpack on desktop (visible edges
// flush, no gap from the frame padding), and a matching percentage step on
// mobile.
const CRAFT_BUTTON_RIGHT_DESKTOP =
  INVENTORY_BUTTON_RIGHT_DESKTOP + INVENTORY_BUTTON_SIZE
const CRAFT_BUTTON_LEFT_PCT_MOBILE = INVENTORY_BUTTON_LEFT_PCT_MOBILE - 14

// React-ECS render runs every frame; reading scene state directly here is the
// idiomatic pattern (no useState/useEffect).
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui)
}

function ui(): ReactEcs.JSX.Element {
  // While a craft is running every interactive HUD element hides — the
  // player can't act, only watch the progress bar fill. The bar reuses
  // the hook charge meter style for visual consistency.
  if (isCrafting()) {
    return (
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute'
        }}
      >
        <CraftProgressBar />
        <NotificationOverlay />
      </UiEntity>
    )
  }

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
      <StatsBars />
      <ActionButton />
      <InventoryButton />
      <CraftButton />
      <InventoryPanel />
      <CraftDoubleMenu />
      <ChargeReticle />
      <NotificationOverlay />
    </UiEntity>
  )
}

function StatsBars(): ReactEcs.JSX.Element {
  // Stack vertically, anchored to the bottom-left corner. Reverse so the
  // first entry in STATS_ORDER renders on top.
  const totalHeight =
    STATS_ORDER.length * STATS_BAR_HEIGHT +
    (STATS_ORDER.length - 1) * STATS_BAR_GAP
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: STATS_BAR_BOTTOM, left: STATS_BAR_LEFT },
        width: STATS_BAR_WIDTH,
        height: totalHeight,
        flexDirection: 'column'
      }}
    >
      {STATS_ORDER.map((kind, i) => (
        <StatBar
          key={kind}
          kind={kind}
          marginTop={i === 0 ? 0 : STATS_BAR_GAP}
        />
      ))}
    </UiEntity>
  )
}

function StatBar(props: {
  kind: StatKind
  marginTop: number
  key?: string
}): ReactEcs.JSX.Element {
  const t = Math.max(0, Math.min(1, getStat(props.kind)))
  const fillSpanPct = STATS_FILL_RIGHT_LIMIT_PCT - STATS_FILL_LEFT_PCT
  const fillWidthPct = fillSpanPct * t
  return (
    <UiEntity
      uiTransform={{
        width: STATS_BAR_WIDTH,
        height: STATS_BAR_HEIGHT,
        margin: { top: props.marginTop }
      }}
    >
      {/* Bar art first; the painted dark track is opaque, so the colored
          fill renders ON TOP of it inside the track area. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          width: '100%',
          height: '100%'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: STATS_BAR_TEXTURE }
        }}
      />
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: `${STATS_FILL_TOP_PCT}%`,
            bottom: `${STATS_FILL_BOTTOM_PCT}%`,
            left: `${STATS_FILL_LEFT_PCT}%`
          },
          width: `${fillWidthPct}%`
        }}
        uiBackground={{ color: STAT_FILL_COLORS[props.kind] }}
      />
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: `${STATS_ICON_TOP_PCT}%`,
            left: `${STATS_ICON_LEFT_PCT}%`
          },
          width: `${STATS_ICON_WIDTH_PCT}%`,
          height: `${STATS_ICON_HEIGHT_PCT}%`
        }}
      >
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: {
              top: `${STATS_ICON_INSET_PCT}%`,
              bottom: `${STATS_ICON_INSET_PCT}%`,
              left: `${STATS_ICON_INSET_PCT}%`,
              right: `${STATS_ICON_INSET_PCT}%`
            }
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: STAT_ICON_TEXTURES[props.kind] }
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function NotificationOverlay(): ReactEcs.JSX.Element | null {
  const view = getNotification()
  if (view === null) return null
  // Slide from fully offscreen (-(height + top inset)) at slide=0 to the
  // resting NOTIFICATION_TOP_INSET at slide=1. Linear interpolation keeps
  // the easing concentrated in the slide curve itself.
  const offscreenTop = -(NOTIFICATION_HEIGHT + NOTIFICATION_TOP_INSET)
  const top = offscreenTop + (NOTIFICATION_TOP_INSET - offscreenTop) * view.slide
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}
    >
      <Panel
        uiTransform={{
          width: NOTIFICATION_WIDTH,
          height: NOTIFICATION_HEIGHT,
          margin: { top: Math.round(top) },
          alignItems: 'center',
          justifyContent: 'center',
          padding: { left: NOTIFICATION_PADDING_X, right: NOTIFICATION_PADDING_X }
        }}
      >
        <Label
          value={view.message}
          fontSize={NOTIFICATION_FONT_SIZE}
          color={NOTIFICATION_TEXT_COLOR}
          textAlign="middle-center"
          uiTransform={{ flexGrow: 1, height: '100%' }}
        />
      </Panel>
    </UiEntity>
  )
}

function CraftProgressBar(): ReactEcs.JSX.Element {
  const t = getCraftProgress()
  const fillWidth = Math.max(2, Math.round(CHARGE_BAR_WIDTH * t))
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
          height: CHARGE_BAR_HEIGHT
        }}
        uiBackground={{ color: CHARGE_TRACK_COLOR }}
      >
        <UiEntity
          uiTransform={{ width: fillWidth, height: CHARGE_BAR_HEIGHT }}
          uiBackground={{ color: CHARGE_FILL_COLOR }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function CraftDoubleMenu(): ReactEcs.JSX.Element | null {
  if (!isCraftOpen()) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%'
      }}
    >
      {/* Inventory pinned to the bottom-left so the player can see their
          materials while crafting. The buttons stay mutually exclusive —
          this is just a layout coupling, not a state coupling. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            bottom: CRAFT_INVENTORY_BOTTOM,
            left: CRAFT_INVENTORY_LEFT
          }
        }}
      >
        <InventoryGrid size={CRAFT_INVENTORY_SIZE} />
      </UiEntity>
      {/* List + details centered in the middle of the screen. The bottom
          margin lifts them off the bottom bar. */}
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
            flexDirection: 'row',
            alignItems: 'center',
            margin: { bottom: '8%' }
          }}
        >
          <CraftItemList />
          <UiEntity uiTransform={{ width: CRAFT_PANEL_GAP, height: 1 }} />
          <CraftDetails />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

function CraftItemList(): ReactEcs.JSX.Element {
  return (
    <Panel
      uiTransform={{
        width: CRAFT_LIST_WIDTH,
        height: CRAFT_LIST_HEIGHT,
        flexDirection: 'column',
        padding: {
          top: CRAFT_PANEL_PADDING_TOP,
          bottom: CRAFT_PANEL_PADDING_BOTTOM,
          left: CRAFT_PANEL_PADDING_X,
          right: CRAFT_PANEL_PADDING_X
        }
      }}
    >
      <UiEntity
        uiTransform={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 44, height: 44 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: CRAFT_BUTTON_ICON }
          }}
        />
        <Label
          value="CRAFT"
          fontSize={24}
          color={CRAFT_TEXT_COLOR}
          uiTransform={{ margin: { left: 12 } }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 6, bottom: 8 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      {CRAFTABLE_ITEMS.map((item) => (
        <CraftItemRow key={item.id} item={item} />
      ))}
    </Panel>
  )
}

function CraftItemRow(props: {
  item: CraftableItem
  key?: number | string
}): ReactEcs.JSX.Element {
  const selected = getSelectedCraftableId() === props.item.id
  return (
    <UiEntity
      uiTransform={{
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 4 },
        padding: { left: 8, right: 8 }
      }}
      uiBackground={selected ? { color: CRAFT_ROW_SELECTED_BG } : undefined}
      onMouseDown={() => selectCraftable(props.item.id)}
    >
      <UiEntity
        uiTransform={{ width: 48, height: 48 }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: props.item.texture }
        }}
      />
      <Label
        value={props.item.name}
        fontSize={16}
        color={selected ? CRAFT_TEXT_LIGHT_COLOR : CRAFT_TEXT_COLOR}
        uiTransform={{ flexGrow: 1, margin: { left: 12 } }}
      />
    </UiEntity>
  )
}

function CraftDetails(): ReactEcs.JSX.Element | null {
  const id = getSelectedCraftableId()
  const item = id !== null ? getCraftableById(id) : null
  if (item === null) return null
  // Detail panel grows with the recipe so the wood frame hugs the content
  // rather than leaving an empty stretch under short recipes.
  const height = CRAFT_DETAILS_BASE_HEIGHT + CRAFT_DETAILS_ROW_HEIGHT * item.cost.length
  return (
    <Panel
      uiTransform={{
        width: CRAFT_DETAILS_WIDTH,
        height,
        flexDirection: 'column',
        padding: {
          top: CRAFT_PANEL_PADDING_TOP,
          bottom: CRAFT_PANEL_PADDING_BOTTOM,
          left: CRAFT_PANEL_PADDING_X,
          right: CRAFT_PANEL_PADDING_X
        }
      }}
    >
      <UiEntity
        uiTransform={{
          height: 60,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{ width: 60, height: 60 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: item.texture }
          }}
        />
        <Label
          value={item.name}
          fontSize={28}
          color={CRAFT_TEXT_COLOR}
          uiTransform={{ margin: { left: 14 } }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{
          height: 1,
          margin: { top: 10, bottom: 12 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      <Label
        value={item.description}
        fontSize={16}
        color={CRAFT_TEXT_DIM_COLOR}
        textAlign="top-left"
        uiTransform={{
          width: '100%',
          height: 110
        }}
      />
      <UiEntity
        uiTransform={{
          height: CRAFT_BUTTON_FRAME_H + 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: { top: 4, bottom: 4 }
        }}
      >
        <Label value="REQUIRES" fontSize={22} color={CRAFT_TEXT_COLOR} />
        <CraftActionButton item={item} />
      </UiEntity>
      {item.cost.map((cost) => (
        <CraftCostRow key={cost.materialId} cost={cost} />
      ))}
    </Panel>
  )
}

function CraftActionButton(props: { item: CraftableItem }): ReactEcs.JSX.Element {
  const scale = craftActionPulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * scale)
  const h = Math.round(CRAFT_BUTTON_H * scale)
  const enabled = canStartCraft(props.item.id)
  return (
    <UiEntity
      uiTransform={{
        width: CRAFT_BUTTON_FRAME_W,
        height: CRAFT_BUTTON_FRAME_H,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: w,
          height: h,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'nine-slices',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          textureSlices: {
            top: CRAFT_BUTTON_SLICE,
            right: CRAFT_BUTTON_SLICE,
            bottom: CRAFT_BUTTON_SLICE,
            left: CRAFT_BUTTON_SLICE
          },
          // Dim the button when materials are short so the player gets a
          // visual cue that pressing it won't start a craft.
          color: enabled
            ? Color4.create(1, 1, 1, 1)
            : Color4.create(1, 1, 1, 0.45)
        }}
        onMouseDown={() => {
          if (!enabled) return
          craftActionPulse.press()
          startCraft(props.item.id)
        }}
      >
        <Label value="CRAFT" fontSize={16} color={CRAFT_BUTTON_FG} />
      </UiEntity>
    </UiEntity>
  )
}

function CraftCostRow(props: {
  cost: MaterialCost
  key?: number | string
}): ReactEcs.JSX.Element {
  const def = getMaterialDef(props.cost.materialId)
  const have = getCollectedCount(props.cost.materialId)
  const enough = have >= props.cost.amount
  const label = def?.id.toUpperCase() ?? props.cost.materialId.toUpperCase()
  const texture = def?.texture
  return (
    <UiEntity
      uiTransform={{
        height: CRAFT_DETAILS_ROW_HEIGHT - 8,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 8 }
      }}
    >
      {texture !== undefined && (
        <UiEntity
          uiTransform={{ width: 50, height: 50 }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: texture }
          }}
        />
      )}
      <Label
        value={label}
        fontSize={18}
        color={CRAFT_TEXT_COLOR}
        uiTransform={{ flexGrow: 1, margin: { left: 12 } }}
      />
      <Label
        value={`${have}/${props.cost.amount}`}
        fontSize={20}
        color={enough ? CRAFT_HAVE_OK_COLOR : CRAFT_HAVE_LOW_COLOR}
      />
    </UiEntity>
  )
}

function InventoryGrid(props: { size?: number }): ReactEcs.JSX.Element {
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
          margin: { left: barShiftX, bottom: '10%' }
        }}
      >
        <InventoryGrid />
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

function CraftButton(): ReactEcs.JSX.Element {
  const open = isCraftOpen()
  const scaledSize = Math.round(INVENTORY_BUTTON_SIZE * getCraftButtonScale())
  const mobile = isMobile()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: mobile
          ? {
              top: INVENTORY_BUTTON_TOP,
              left: `${CRAFT_BUTTON_LEFT_PCT_MOBILE}%`
            }
          : {
              top: INVENTORY_BUTTON_TOP,
              right: CRAFT_BUTTON_RIGHT_DESKTOP
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
        onMouseDown={toggleCraft}
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
            texture: { src: CRAFT_BUTTON_ICON }
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
