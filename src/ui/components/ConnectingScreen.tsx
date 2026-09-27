import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { multiplayerStatus } from '../../client/multiplayerState'
import { UI_GOLD, UI_MUTED } from '../visualTheme'

// Matches the logo art's own background so the image blends into the screen.
const LOGO_BG = Color4.create(0.047, 0.047, 0.055, 1)
const LOGO_WIDTH = 520
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 941) / 1672)
const TRACK_WIDTH = 220
const SWEEP_WIDTH = 64

// Full-screen wait while the client joins the shared raft (can take a while
// on slow connections), so it gets the game's logo and a live activity bar.
export function ConnectingScreen(): ReactEcs.JSX.Element {
  const travel = TRACK_WIDTH + SWEEP_WIDTH
  const offset = ((Date.now() / 5) % travel) - SWEEP_WIDTH
  const left = Math.max(0, offset)
  const width = Math.max(0, Math.min(TRACK_WIDTH, offset + SWEEP_WIDTH) - left)
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
      uiBackground={{ color: LOGO_BG }}
    >
      <UiEntity
        uiTransform={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
        uiBackground={{ textureMode: 'stretch', texture: { src: 'images/raft_game_logo.png' } }}
      />
      <Label value={multiplayerStatus()} fontSize={20} color={UI_MUTED} uiTransform={{ width: 600, height: 36, margin: { top: 8 } }} />
      <UiEntity
        uiTransform={{ width: TRACK_WIDTH, height: 4, borderRadius: 2, margin: { top: 14 } }}
        uiBackground={{ color: Color4.create(1, 1, 1, 0.1) }}
      >
        <UiEntity
          uiTransform={{ positionType: 'absolute', position: { top: 0, left }, width, height: 4, borderRadius: 2 }}
          uiBackground={{ color: UI_GOLD }}
        />
      </UiEntity>
    </UiEntity>
  )
}
