// All visual constants the HUD reads — colors, sizes, insets, anchor
// percentages — live here so a designer can retune the look of the scene
// from one file. State and behaviour stay in their respective ui/ modules.

import { Color4 } from '@dcl/sdk/math'

import { type StatKind } from './statsBars'

// --- Banners ---------------------------------------------------------------
export const BANNER_BG = Color4.create(0.85, 0.18, 0.18, 0.85)
export const BANNER_FG = Color4.White()

// --- Bottom bar ------------------------------------------------------------
// Bottom-center anchor on both platforms. The virtual canvas (set in
// `setupUi`) handles the proportional scaling; per-platform overrides
// are no longer required.
export const BAR_TEXTURE = 'images/hud/bottom-bar.png'
export const BAR_WIDTH = 600
export const BAR_HEIGHT = 150
export const BAR_BOTTOM = 24
// Global hot-bar scale. Applied wherever the bar is rendered (standalone
// `BottomBar` and the bar inside `InventoryWithBar`) so both surfaces
// shrink together. Height tracks width via the painted aspect ratio.
export const BAR_SCALE = 0.96
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

// --- Action button (mobile only, middle-right anchor) ---------------------
export const ACTION_BUTTON_TEXTURE = 'images/hud/button.png'
export const ACTION_BUTTON_TEXTURE_PRESSED = 'images/hud/selected-button.png'
export const ACTION_BUTTON_SIZE = 180
export const ACTION_BUTTON_RIGHT = 32
export const ACTION_BUTTON_TOP_PCT = 50
// Reserved size of the centering frame that holds the button. Has to be
// large enough to fit the button at its peak press-up scale (1 + bonus)
// so the button can grow without shifting the frame and reading as a
// "drift to the left".
export const ACTION_BUTTON_FRAME = Math.round(ACTION_BUTTON_SIZE * 1.25)
// Inset (each side, %) the tool icon sits inside the circle button so it
// fits within the painted cream center rather than the brown ring.
export const ACTION_BUTTON_ICON_INSET_PCT = 22

// --- Rotate buttons (top-middle, placement-mode only) ---------------------
// Two circular buttons (left/right arrows) shown at the top-middle of the
// safe area while a construction is being placed. Reuse the same circular
// frame art as the other top-row toggles so the HUD vocabulary stays
// consistent.
export const ROTATE_BUTTON_TEXTURE = 'images/hud/button.png'
export const ROTATE_BUTTON_SIZE = 110
export const ROTATE_BUTTON_TOP = 24
// Gap between the two buttons (px). Pulled in tight so the pair reads as
// one rotation control.
export const ROTATE_BUTTON_GAP = 16
export const ROTATE_BUTTON_LABEL_COLOR = Color4.create(0.3, 0.18, 0.1, 1)
export const ROTATE_BUTTON_LABEL_SIZE = 48
// Desktop key-hint glyph rendered in the bottom-right corner of the wood
// frame ("E" / "F"). White so it reads against the warm wood texture
// without competing with the central arrow.
export const ROTATE_BUTTON_KEY_HINT_SIZE = 18
export const ROTATE_BUTTON_KEY_HINT_BOTTOM = 6
export const ROTATE_BUTTON_KEY_HINT_RIGHT = 10
export const ROTATE_BUTTON_KEY_HINT_COLOR = Color4.White()
// Lift the central arrow glyph a hair above the geometric center so it
// sits visually centered inside the painted cream circle (the cream area
// is offset slightly upward inside the wood frame).
export const ROTATE_BUTTON_LABEL_TOP_OFFSET = -6

// --- Inventory panel -------------------------------------------------------
// The art (`inventory.png`) is a 900×900 PNG with a 5×5 grid of cream cells
// inset in a brown frame. Cell centers and widths were sampled from the
// source by histogramming bright pixels — the cells sit on a regular ~16%
// grid with each cell ~13.4% wide.
export const INVENTORY_PANEL_TEXTURE = 'images/hud/inventory.png'
// Match the bottom bar's width so the panel reads as a vertical extension
// of the bar when both are open. Source art is square, so the panel is
// square too.
export const INVENTORY_PANEL_SIZE = BAR_WIDTH
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

// --- Inventory / craft toggle buttons (top-right anchor) ------------------
// Both toggle buttons sit in the top-right corner with the backpack
// closest to the right edge and the craft (saw) button to its left.
export const INVENTORY_BUTTON_TEXTURE = 'images/hud/button.png'
export const INVENTORY_BUTTON_TEXTURE_OPEN = 'images/hud/selected-button.png'
export const INVENTORY_BUTTON_ICON = 'images/hud/backpack.png'
// Smaller than the action button (hook): the backpack/craft pair sits
// at the top edge as menu toggles, not as in-game tools, so they should
// read as secondary chrome rather than dominating the screen.
export const INVENTORY_BUTTON_SIZE = 140
// Pulled slightly above the safe-area top edge so the circular frames
// nest visually into the corner. Shared by both top-right buttons.
export const INVENTORY_BUTTON_TOP = -15
// Same trick as the action button: an outer frame sized to the peak-press
// scale prevents the button from shifting when it grows.
export const INVENTORY_BUTTON_FRAME = Math.round(INVENTORY_BUTTON_SIZE * 1.25)
export const INVENTORY_BUTTON_ICON_INSET_PCT = 24

export const CRAFT_BUTTON_ICON = 'images/hud/saw.png'
export const SYSTEM_BUTTON_ICON = 'images/hud/icons/settings.png'

// Top-right row, ordered left→right as: SAW, BACKPACK, SETTINGS. The
// settings (system) button sits closest to the right edge; backpack is
// one step left; saw is two steps left. The -30 nudge per step tightens
// the gap so the trio reads as a single row.
export const SYSTEM_BUTTON_RIGHT = 100
export const INVENTORY_BUTTON_RIGHT =
  SYSTEM_BUTTON_RIGHT + INVENTORY_BUTTON_SIZE - 30
export const CRAFT_BUTTON_RIGHT =
  INVENTORY_BUTTON_RIGHT + INVENTORY_BUTTON_SIZE - 30
// Desktop snaps the trio into the actual top-right corner. The frame is
// 1.25× the button (~17.5px padding per side), so a small negative
// `top` and `right` nest the frame into the corner while keeping the
// visible button safely inside the canvas.
export const INVENTORY_BUTTON_TOP_DESKTOP = -15
export const SYSTEM_BUTTON_RIGHT_DESKTOP = 4
export const INVENTORY_BUTTON_RIGHT_DESKTOP =
  SYSTEM_BUTTON_RIGHT_DESKTOP + INVENTORY_BUTTON_SIZE - 30
export const CRAFT_BUTTON_RIGHT_DESKTOP =
  INVENTORY_BUTTON_RIGHT_DESKTOP + INVENTORY_BUTTON_SIZE - 30

// --- Craft double-menu -----------------------------------------------------
// Mini inventory + list + details render as one centered row on every
// client — every other HUD element hides while the craft menu is open
// (see `ui/index.tsx`), so the row owns the whole canvas. Mirrors the
// cook menu's layout.
export const CRAFT_LIST_WIDTH = 340
export const CRAFT_LIST_HEIGHT = 540
export const CRAFT_DETAILS_WIDTH = 360
export const CRAFT_INVENTORY_SIZE = 400
// Craft details panel grows with the recipe — header + description + the
// REQUIRES row + one row per material.
export const CRAFT_DETAILS_BASE_HEIGHT = 280
export const CRAFT_DETAILS_ROW_HEIGHT = 44
export const CRAFT_PANEL_GAP = 12
// Nudges the whole centered craft row right. Applied as paddingLeft on a
// `justifyContent: center` wrapper, so the visible shift is half this
// value.
export const CRAFT_PANEL_OFFSET_X = 160
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
// Source art is 324×152 (aspect ≈2.13). Rendered size keeps that ratio so
// nine-slice corners aren't crushed against each other.
export const CRAFT_BUTTON_W = 110
export const CRAFT_BUTTON_H = 52
// Frame sized to the peak press scale (1 + peakBonus, generously rounded
// to 1.25×) so the button can grow without shifting the parent row.
export const CRAFT_BUTTON_FRAME_W = Math.round(CRAFT_BUTTON_W * 1.25)
export const CRAFT_BUTTON_FRAME_H = Math.round(CRAFT_BUTTON_H * 1.25)
// `red_button.png` is rendered at the source's 2.13:1 aspect ratio
// (CRAFT_BUTTON_W / CRAFT_BUTTON_H, and the death-screen 1.6× variant
// keeps that ratio). A plain stretch reproduces the art 1:1 with no
// slicing math — nine-slicing here only mis-sized the corners because
// the texture is non-square (324×152).
export const CRAFT_HAVE_OK_COLOR = Color4.create(0.7, 1, 0.5, 1)
export const CRAFT_HAVE_LOW_COLOR = Color4.create(1, 0.55, 0.3, 1)

// --- Cooking menu ----------------------------------------------------------
// Two-panel cooking surface: recipe list on the left, recipe details
// on the right with a 2x2 ingredient grid → output cell + fuel slot
// underneath. Sized to feel like a "book" pair similar to the craft
// menu but tighter — fewer columns of info, no mini inventory.
// The cook menu is a single panel (no recipe list) — width/height keep
// the painted layout image inside the wood frame with breathing room.
export const COOK_DETAILS_WIDTH = 400
export const COOK_DETAILS_HEIGHT = 540
// Negative pulls the cook panel left so its painted wood frame overlaps
// the inventory's right edge — the two surfaces read as one cooking
// station. Bump toward 0 (or positive) to add breathing room.
export const COOK_PANEL_GAP = -20
// Red have/need badge shown in the bottom-right of a placed cell when
// the matched recipe wants more of that ingredient than the player
// currently has. Sits on top of the icon.
export const COOK_SHORTAGE_BG = Color4.create(0.85, 0.18, 0.18, 0.9)
export const COOK_SHORTAGE_FG = Color4.White()
// Tint multiplied onto inventory item icons that are NOT cook ingredients
// while the cook menu is open. Dims the icon to read as "this can't be
// dropped into the cook recipe" without hiding it entirely.
export const COOK_NON_INGREDIENT_TINT = Color4.create(0.35, 0.35, 0.35, 0.55)
// The cook recipe area uses a single painted layout PNG as its
// background — the 2x2 input grid, arrow, output cell and fuel cell are
// all part of the texture. Item icons are positioned absolutely on top
// at the painted cell centers. Source PNG is 874×754; cell centers and
// sizes were sampled from the painted cream interiors.
export const COOK_LAYOUT_TEXTURE = 'images/hud/cook_layout.png'
export const COOK_LAYOUT_WIDTH = 300
export const COOK_LAYOUT_HEIGHT = Math.round((COOK_LAYOUT_WIDTH * 754) / 874)
// Cell center positions, % of the painted texture (x: of width, y: of
// height). Input cells form the 2x2 grid; output is the larger right
// cell; fuel sits in its own cell beneath the grid with a fire icon
// already painted into the texture above it.
export const COOK_INPUT_CENTERS_PCT: ReadonlyArray<readonly [number, number]> = [
  [11.7, 13.3],
  [33.4, 13.3],
  [11.7, 38.2],
  [33.4, 38.2]
]
export const COOK_OUTPUT_CENTER_PCT: readonly [number, number] = [80.8, 25.7]
export const COOK_FUEL_CENTER_PCT: readonly [number, number] = [22.5, 85.1]
// Cell sizes as a fraction of the painted texture width — the painted
// cream interiors the icons sit in. Inputs and fuel are the same square
// size; output is roughly 1.6× larger.
export const COOK_INPUT_ICON_SIZE_PCT = 14
export const COOK_OUTPUT_ICON_SIZE_PCT = 22
export const COOK_FUEL_ICON_SIZE_PCT = 13

// --- Cook recipes list -----------------------------------------------------
// Vertical list of LEARNED cooking recipes rendered to the right of the
// cook panel. Width is narrower than the craft list — only icon + name,
// no quantity column — so the surface fits next to the inventory + cook
// panel without spilling off-canvas. Height matches the cook panel so
// the two surfaces align like a book spread.
export const COOK_LIST_WIDTH = 240
export const COOK_LIST_HEIGHT = COOK_DETAILS_HEIGHT
// Margin between cook panel and recipes list. Positive = visible seam,
// nudges the recipes panel rightward (the whole row is centered, so an
// extra few pixels of margin push the right panel toward the screen
// edge without colliding with the cook panel's wood frame).
export const COOK_LIST_GAP = 8
// Horizontal padding inside the recipes list. Tighter than the craft
// list's 40 because the rows are narrow (240 wide) — pulling the
// frame in lets recipe names sit on a single line and leaves room for
// the count badge on the right.
export const COOK_LIST_PADDING_X = 14
// Per-row height inside the recipes list. Tighter than the craft rows
// (50) — recipe rows are icon + label only and we want as many learned
// recipes visible at once as possible without scrolling.
export const COOK_RECIPE_ROW_HEIGHT = 44
export const COOK_RECIPE_ICON_SIZE = 36

// --- Close button (shared across panels) -----------------------------------
// Round wood-framed red X button used in the top-right corner of the
// craft, inventory, and cook panels. One image, one size — the visual
// stays consistent so the player learns "circle X = close this panel"
// once and recognizes it everywhere.
export const CLOSE_BUTTON_TEXTURE = 'images/hud/close_button.png'
export const CLOSE_BUTTON_SIZE = 48
// Per-panel nudge values. Each panel positions its close button slightly
// differently — these knobs let you tune the offset on one panel without
// touching the others. Positive values push the button down/right;
// negative values push it up/left.
//
// Inventory panel: anchored absolutely to the top-right corner of the
// inventory grid. `TOP`/`RIGHT` are pixel offsets — negative values pull
// the button outside the grid frame so it overlaps the painted wood
// border instead of crowding the cells inside.
export const CLOSE_BUTTON_INVENTORY_TOP = 24
export const CLOSE_BUTTON_INVENTORY_RIGHT = 24
// Craft details (HAMMER) panel: lives inside the header row, after the
// title label. `MARGIN_*` shifts it relative to that flow position.
export const CLOSE_BUTTON_CRAFT_MARGIN_TOP = -130
export const CLOSE_BUTTON_CRAFT_MARGIN_RIGHT = -60
// Cook panel: same flow-position pattern as the craft details header.
export const CLOSE_BUTTON_COOK_MARGIN_TOP = -130
export const CLOSE_BUTTON_COOK_MARGIN_RIGHT = -60

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

// --- Item received banner --------------------------------------------------
// Sibling banner to the warning text notification but renders item icons
// for acquisitions (hook / fishing / shark / cook / craft / purify).
// Width adapts to the number of icons; height is fixed.
export const ITEM_NOTIF_HEIGHT = 92
export const ITEM_NOTIF_PADDING_X = 28
export const ITEM_NOTIF_ICON_SIZE = 56
export const ITEM_NOTIF_ICON_GAP = 14
// Sits below the text-notification slot so a warning can stack above an
// item drop without overlap on the rare occasions both fire close together.
export const ITEM_NOTIF_TOP_INSET = NOTIFICATION_TOP_INSET + NOTIFICATION_HEIGHT + 12
export const ITEM_NOTIF_BADGE_FONT_SIZE = 16

// --- Stats orbs (top-center anchor, circular) -----------------------------
// Each vital is a wood-framed circular orb. The `bar_container.png` art
// is the shared empty state — a brown wooden ring with a dark inner
// track and cream center. On top of that, a colored RING (per-stat art:
// life_ring / hungry_ring / thirsty_ring) reveals clockwise from the 12
// o'clock position as the stat fills, occupying the dark track. At 100%
// the ring is fully drawn over the track; at 0% it's invisible.
export const STATS_ORB_CONTAINER_TEXTURE = 'images/hud/icons/bar_container.png'
export const STATS_ORB_SIZE = 72
export const STATS_ORB_GAP = 8
// Top-left anchor in fixed pixels so the cluster sits at the same
// on-screen spot on both mobile and desktop. Percentage offsets drift
// with viewport width and broke parity between platforms.
export const STATS_ORB_TOP = 24
export const STATS_ORB_LEFT = 360
// Desktop has no front-camera notch and the chat/minimap chrome sits
// outside the UI canvas, so the orbs can hug the top-left corner
// instead of the centered mobile anchor.
export const STATS_ORB_TOP_DESKTOP = 4
export const STATS_ORB_LEFT_DESKTOP = 240
// Per-stat ring-reveal SPRITESHEETS. Each is a 4×4 grid of 16 frames at
// 64×64 per cell, total 256×256 — the mobile texture-optimizer caps all
// HUD textures at 256×256, so we ship at that exact size to avoid lossy
// resampling on device. Frame i shows the ring revealed clockwise from
// 12 o'clock through (i+1)/16 of the full circle. The mask is computed
// in real polar coordinates (Python pre-process step), so the cut edge
// in every frame is a true radius — not an axis-aligned approximation.
// At runtime we pick the frame matching the current stat percentage and
// sample it with UVs; no quadrant/octant decomposition needed.
export const STAT_SWEEP_TEXTURES: Record<StatKind, string> = {
  life: 'images/hud/icons/life_sweep.png',
  hunger: 'images/hud/icons/hungry_sweep.png',
  thirst: 'images/hud/icons/thirsty_sweep.png'
}
export const STATS_ORB_SWEEP_FRAMES = 16
export const STATS_ORB_SWEEP_COLS = 4
export const STATS_ORB_SWEEP_ROWS = 4
// Inner stat-symbol icons rendered inside the cream center of each orb.
// Sit on top of bar_container and below the sweeping ring overlay, but
// since the ring sits on the outer wood/track band the icon stays
// readable regardless of fill state.
export const STAT_ICON_TEXTURES: Record<StatKind, string> = {
  life: 'images/hud/icons/life.png',
  hunger: 'images/hud/icons/hungry.png',
  thirst: 'images/hud/icons/thirst.png'
}
// Inset (each side, %) of the icon inside the orb. At 14% the icon
// fills 72% of the orb (~2× larger than the 36% it occupied at the
// earlier 32% inset). It now overflows the cream center and sits on
// top of the dark track, but the icon textures have transparent
// backgrounds so only the symbol pixels overlay the track.
export const STATS_ORB_ICON_INSET_PCT = 14
// Order drives the visual row left → right.
export const STATS_ORDER: readonly StatKind[] = ['life', 'hunger', 'thirst']
