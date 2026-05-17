import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import { getSlotDurabilityFraction } from '../items'

// Renders a thin horizontal life bar pinned to the bottom of an
// inventory slot. The bar is only emitted for slots that carry a
// `maxDurability` budget — every other slot (empty, stackable,
// durability-less tool) gets `null` back from
// `getSlotDurabilityFraction` and the component renders nothing.
//
// Fill colour ramps green → yellow → red as the tool wears down so
// the player gets a quick read on how close they are to breaking it
// even without parsing the bar length precisely.
const TRACK_COLOR = Color4.create(0, 0, 0, 0.55)
const FILL_GREEN = Color4.create(0.35, 0.85, 0.35, 1)
const FILL_YELLOW = Color4.create(0.95, 0.85, 0.25, 1)
const FILL_RED = Color4.create(0.95, 0.35, 0.3, 1)
const TRACK_HEIGHT_PCT = 6
const TRACK_INSET_PCT = 8

function pickFill(fraction: number): Color4 {
  if (fraction > 0.5) return FILL_GREEN
  if (fraction > 0.25) return FILL_YELLOW
  return FILL_RED
}

export function DurabilityBar(props: {
  slotIndex: number
}): ReactEcs.JSX.Element | null {
  const fraction = getSlotDurabilityFraction(props.slotIndex)
  if (fraction === null) return null
  const fill = pickFill(fraction)
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: {
          bottom: `${TRACK_INSET_PCT}%`,
          left: `${TRACK_INSET_PCT}%`,
          right: `${TRACK_INSET_PCT}%`
        },
        height: `${TRACK_HEIGHT_PCT}%`
      }}
      uiBackground={{ color: TRACK_COLOR }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: 0, bottom: 0, left: 0 },
          width: `${fraction * 100}%`
        }}
        uiBackground={{ color: fill }}
      />
    </UiEntity>
  )
}
