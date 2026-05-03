// All visual constants the HUD reads — colors, sizes, insets, anchor
// percentages — live here so a designer can retune the look of the scene
// from one file. State and behaviour stay in their respective ui/ modules.

import { Color4 } from '@dcl/sdk/math'

import { type StatKind } from './statsBars'

// --- Banners ---------------------------------------------------------------
export const BANNER_BG = Color4.create(0.85, 0.18, 0.18, 0.85)
export const BANNER_FG = Color4.White()

// --- Bottom bar ------------------------------------------------------------
export const BAR_TEXTURE = 'images/hud/bottom-bar.png'
export const BAR_WIDTH_DESKTOP = 600
export const BAR_HEIGHT_DESKTOP = 150
// Mobile uses the same bar size as desktop, just docked to the screen edge.
export const BAR_WIDTH_MOBILE = BAR_WIDTH_DESKTOP
export const BAR_HEIGHT_MOBILE = BAR_HEIGHT_DESKTOP
export const BAR_BOTTOM_DESKTOP = 24
// Mobile bar pokes a few pixels past the bottom edge — there's no safe-area
// margin on the explorer, so it reads as "stuck to the bottom".
export const BAR_BOTTOM_MOBILE = -10
// Painted cell positions, measured from the source PNG (2508×627) by sampling
// the cream pixels. The cells are NOT evenly distributed across the bar:
// the wood frame leaves ~9% margin on each end and the cells sit ~17% apart
// center-to-center. Using justify-content:space-between would push the outer
// slots past the painted cells, so each slot is positioned absolutely on its
// measured center instead.
export const SLOT_CENTERS_PCT = [15.77, 32.78, 49.8, 66.81, 83.77]
export const SLOT_WIDTH_PCT = 14
// Item textures are square (324×324). The bar is rendered at BAR_WIDTH ×
// BAR_HEIGHT, so a slot sized purely in % would be non-square and stretch
// the item. Lock each slot to a square pixel size that fits inside the
// painted cell.
export function slotSizePx(barWidth: number): number {
  return Math.round((SLOT_WIDTH_PCT / 100) * barWidth)
}
export function slotTopPx(barWidth: number, barHeight: number): number {
  return Math.round((barHeight - slotSizePx(barWidth)) / 2)
}
// Idle icon inset (each side) — leaves a margin inside the painted cell.
export const ITEM_INSET_PCT_IDLE = 7
// Selected resting inset — overflows the cell so the icon stays "popped"
// while selected, instead of settling smaller.
export const ITEM_INSET_PCT_SELECTED = -8
// Peak overshoot inset added by the press pulse on top of resting state.
export const ITEM_INSET_PCT_PEAK_BONUS = -8
// Swap-mode selection: even more negative inset so the picked-up item
// reads as visibly larger than its resting state — the user's signal
// that this is the slot they're about to swap.
export const ITEM_INSET_PCT_SWAP_SELECTED = -22

// --- Glow / press feedback -------------------------------------------------
export const GLOW_COLOR = Color4.create(1.0, 0.85, 0.35, 1.0)
export const GLOW_ALPHA_SELECTED = 0
export const GLOW_ALPHA_PEAK_BONUS = 0.45

// --- Charge meter ----------------------------------------------------------
export const CHARGE_BAR_WIDTH = 120
export const CHARGE_BAR_HEIGHT = 8
// Vertical offset from screen center; positive = below the crosshair so the
// meter doesn't obscure the aim point.
export const CHARGE_BAR_OFFSET_Y = 32
export const CHARGE_TRACK_COLOR = Color4.create(0, 0, 0, 0.55)
export const CHARGE_FILL_COLOR = Color4.create(1, 0.78, 0.25, 1)
export const CHARGE_FILL_FULL_COLOR = Color4.create(1, 0.35, 0.2, 1)

// --- Mobile action button --------------------------------------------------
export const ACTION_BUTTON_TEXTURE = 'images/hud/button.png'
export const ACTION_BUTTON_TEXTURE_PRESSED = 'images/hud/selected-button.png'
export const ACTION_BUTTON_SIZE = 180
export const ACTION_BUTTON_RIGHT = 32
// Reserved size of the centering frame that holds the button. Has to be
// large enough to fit the button at its peak press-up scale (1 + bonus)
// so the button can grow without shifting the frame and reading as a
// "drift to the left".
export const ACTION_BUTTON_FRAME = Math.round(ACTION_BUTTON_SIZE * 1.25)
// Inset (each side, %) the tool icon sits inside the circle button so it
// fits within the painted cream center rather than the brown ring.
export const ACTION_BUTTON_ICON_INSET_PCT = 22

// --- Inventory panel -------------------------------------------------------
// The art (`inventory.png`) is a 900×900 PNG with a 5×5 grid of cream cells
// inset in a brown frame. Cell centers and widths were sampled from the
// source by histogramming bright pixels — the cells sit on a regular ~16%
// grid with each cell ~13.4% wide.
export const INVENTORY_PANEL_TEXTURE = 'images/hud/inventory.png'
// Match the bottom bar's width so the inventory's left edge lines up with
// the bar's left edge. Source art is square, so the panel is square too.
export const INVENTORY_PANEL_SIZE = BAR_WIDTH_DESKTOP
export const INVENTORY_GRID_CELLS = 5
export const INVENTORY_CELL_CENTERS_PCT = [17.8, 33.8, 49.8, 65.8, 81.8]
export const INVENTORY_CELL_SIZE_PCT = 13.4
// Inset the item icon a hair inside the painted cell so it doesn't bleed
// into the cream-to-brown transition pixels.
export const INVENTORY_ITEM_INSET_PCT = 10
// Swap-selected cells overflow the painted cell so the picked-up item
// stands out from the shaking neighbours.
export const INVENTORY_ITEM_INSET_PCT_SWAP_SELECTED = -10

// --- Count badge -----------------------------------------------------------
export const COUNT_BADGE_BG = Color4.create(0, 0, 0, 0.7)
export const COUNT_BADGE_FG = Color4.White()

// --- Inventory / craft toggle buttons --------------------------------------
export const INVENTORY_BUTTON_TEXTURE = 'images/hud/button.png'
export const INVENTORY_BUTTON_TEXTURE_OPEN = 'images/hud/selected-button.png'
export const INVENTORY_BUTTON_ICON = 'images/hud/backpack.png'
export const INVENTORY_BUTTON_SIZE = ACTION_BUTTON_SIZE
// Mobile sizes the top-row toggles to roughly match the native avatar
// circle in the top-right corner, so they read as part of the native
// HUD chrome rather than a third tier of buttons.
export const INVENTORY_BUTTON_SIZE_MOBILE = 140
// Mirror the bottom bar's edge-hug — a small negative inset so the button
// pokes a hair past the canvas top edge instead of sitting in mid-air.
export const INVENTORY_BUTTON_TOP = -20
// Mobile anchors the backpack so the visible button sits just left of the
// native avatar circle in the top-right corner. Step is sized to the
// mobile frame so the craft toggle nests right next to the backpack.
export const INVENTORY_BUTTON_LEFT_PCT_MOBILE = 80
export const INVENTORY_BUTTON_RIGHT_DESKTOP = 32
// Same trick as the action button: an outer frame sized to the peak-press
// scale prevents the button from shifting when it grows.
export const INVENTORY_BUTTON_FRAME = Math.round(INVENTORY_BUTTON_SIZE * 1.25)
export const INVENTORY_BUTTON_FRAME_MOBILE = Math.round(
  INVENTORY_BUTTON_SIZE_MOBILE * 1.25
)
export const INVENTORY_BUTTON_ICON_INSET_PCT = 24

export const CRAFT_BUTTON_ICON = 'images/hud/saw.png'
// Sit one button-size to the left of the backpack on desktop (visible edges
// flush, no gap from the frame padding), and a matching percentage step on
// mobile sized to clear the larger mobile frame.
export const CRAFT_BUTTON_RIGHT_DESKTOP =
  INVENTORY_BUTTON_RIGHT_DESKTOP + INVENTORY_BUTTON_SIZE
export const CRAFT_BUTTON_LEFT_PCT_MOBILE = INVENTORY_BUTTON_LEFT_PCT_MOBILE - 8

// --- Craft double-menu -----------------------------------------------------
// The list and details panels render centered using the nine-sliced
// `panel.png` background; the inventory grid is pinned to the bottom-left
// corner at a smaller size so the centered panels have breathing room in
// the middle of the screen.
export const CRAFT_LIST_WIDTH = 240
export const CRAFT_LIST_HEIGHT = 470
export const CRAFT_DETAILS_WIDTH = 360
// Inventory grid size when shown alongside the craft panels. Smaller than
// the standalone inventory so it doesn't dominate the bottom-left corner.
export const CRAFT_INVENTORY_SIZE = 320
export const CRAFT_INVENTORY_LEFT = 24
export const CRAFT_INVENTORY_BOTTOM = 24
// On mobile the bottom-left corner is taken by the joystick, so the
// craft-mode inventory grid relocates to the top-left where the stats
// bars normally sit (the bars are hidden while the craft menu is open,
// so the slot is free). Smaller than desktop so it fits next to the
// craft panels on a phone screen.
export const CRAFT_INVENTORY_SIZE_MOBILE = 260
export const CRAFT_INVENTORY_TOP_MOBILE = 100
export const CRAFT_INVENTORY_LEFT_MOBILE = 0
// Craft details panel grows with the recipe — header + description + the
// REQUIRES row + one row per material.
export const CRAFT_DETAILS_BASE_HEIGHT = 280
export const CRAFT_DETAILS_ROW_HEIGHT = 44
export const CRAFT_PANEL_GAP = 12
// Inset content past the painted bevel. Horizontal padding is bigger
// than vertical so labels and counts don't crowd the painted left/right
// frame; top padding is larger than bottom so the header sits visibly
// inside the wood frame instead of hugging the top bevel.
export const CRAFT_PANEL_PADDING_X = 40
export const CRAFT_PANEL_PADDING_TOP = 48
export const CRAFT_PANEL_PADDING_BOTTOM = 32
// Dark brown text reads against the cream panel center; the cream variant
// is for rows with a dark inset (selected craftable).
export const CRAFT_TEXT_COLOR = Color4.create(0.3, 0.18, 0.1, 1)
export const CRAFT_TEXT_DIM_COLOR = Color4.create(0.45, 0.3, 0.18, 1)
export const CRAFT_TEXT_LIGHT_COLOR = Color4.create(0.97, 0.92, 0.78, 1)
export const CRAFT_DIVIDER_COLOR = Color4.create(0.3, 0.18, 0.1, 0.5)
export const CRAFT_ROW_SELECTED_BG = Color4.create(0, 0, 0, 0.55)
export const CRAFT_BUTTON_TEXTURE = 'images/hud/red_button.png'
export const CRAFT_BUTTON_FG = Color4.White()
export const CRAFT_BUTTON_W = 90
export const CRAFT_BUTTON_H = 32
// Frame sized to the peak press scale (1 + peakBonus, generously rounded
// to 1.25×) so the button can grow without shifting the parent row.
export const CRAFT_BUTTON_FRAME_W = Math.round(CRAFT_BUTTON_W * 1.25)
export const CRAFT_BUTTON_FRAME_H = Math.round(CRAFT_BUTTON_H * 1.25)
// red_button.png has rounded ends; nine-slice keeps the corners pixel-correct
// when the size doesn't match the source aspect ratio.
export const CRAFT_BUTTON_SLICE = 0.2
export const CRAFT_HAVE_OK_COLOR = Color4.create(0.7, 1, 0.5, 1)
export const CRAFT_HAVE_LOW_COLOR = Color4.create(1, 0.55, 0.3, 1)

// --- Notification banner ---------------------------------------------------
// Sits above every other HUD element and slides in from offscreen when
// `showNotification` is called. Width is fixed so the pill doesn't reflow
// as the message changes.
export const NOTIFICATION_WIDTH = 520
export const NOTIFICATION_HEIGHT = 96
export const NOTIFICATION_TOP_INSET = 32
export const NOTIFICATION_PADDING_X = 48
export const NOTIFICATION_TEXT_COLOR = Color4.create(0.3, 0.18, 0.1, 1)
export const NOTIFICATION_FONT_SIZE = 22

// --- Stats bars ------------------------------------------------------------
// Source art `bar.png` is 600×124. The cream icon cell sits on the left,
// followed by a wood-framed dark track that we fill left-to-right.
// Percentages were measured from the source PNG.
export const STATS_BAR_TEXTURE = 'images/hud/bar.png'
export const STATS_BAR_WIDTH = 280
export const STATS_BAR_HEIGHT = Math.round(STATS_BAR_WIDTH * (124 / 600))
export const STATS_BAR_GAP = 6
export const STATS_BAR_LEFT = 64
export const STATS_BAR_BOTTOM = 24
// On mobile the bottom-left corner is occupied by the native joystick, so
// the bars relocate to the upper-left under the chat/compass/location pill
// row. Top inset clears those native widgets; left inset hugs the screen
// edge so the bars sit flush against the left margin.
export const STATS_BAR_TOP_MOBILE = 100
export const STATS_BAR_LEFT_MOBILE = 0
// Painted dark-track inset within the bar art. Fill grows from FILL_LEFT
// rightward up to FILL_RIGHT_LIMIT at 100%. Right limit stops at the
// painted dark-track edge so 100% doesn't bleed onto the wood frame.
export const STATS_FILL_LEFT_PCT = 21
export const STATS_FILL_RIGHT_LIMIT_PCT = 95
export const STATS_FILL_TOP_PCT = 32
export const STATS_FILL_BOTTOM_PCT = 30
// Icon cell bounds — generously oversized so the icons read big against
// the bar. Negative top/left lets the icon overflow the painted cream
// cell and sit visually larger than the cell itself.
export const STATS_ICON_LEFT_PCT = 0
export const STATS_ICON_TOP_PCT = 0
export const STATS_ICON_WIDTH_PCT = 26 * 0.8
export const STATS_ICON_HEIGHT_PCT = 120 * 0.8
// No inset — icons are tight crops, so let them fill the icon cell.
export const STATS_ICON_INSET_PCT = 0
export const STAT_ICON_TEXTURES: Record<StatKind, string> = {
  life: 'images/hud/icons/life.png',
  hunger: 'images/hud/icons/hungry.png',
  thirst: 'images/hud/icons/thirst.png'
}
// Tints for each stat — kept in the warm/saturated range so they read
// against the brown frame.
export const STAT_FILL_COLORS: Record<StatKind, ReturnType<typeof Color4.create>> = {
  life: Color4.create(0.85, 0.18, 0.18, 1),
  hunger: Color4.create(1.0, 0.6, 0.18, 1),
  thirst: Color4.create(0.25, 0.65, 1.0, 1)
}
export const STATS_ORDER: readonly StatKind[] = ['life', 'hunger', 'thirst']
