import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import {
  getGameOverBackdropFade,
  getGameOverPanelFade,
  playAgain
} from '../gameOver'
import { Panel } from '../panel'
import { createPressPulse } from '../pressPulse'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_FRAME_H,
  CRAFT_BUTTON_FRAME_W,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_SLICE,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_BUTTON_W,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR
} from '../theme'

// Module-level pulse so the press scale-up survives React-ECS render
// rebuilds. Same trick the craft action button uses — see CraftMenu.
const playAgainPulse = createPressPulse()

// Fullscreen overlay drawn while `isGameOver()` is true. The dark backdrop
// is anchored to the root viewport (NOT inside SafeArea) so it bleeds past
// the safe-area insets and the player can't see the live scene through the
// notch / home-indicator strips on mobile.
//
// All interactive HUD content (GAME OVER copy + PLAY AGAIN button) sits
// inside its own centered column so it stays clear of the safe-area edges
// regardless of platform.
export function DeathScreen(): ReactEcs.JSX.Element {
  const backdropAlpha = getGameOverBackdropFade()
  const panelAlpha = getGameOverPanelFade()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, backdropAlpha) }}
    >
      {panelAlpha > 0 && (
        // Backdrop finishes darkening first; then the Panel and every
        // label/button inside it cross-fade in via per-element alpha.
        // The SDK doesn't propagate opacity down a subtree, so each
        // child multiplies its own color/alpha by panelAlpha.
        <Panel
          uiTransform={{
            width: 520,
            height: 360,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: { top: 48, bottom: 32, left: 40, right: 40 }
          }}
        >
          <Label
            value="GAME OVER"
            fontSize={48}
            color={withAlpha(CRAFT_TEXT_COLOR, panelAlpha)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 80 }}
          />
          <Label
            value="The sea took you. Want another shot?"
            fontSize={18}
            color={withAlpha(CRAFT_TEXT_DIM_COLOR, panelAlpha)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 60, margin: { top: 8 } }}
          />
          <PlayAgainButton fade={panelAlpha} />
        </Panel>
      )}
    </UiEntity>
  )
}

function withAlpha(c: Color4, a: number): Color4 {
  return Color4.create(c.r, c.g, c.b, c.a * a)
}

function PlayAgainButton(props: { fade: number }): ReactEcs.JSX.Element {
  const scale = playAgainPulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * 1.6 * scale)
  const h = Math.round(CRAFT_BUTTON_H * 1.6 * scale)
  // Suppress clicks until the button has nearly finished fading in so
  // a stray tap during the darkening sweep doesn't restart the run
  // before the player even sees the choice.
  const interactive = props.fade >= 0.95
  return (
    <UiEntity
      uiTransform={{
        width: Math.round(CRAFT_BUTTON_FRAME_W * 1.6),
        height: Math.round(CRAFT_BUTTON_FRAME_H * 1.6),
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 24 }
      }}
    >
      <UiEntity
        uiTransform={{
          width: w,
          height: h,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'nine-slices',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          textureSlices: {
            top: CRAFT_BUTTON_SLICE,
            right: CRAFT_BUTTON_SLICE,
            bottom: CRAFT_BUTTON_SLICE,
            left: CRAFT_BUTTON_SLICE
          },
          color: Color4.create(1, 1, 1, props.fade)
        }}
        onMouseDown={() => {
          if (!interactive) return
          playAgainPulse.press()
          playAgain()
        }}
      >
        <Label
          value="PLAY AGAIN"
          fontSize={20}
          color={withAlpha(CRAFT_BUTTON_FG, props.fade)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}
