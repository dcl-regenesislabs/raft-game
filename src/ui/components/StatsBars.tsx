import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { isCraftOpen } from '../craftToggle'
import { type StatKind, getStat } from '../statsBars'
import {
  STAT_RING_TEXTURES,
  STATS_ORB_CONTAINER_TEXTURE,
  STATS_ORB_GAP,
  STATS_ORB_SIZE,
  STATS_ORB_TOP,
  STATS_ORDER
} from '../theme'

// Top-center row of three circular orbs (life / hunger / thirst). The
// shared `bar_container.png` art is the empty state — brown wood ring +
// dark inner track + cream center. The colored RING texture for each
// stat is drawn on top of the dark track and revealed CLOCKWISE from 12
// o'clock as the stat fills 0 → 100%.
//
// Clockwise reveal is built from four quadrant slices because the React
// ECS UI surface has no native radial mask. Each quadrant samples the
// matching quarter of the source ring texture via `uiBackground.uvs`,
// sized and positioned so the visible portion of the quadrant exactly
// corresponds to the sweep angle inside that quadrant. UV corner order
// is [BL, TL, TR, BR] clockwise with v=0 at the bottom of the source.
export function StatsBars(): ReactEcs.JSX.Element | null {
  // Hide while the craft menu is open — the orbs sit at top-center,
  // where the craft panel header lives, and would crowd the modal.
  if (isCraftOpen()) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: STATS_ORB_TOP, left: 0, right: 0 },
        width: '100%',
        height: STATS_ORB_SIZE,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {STATS_ORDER.map((kind, i) => (
        <StatOrb
          key={kind}
          kind={kind}
          marginLeft={i === 0 ? 0 : STATS_ORB_GAP}
        />
      ))}
    </UiEntity>
  )
}

function StatOrb(props: {
  kind: StatKind
  marginLeft: number
  key?: string
}): ReactEcs.JSX.Element {
  // Snap the displayed value to 1% steps so the clockwise sweep only
  // advances when the underlying stat crosses a percent boundary.
  const raw = Math.max(0, Math.min(1, getStat(props.kind)))
  const t = Math.floor(raw * 100) / 100
  const ringTexture = STAT_RING_TEXTURES[props.kind]
  return (
    <UiEntity
      uiTransform={{
        width: STATS_ORB_SIZE,
        height: STATS_ORB_SIZE,
        margin: { left: props.marginLeft }
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: STATS_ORB_CONTAINER_TEXTURE }
      }}
    >
      <RingQuadrantTR t={t} texture={ringTexture} />
      <RingQuadrantBR t={t} texture={ringTexture} />
      <RingQuadrantBL t={t} texture={ringTexture} />
      <RingQuadrantTL t={t} texture={ringTexture} />
    </UiEntity>
  )
}

// localFraction(t, start) maps the overall 0..1 stat into a 0..1
// fraction inside one of the four 25% quadrants. Returns 0 below the
// quadrant's start and 1 above its end.
function localFraction(t: number, start: number): number {
  const local = (t - start) / 0.25
  if (local <= 0) return 0
  if (local >= 1) return 1
  return local
}

// Q1 — TOP-RIGHT of orb. Sweep: 12 o'clock → 3 o'clock. Fill grows
// horizontally left → right. UV samples the LEFT `p` strip of the
// source's top-right quadrant (u ∈ [0.5, 0.5 + 0.5p], v ∈ [0.5, 1]).
function RingQuadrantTR(props: { t: number; texture: string }): ReactEcs.JSX.Element | null {
  const p = localFraction(props.t, 0)
  if (p <= 0) return null
  const uRight = 0.5 + 0.5 * p
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: '50%' },
        width: `${p * 50}%`,
        height: '50%'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: props.texture },
        uvs: [0.5, 0.5, 0.5, 1.0, uRight, 1.0, uRight, 0.5]
      }}
    />
  )
}

// Q2 — BOTTOM-RIGHT of orb. Sweep: 3 → 6. Fill grows vertically
// top → bottom. UV samples the TOP `p` strip of the bottom-right
// source quadrant (u ∈ [0.5, 1], v ∈ [0.5 - 0.5p, 0.5]).
function RingQuadrantBR(props: { t: number; texture: string }): ReactEcs.JSX.Element | null {
  const p = localFraction(props.t, 0.25)
  if (p <= 0) return null
  const vBottom = 0.5 - 0.5 * p
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '50%', left: '50%' },
        width: '50%',
        height: `${p * 50}%`
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: props.texture },
        uvs: [0.5, vBottom, 0.5, 0.5, 1.0, 0.5, 1.0, vBottom]
      }}
    />
  )
}

// Q3 — BOTTOM-LEFT of orb. Sweep: 6 → 9. Fill grows horizontally
// right → left (right-anchored). UV samples the RIGHT `p` strip of the
// bottom-left source quadrant (u ∈ [0.5 - 0.5p, 0.5], v ∈ [0, 0.5]).
function RingQuadrantBL(props: { t: number; texture: string }): ReactEcs.JSX.Element | null {
  const p = localFraction(props.t, 0.5)
  if (p <= 0) return null
  const uLeft = 0.5 - 0.5 * p
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: '50%', right: '50%' },
        width: `${p * 50}%`,
        height: '50%'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: props.texture },
        uvs: [uLeft, 0, uLeft, 0.5, 0.5, 0.5, 0.5, 0]
      }}
    />
  )
}

// Q4 — TOP-LEFT of orb. Sweep: 9 → 12. Fill grows vertically
// bottom → top (bottom-anchored). UV samples the BOTTOM `p` strip of
// the top-left source quadrant (u ∈ [0, 0.5], v ∈ [0.5, 0.5 + 0.5p]).
function RingQuadrantTL(props: { t: number; texture: string }): ReactEcs.JSX.Element | null {
  const p = localFraction(props.t, 0.75)
  if (p <= 0) return null
  const vTop = 0.5 + 0.5 * p
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '50%', left: 0 },
        width: '50%',
        height: `${p * 50}%`
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: props.texture },
        uvs: [0, 0.5, 0, vTop, 0.5, vTop, 0.5, 0.5]
      }}
    />
  )
}
