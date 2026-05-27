import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { DEBUG_MODE } from '../../config/gameConfig'
import { forceIslandSpawn } from '../../systems/islandSpawner'
import { triggerSharkAttack } from '../../systems/sharkDirector'
import { armBoatChefEvent } from '../../systems/boatChefDirector'
import { Panel } from '../panel'
import { isSystemMenuOpen, setSystemMenuOpen } from '../systemSession'
import {
  CRAFT_BUTTON_FG,
  CRAFT_BUTTON_H,
  CRAFT_BUTTON_TEXTURE,
  CRAFT_TEXT_COLOR,
  CRAFT_TEXT_DIM_COLOR
} from '../theme'

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 340
const BUTTON_W = 240
const BUTTON_SLICE = { top: 0.2, right: 0.16, bottom: 0.2, left: 0.16 }

export function DebugPanel(): ReactEcs.JSX.Element | null {
  if (!DEBUG_MODE || !isSystemMenuOpen()) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: PANEL_WIDTH + 48,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Panel
        uiTransform={{
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: { top: 48, bottom: 32, left: 24, right: 24 }
        }}
      >
        <Label
          value="DEBUG"
          fontSize={30}
          color={CRAFT_TEXT_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 48 }}
        />
        <Label
          value="Force spawn scripted events."
          fontSize={14}
          color={CRAFT_TEXT_DIM_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: 32, margin: { top: 4 } }}
        />
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: { top: 16 }
          }}
        >
          <DebugButton label="SPAWN ISLAND" onPress={() => { setSystemMenuOpen(false); forceIslandSpawn() }} />
          <DebugButton label="SHARK ATTACK" onPress={() => { setSystemMenuOpen(false); triggerSharkAttack() }} />
          <DebugButton label="SPAWN CHEF" onPress={() => { setSystemMenuOpen(false); armBoatChefEvent() }} />
        </UiEntity>
      </Panel>
    </UiEntity>
  )
}

function DebugButton(props: {
  label: string
  onPress: () => void
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: BUTTON_W,
        height: CRAFT_BUTTON_H,
        alignItems: 'center',
        justifyContent: 'center',
        margin: { top: 8 }
      }}
      uiBackground={{
        textureMode: 'nine-slices',
        texture: { src: CRAFT_BUTTON_TEXTURE },
        textureSlices: BUTTON_SLICE
      }}
      onMouseDown={props.onPress}
    >
      <Label
        value={props.label}
        fontSize={18}
        color={CRAFT_BUTTON_FG}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}
