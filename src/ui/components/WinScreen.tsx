import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { returnToLobby } from '../../runtime/sceneFlow'
import { formatTimeS } from '../../shared/rankingTypes'
import { Panel } from '../panel'
import { createPressPulse } from '../pressPulse'
import {
  dismissWin,
  getWinBackdropFade,
  getWinPanelFade,
  getWinTimeS
} from '../winScreen'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_FRAME_H,
  CRAFT_BUTTON_FRAME_W,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_BUTTON_W,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR
} from '../theme'

const lobbyPulse = createPressPulse()
const continuePulse = createPressPulse()

export function WinScreen(): ReactEcs.JSX.Element {
  const backdropAlpha = getWinBackdropFade()
  const panelAlpha = getWinPanelFade()
  const timeStr = formatTimeS(getWinTimeS())
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
        <Panel
          uiTransform={{
            width: 520,
            height: 500,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: { top: 48, bottom: 32, left: 40, right: 40 }
          }}
        >
          <Label
            value="YOU WON!"
            fontSize={48}
            color={withAlpha(CRAFT_TEXT_COLOR, panelAlpha)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 80 }}
          />
          <Label
            value={`Time: ${timeStr}`}
            fontSize={28}
            color={withAlpha(CRAFT_TEXT_COLOR, panelAlpha)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 50, margin: { top: 4 } }}
          />
          <Label
            value="The chef sails you home. Bravo!"
            fontSize={18}
            color={withAlpha(CRAFT_TEXT_DIM_COLOR, panelAlpha)}
            textAlign="middle-center"
            uiTransform={{ width: '100%', height: 50, margin: { top: 4 } }}
          />
          <ContinuePlayingButton fade={panelAlpha} />
          <ReturnToLobbyButton fade={panelAlpha} />
        </Panel>
      )}
    </UiEntity>
  )
}

function withAlpha(c: Color4, a: number): Color4 {
  return Color4.create(c.r, c.g, c.b, c.a * a)
}

function ContinuePlayingButton(props: { fade: number }): ReactEcs.JSX.Element {
  const scale = continuePulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * 1.6 * scale)
  const h = Math.round(CRAFT_BUTTON_H * 1.6 * scale)
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
          textureMode: 'stretch',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          color: Color4.create(1, 1, 1, props.fade)
        }}
        onMouseDown={() => {
          if (!interactive) return
          continuePulse.press()
          dismissWin()
        }}
      >
        <Label
          value="CONTINUE PLAYING"
          fontSize={18}
          color={withAlpha(CRAFT_BUTTON_FG, props.fade)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function ReturnToLobbyButton(props: { fade: number }): ReactEcs.JSX.Element {
  const scale = lobbyPulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * 1.6 * scale)
  const h = Math.round(CRAFT_BUTTON_H * 1.6 * scale)
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
          textureMode: 'stretch',
          texture: { src: CRAFT_BUTTON_TEXTURE },
          color: Color4.create(1, 1, 1, props.fade)
        }}
        onMouseDown={() => {
          if (!interactive) return
          lobbyPulse.press()
          returnToLobby()
        }}
      >
        <Label
          value="RETURN TO LOBBY"
          fontSize={18}
          color={withAlpha(CRAFT_BUTTON_FG, props.fade)}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}
