import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { requestLoad } from '../../client/saveClient'
import { IS_PRODUCTION } from '../../config/env'
import { applyDebugSeeds } from '../../runtime/debugSeeds'
import {
  getStartupGateOpacity,
  hasSavedGame,
  isSaveProbeComplete,
  isStartupGateExiting,
  startStartupGateExit
} from '../startupGate'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_TEXTURE
} from '../theme'

// Full-screen title overlay shown on every scene boot. A solid black
// backdrop sits behind a centered RAFT GAME logo (transparent
// background) and the action buttons. Pressing a button starts an
// exit fade — the entire screen fades from opaque to transparent in
// lockstep, and the deferred action (load / debug seed / nothing) runs
// after the fade so the scene reveal isn't muddied by mid-fade state
// changes.

// Logo art with the wordmark on a transparent background — the screen
// backdrop shows through. Source is 1672×941 with the near-black pixels
// knocked out via ImageMagick fuzz. Rendered at fixed size so the
// wordmark doesn't bloat to fill the viewport.
const LOGO_TEXTURE = 'images/raft_game_logo.png'
const LOGO_W = 720
const LOGO_H = 405
const BUTTON_W = 360
const BUTTON_H = CRAFT_BUTTON_H
// Same nine-slice fractions as the system menu buttons so the painted
// bevels keep their pixel size at this larger width.
const BUTTON_SLICE = { top: 0.2, right: 0.16, bottom: 0.2, left: 0.16 }
// Multiplier on alpha for the LOAD button when no save exists or while
// the probe is still in flight. Combined with the gate's exit fade so
// dim and exit compose smoothly.
const BUTTON_DIM_FACTOR = 0.35
const BUTTON_DIM_LABEL_FACTOR = 0.5

export function StartupScreen(): ReactEcs.JSX.Element {
  const probeDone = isSaveProbeComplete()
  const canLoad = probeDone && hasSavedGame()
  const exiting = isStartupGateExiting()
  const opacity = getStartupGateOpacity()
  // While the probe is in flight the load button doubles as the
  // status indicator — saves the player a separate "checking…" line.
  const loadLabel = probeDone ? 'LOAD WORLD' : 'CHECKING SAVE…'
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, opacity) }}
    >
      <UiEntity
        uiTransform={{
          width: LOGO_W,
          height: LOGO_H,
          margin: { bottom: 16 }
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: LOGO_TEXTURE },
          color: Color4.create(1, 1, 1, opacity)
        }}
      />
      <StartupActionButton
        label="NEW WORLD"
        opacity={opacity}
        disabled={exiting}
        onPress={() => {
          startStartupGateExit(() => {})
        }}
      />
      <StartupActionButton
        label={loadLabel}
        opacity={opacity}
        enabled={canLoad}
        disabled={exiting}
        onPress={() => {
          startStartupGateExit(() => {
            void requestLoad(false)
          })
        }}
      />
      {!IS_PRODUCTION && (
        <StartupActionButton
          label="NEW WORLD - DEBUG"
          opacity={opacity}
          disabled={exiting}
          onPress={() => {
            startStartupGateExit(() => {
              applyDebugSeeds()
            })
          }}
        />
      )}
    </UiEntity>
  )
}

function StartupActionButton(props: {
  label: string
  onPress: () => void
  opacity: number
  enabled?: boolean
  disabled?: boolean
}): ReactEcs.JSX.Element {
  const enabled = props.enabled !== false
  const interactive = enabled && props.disabled !== true
  // Compose the gate's overall fade with the per-button dim state.
  const tintAlpha = props.opacity * (enabled ? 1 : BUTTON_DIM_FACTOR)
  const labelAlpha = props.opacity * (enabled ? 1 : BUTTON_DIM_LABEL_FACTOR)
  return (
    <UiEntity
      uiTransform={{
        width: BUTTON_W,
        height: BUTTON_H,
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 8, bottom: 8 }
      }}
      uiBackground={{
        textureMode: 'nine-slices',
        texture: { src: CRAFT_BUTTON_TEXTURE },
        textureSlices: BUTTON_SLICE,
        color: Color4.create(1, 1, 1, tintAlpha)
      }}
      onMouseDown={interactive ? props.onPress : undefined}
    >
      <Label
        value={props.label}
        fontSize={20}
        color={Color4.create(
          CRAFT_BUTTON_FG.r,
          CRAFT_BUTTON_FG.g,
          CRAFT_BUTTON_FG.b,
          enabled ? props.opacity : labelAlpha
        )}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}
