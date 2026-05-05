import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { BAR_HEIGHT, BAR_WIDTH, INVENTORY_PANEL_SIZE } from '../theme'
import { BottomBarSurface } from './BottomBar'
import { InventoryGrid } from './InventoryPanel'

// Pull the bar up by this fraction of its rendered height so its top
// wood frame eats into the grid's bottom wood frame. Tuned just under
// the slot-top inset (~22% of bar height) so the painted slots stay
// fully inside the bar surface rather than poking up into the grid.
const BAR_OVERLAP_FRACTION_OF_HEIGHT = 0.2

// Combined inventory grid + 5-slot hot-bar, stacked vertically as a single
// reusable surface. Both halves scale from the same `size` so the painted
// art stays visually aligned at any width. Used by:
//   * the standalone inventory panel (bar replaces the always-on `BottomBar`
//     while the inventory is open),
//   * the craft menu's mini inventory (bar attaches under the grid so the
//     player sees their hot-bar without leaving the craft surface).
//
// Implementation note: children are absolutely positioned inside a fixed-
// size container instead of stacked with column-flex. A column-flex parent
// was visibly squeezing the bar narrower than the grid in some contexts
// (likely because `BottomBarSurface` has a wider intrinsic content than the
// grid PNG and the cross-axis `alignItems` interacted oddly with the
// explicit child widths). Absolute positioning sidesteps the flex layout
// pass entirely so both children render at exactly `size` wide.
export function InventoryWithBar(props: {
  size?: number
}): ReactEcs.JSX.Element {
  const size = props.size ?? INVENTORY_PANEL_SIZE
  // Bar PNG aspect ratio is BAR_WIDTH:BAR_HEIGHT (4:1). The bar's UI
  // width matches the grid so the painted frames line up at the same
  // x extents; height stays proportional so the painted cells aren't
  // distorted.
  const barHeight = Math.round(size * (BAR_HEIGHT / BAR_WIDTH))
  const overlap = Math.round(barHeight * BAR_OVERLAP_FRACTION_OF_HEIGHT)
  // Container reserves the full footprint of grid + bar minus the
  // overlap, so the surrounding layout sees one rectangle.
  const totalHeight = size + barHeight - overlap
  return (
    <UiEntity uiTransform={{ width: size, height: totalHeight }}>
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: 0, left: 0 },
          width: size,
          height: size
        }}
      >
        <InventoryGrid size={size} />
      </UiEntity>
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: size - overlap, left: 0 },
          width: size,
          height: barHeight
        }}
      >
        <BottomBarSurface width={size} />
      </UiEntity>
    </UiEntity>
  )
}
