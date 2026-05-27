import { isMobile } from '@dcl/sdk/platform'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { isMusicMuted, toggleMusicMuted } from '../../audio/music'
import {
  INVENTORY_BUTTON_FRAME,
  INVENTORY_BUTTON_SIZE,
  INVENTORY_BUTTON_TEXTURE,
  INVENTORY_BUTTON_TEXTURE_OPEN,
  INVENTORY_BUTTON_TOP,
  INVENTORY_BUTTON_TOP_DESKTOP,
  SYSTEM_BUTTON_RIGHT,
  SYSTEM_BUTTON_RIGHT_DESKTOP
} from '../theme'

const NOTE_COLOR = { r: 0.3, g: 0.18, b: 0.1, a: 1 }
const NOTE_MUTED_COLOR = { r: 0.55, g: 0.4, b: 0.3, a: 0.6 }

export function LobbyMusicButton(): ReactEcs.JSX.Element {
  const muted = isMusicMuted()
  const top = isMobile() ? INVENTORY_BUTTON_TOP : INVENTORY_BUTTON_TOP_DESKTOP
  const right = isMobile() ? SYSTEM_BUTTON_RIGHT : SYSTEM_BUTTON_RIGHT_DESKTOP
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top, right },
        width: INVENTORY_BUTTON_FRAME,
        height: INVENTORY_BUTTON_FRAME,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: INVENTORY_BUTTON_SIZE,
          height: INVENTORY_BUTTON_SIZE,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: {
            src: muted ? INVENTORY_BUTTON_TEXTURE_OPEN : INVENTORY_BUTTON_TEXTURE
          }
        }}
        onMouseDown={toggleMusicMuted}
      >
        <Label
          value={muted ? '♪ X' : '♪'}
          fontSize={40}
          color={muted ? NOTE_MUTED_COLOR : NOTE_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}
