import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import { type StatKind, getStat } from '../statsBars'
import {
  STAT_FILL_COLORS,
  STAT_ICON_TEXTURES,
  STATS_BAR_BOTTOM,
  STATS_BAR_GAP,
  STATS_BAR_HEIGHT,
  STATS_BAR_LEFT,
  STATS_BAR_LEFT_MOBILE,
  STATS_BAR_TEXTURE,
  STATS_BAR_TOP_MOBILE,
  STATS_BAR_WIDTH,
  STATS_FILL_BOTTOM_PCT,
  STATS_FILL_LEFT_PCT,
  STATS_FILL_RIGHT_LIMIT_PCT,
  STATS_FILL_TOP_PCT,
  STATS_ICON_HEIGHT_PCT,
  STATS_ICON_INSET_PCT,
  STATS_ICON_LEFT_PCT,
  STATS_ICON_TOP_PCT,
  STATS_ICON_WIDTH_PCT,
  STATS_ORDER
} from '../theme'

// Stack vertically, anchored to the bottom-left corner on desktop and to
// the upper-left corner on mobile (the bottom-left corner is reserved for
// the native joystick on touch devices). STATS_ORDER drives the visual
// order so the first entry renders on top.
export function StatsBars(): ReactEcs.JSX.Element {
  const totalHeight =
    STATS_ORDER.length * STATS_BAR_HEIGHT +
    (STATS_ORDER.length - 1) * STATS_BAR_GAP
  const mobile = isMobile()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: mobile
          ? { top: STATS_BAR_TOP_MOBILE, left: STATS_BAR_LEFT_MOBILE }
          : { bottom: STATS_BAR_BOTTOM, left: STATS_BAR_LEFT },
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
