// Adaptive panel using `panel.png` as a nine-slice background. The four
// painted corners stay pixel-correct at any size; the four edges stretch
// along their axis and the cream center fills the inside, so the panel can
// be sized to any width/height without distorting the wood frame.
//
// `textureSlices` values are 0..1 fractions of the source texture. The
// frame in `panel.png` is ~15% of the image on each side; tuned by eye
// against the painted bevel so the seam doesn't show on the corner pieces.

import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import type { UiTransformProps } from '@dcl/sdk/react-ecs'

const PANEL_TEXTURE = 'images/hud/panel_v2.png'
const PANEL_BORDER_FRACTION = 0.18

export interface PanelProps {
  uiTransform?: UiTransformProps
  children?: ReactEcs.JSX.Element | (ReactEcs.JSX.Element | null)[] | null
}

export function Panel(props: PanelProps): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={props.uiTransform}
      uiBackground={{
        textureMode: 'nine-slices',
        texture: { src: PANEL_TEXTURE },
        textureSlices: {
          top: PANEL_BORDER_FRACTION,
          right: PANEL_BORDER_FRACTION,
          bottom: PANEL_BORDER_FRACTION,
          left: PANEL_BORDER_FRACTION
        }
      }}
    >
      {props.children}
    </UiEntity>
  )
}
