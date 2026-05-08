import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getItemReceivedView } from '../itemReceivedNotification'
import { Panel } from '../panel'
import {
  COUNT_BADGE_BG,
  COUNT_BADGE_FG,
  ITEM_NOTIF_BADGE_FONT_SIZE,
  ITEM_NOTIF_HEIGHT,
  ITEM_NOTIF_ICON_GAP,
  ITEM_NOTIF_ICON_SIZE,
  ITEM_NOTIF_PADDING_X,
  ITEM_NOTIF_TOP_INSET
} from '../theme'

// Slides in from offscreen (above) when items are received and parks at
// `ITEM_NOTIF_TOP_INSET` for the visible portion of its lifetime. Width
// adapts to the number of distinct items so 1 fish and 5 mixed materials
// both look balanced.
export function ItemReceivedOverlay(): ReactEcs.JSX.Element | null {
  const view = getItemReceivedView()
  if (view === null) return null
  const itemCount = view.items.length
  if (itemCount === 0) return null
  const innerWidth =
    itemCount * ITEM_NOTIF_ICON_SIZE +
    Math.max(0, itemCount - 1) * ITEM_NOTIF_ICON_GAP
  const panelWidth = innerWidth + ITEM_NOTIF_PADDING_X * 2
  const offscreenTop = -(ITEM_NOTIF_HEIGHT + ITEM_NOTIF_TOP_INSET)
  const top =
    offscreenTop + (ITEM_NOTIF_TOP_INSET - offscreenTop) * view.slide
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
          width: panelWidth,
          height: ITEM_NOTIF_HEIGHT,
          margin: { top: Math.round(top) },
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {view.items.map((item, i) => (
          <ItemBadge
            key={item.id}
            texture={item.texture}
            count={item.count}
            isFirst={i === 0}
          />
        ))}
      </Panel>
    </UiEntity>
  )
}

function ItemBadge(props: {
  texture: string
  count: number
  isFirst: boolean
  key?: string | number
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: ITEM_NOTIF_ICON_SIZE,
        height: ITEM_NOTIF_ICON_SIZE,
        margin: { left: props.isFirst ? 0 : ITEM_NOTIF_ICON_GAP }
      }}
    >
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: 0, left: 0, right: 0, bottom: 0 }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: props.texture }
        }}
      />
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { bottom: -4, right: -6 },
          minWidth: 28,
          height: 22,
          padding: { left: 6, right: 6 },
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{ color: COUNT_BADGE_BG }}
      >
        <Label
          value={`+${props.count}`}
          fontSize={ITEM_NOTIF_BADGE_FONT_SIZE}
          color={COUNT_BADGE_FG}
        />
      </UiEntity>
    </UiEntity>
  )
}
