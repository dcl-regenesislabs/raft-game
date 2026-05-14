import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { isCraftOpen } from '../craftToggle'
import { type StatKind, getStat } from '../statsBars'
import {
  STAT_ICON_TEXTURES,
  STAT_SWEEP_TEXTURES,
  STATS_ORB_CONTAINER_TEXTURE,
  STATS_ORB_GAP,
  STATS_ORB_ICON_INSET_PCT,
  STATS_ORB_LEFT,
  STATS_ORB_SIZE,
  STATS_ORB_SWEEP_COLS,
  STATS_ORB_SWEEP_FRAMES,
  STATS_ORB_SWEEP_ROWS,
  STATS_ORB_TOP,
  STATS_ORDER
} from '../theme'

// Top-center row of three circular orbs (life / hunger / thirst). The
// shared `bar_container.png` is the empty state; the colored ring on
// top reveals CLOCKWISE from 12 o'clock as the stat fills 0 → 100%.
//
// React-ECS UI has no radial mask, so the clockwise reveal is baked
// into a 32-frame spritesheet per stat (`<kind>_sweep.png`, 8 cols × 4
// rows of 162×162 frames). Frame i shows the ring with only pixels
// inside the [0°, (i+1)/32 × 360°] arc kept opaque — the mask is
// computed in true polar coordinates, so the cut edge in every frame
// is an exact radius rather than an axis-aligned approximation.
//
// At runtime each orb renders ONE frame via `uiBackground.uvs`,
// selected by the stat's percentage. UV order is [BL, TL, TR, BR]
// clockwise with v=0 at bottom of source.
export function StatsBars(): ReactEcs.JSX.Element | null {
  if (isCraftOpen()) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: STATS_ORB_TOP, left: STATS_ORB_LEFT },
        height: STATS_ORB_SIZE,
        flexDirection: 'row',
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
  const raw = Math.max(0, Math.min(1, getStat(props.kind)))
  // Quantise to the 32 spritesheet steps. Frame 0 = first 1/32 filled,
  // frame 31 = full ring. At raw=0 nothing renders.
  const frameIdx = Math.min(
    STATS_ORB_SWEEP_FRAMES - 1,
    Math.floor(raw * STATS_ORB_SWEEP_FRAMES)
  )
  const showRing = raw > 0
  const col = frameIdx % STATS_ORB_SWEEP_COLS
  // Spritesheet rows count top-down in the PNG, but DCL UVs have v=0 at
  // the bottom — so the FIRST PNG row (row index 0) corresponds to the
  // highest v range. The frame at sheet-row r occupies
  // v ∈ [(R - r - 1) / R, (R - r) / R].
  const sheetRow = Math.floor(frameIdx / STATS_ORB_SWEEP_COLS)
  const uMin = col / STATS_ORB_SWEEP_COLS
  const uMax = (col + 1) / STATS_ORB_SWEEP_COLS
  const vMin = (STATS_ORB_SWEEP_ROWS - sheetRow - 1) / STATS_ORB_SWEEP_ROWS
  const vMax = (STATS_ORB_SWEEP_ROWS - sheetRow) / STATS_ORB_SWEEP_ROWS
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
      {showRing && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: 0, left: 0 },
            width: '100%',
            height: '100%'
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: STAT_SWEEP_TEXTURES[props.kind] },
            uvs: [uMin, vMin, uMin, vMax, uMax, vMax, uMax, vMin]
          }}
        />
      )}
      {/* Stat symbol inside the cream center. Rendered last so it sits
          on top of both the container and the ring, but the ring lives
          on the outer track so they never visually collide. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: {
            top: `${STATS_ORB_ICON_INSET_PCT}%`,
            bottom: `${STATS_ORB_ICON_INSET_PCT}%`,
            left: `${STATS_ORB_ICON_INSET_PCT}%`,
            right: `${STATS_ORB_ICON_INSET_PCT}%`
          }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: STAT_ICON_TEXTURES[props.kind] }
        }}
      />
    </UiEntity>
  )
}
