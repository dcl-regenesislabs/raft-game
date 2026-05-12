import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import {
  getRaftBuilderMode,
  toggleRaftBuilderMode
} from '../../systems/raftBuilder'
import {
  ACTION_BUTTON_FRAME,
  ACTION_BUTTON_RIGHT,
  ACTION_BUTTON_SIZE,
  ACTION_BUTTON_TEXTURE,
  ACTION_BUTTON_TOP_PCT
} from '../theme'

// Gap between the existing ActionButton and this mode-toggle button when
// both are visible (mobile). On desktop the ActionButton is hidden in most
// states, so this button effectively floats alone on the right side, just
// inside ACTION_BUTTON_RIGHT + the frame width.
const MODE_TOGGLE_GAP = 16

// Horizontal offset from the right edge. Sits one full ActionButton frame
// (plus a small gap) to the left of where ActionButton renders so the two
// don't overlap on mobile.
const MODE_TOGGLE_RIGHT =
  ACTION_BUTTON_RIGHT + ACTION_BUTTON_FRAME + MODE_TOGGLE_GAP

// Right-side circular button that toggles the raft builder between
// placing and destroying. Only mounted while the hammer is equipped (the
// builder is in `placing` or `destroying` mode). On desktop a textual
// hint sits to the left of the button so keyboard players see what it
// does at a glance.
export function ModeToggleButton(): ReactEcs.JSX.Element | null {
  const mode = getRaftBuilderMode()
  if (mode === 'idle') return null
  const nextIsDestroy = mode === 'placing'
  const buttonText = nextIsDestroy ? 'DESTROY' : 'PLACE'
  const hintText = nextIsDestroy
    ? 'Switch to destruction mode'
    : 'Switch to placement mode'
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: `${ACTION_BUTTON_TOP_PCT}%`, right: MODE_TOGGLE_RIGHT },
        margin: { top: -Math.round(ACTION_BUTTON_FRAME / 2) },
        width: ACTION_BUTTON_FRAME,
        height: ACTION_BUTTON_FRAME,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {!isMobile() && <ModeToggleHint value={hintText} />}
      <UiEntity
        uiTransform={{
          width: ACTION_BUTTON_SIZE,
          height: ACTION_BUTTON_SIZE,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: ACTION_BUTTON_TEXTURE }
        }}
        onMouseDown={toggleRaftBuilderMode}
      >
        <Label
          value={buttonText}
          fontSize={22}
          color={MODE_TOGGLE_TEXT_COLOR}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

// Wood-brown matches the rotate-button label colour so the new button
// reads as part of the same desktop chrome family.
const MODE_TOGGLE_TEXT_COLOR = Color4.create(0.3, 0.18, 0.1, 1)

function ModeToggleHint(props: { value: string }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { right: '100%', top: '50%' },
        margin: { right: 8, top: -14 },
        height: 28,
        padding: { left: 12, right: 12 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.55) }}
    >
      <Label value={props.value} fontSize={16} color={Color4.White()} />
    </UiEntity>
  )
}
