import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getNotification } from '../notification'
import { Panel } from '../panel'
import {
  NOTIFICATION_FONT_SIZE,
  NOTIFICATION_HEIGHT,
  NOTIFICATION_PADDING_X,
  NOTIFICATION_TEXT_COLOR,
  NOTIFICATION_TOP_INSET,
  NOTIFICATION_WIDTH
} from '../theme'

// Slides in from offscreen when `showNotification` is called and parks at
// `NOTIFICATION_TOP_INSET` for the visible portion of its lifetime.
export function NotificationOverlay(): ReactEcs.JSX.Element | null {
  const view = getNotification()
  if (view === null) return null
  // Slide from fully offscreen (-(height + top inset)) at slide=0 to the
  // resting NOTIFICATION_TOP_INSET at slide=1. Linear interpolation keeps
  // the easing concentrated in the slide curve itself.
  const offscreenTop = -(NOTIFICATION_HEIGHT + NOTIFICATION_TOP_INSET)
  const top =
    offscreenTop + (NOTIFICATION_TOP_INSET - offscreenTop) * view.slide
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
          padding: {
            left: NOTIFICATION_PADDING_X,
            right: NOTIFICATION_PADDING_X
          }
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
