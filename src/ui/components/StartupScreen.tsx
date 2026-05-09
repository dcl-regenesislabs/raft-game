import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { requestLoad } from '../../client/saveClient'
import { IS_PRODUCTION } from '../../config/env'
import { applyDebugSeeds } from '../../runtime/debugSeeds'
import {
  dismissStartupGate,
  hasSavedGame,
  isSaveProbeComplete
} from '../startupGate'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_TEXTURE
} from '../theme'

// Full-screen title overlay shown on every scene boot. The scene
// thumbnail (which already has the RAFT GAME wordmark + characters
// burned in) is the background; the action buttons sit at the bottom.
// The LOAD button is dimmed and non-interactive until the save-
// existence probe (in saveClient) confirms a save is available, and
// reuses its own label as the "checking" indicator.

// Wide-screen variant of the scene thumbnail. Source is 1672×941
// (~16:9); the 1366×768 virtual canvas is also 16:9, so 'stretch'
// fills the frame without visible distortion.
const HERO_TEXTURE = 'images/raft_game_widescreen.png'
const BUTTON_W = 360
const BUTTON_H = CRAFT_BUTTON_H
// Same nine-slice fractions as the system menu buttons so the painted
// bevels keep their pixel size at this larger width.
const BUTTON_SLICE = { top: 0.2, right: 0.16, bottom: 0.2, left: 0.16 }
// Dim color tints applied to the LOAD button when no save exists.
const BUTTON_DIM_TINT = Color4.create(1, 1, 1, 0.35)
const BUTTON_DIM_LABEL = Color4.create(1, 1, 1, 0.5)
// Pulled in from the canvas bottom so the button column doesn't kiss
// the edge — leaves a strip of the raft / water visible underneath.
const BUTTONS_BOTTOM_PADDING = 48

export function StartupScreen(): ReactEcs.JSX.Element {
  const probeDone = isSaveProbeComplete()
  const canLoad = probeDone && hasSavedGame()
  // While the probe is in flight the load button doubles as the
  // status indicator — saves the player a separate "checking…" line.
  const loadLabel = probeDone ? 'LOAD GAME' : 'CHECKING SAVE…'
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: { bottom: BUTTONS_BOTTOM_PADDING }
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: HERO_TEXTURE }
      }}
    >
      <StartupActionButton
        label="NEW GAME"
        onPress={() => {
          dismissStartupGate()
        }}
      />
      <StartupActionButton
        label={loadLabel}
        enabled={canLoad}
        onPress={() => {
          dismissStartupGate()
          void requestLoad(false)
        }}
      />
      {!IS_PRODUCTION && (
        <StartupActionButton
          label="NEW GAME - DEBUG"
          onPress={() => {
            applyDebugSeeds()
            dismissStartupGate()
          }}
        />
      )}
    </UiEntity>
  )
}

function StartupActionButton(props: {
  label: string
  onPress: () => void
  enabled?: boolean
}): ReactEcs.JSX.Element {
  const enabled = props.enabled !== false
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
        color: enabled ? undefined : BUTTON_DIM_TINT
      }}
      onMouseDown={enabled ? props.onPress : undefined}
    >
      <Label
        value={props.label}
        fontSize={20}
        color={enabled ? CRAFT_BUTTON_FG : BUTTON_DIM_LABEL}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}
