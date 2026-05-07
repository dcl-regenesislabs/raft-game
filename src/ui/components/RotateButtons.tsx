import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'

import { getConstructionPlacementMode } from '../../systems/constructionPlacement'
import { getRaftBuilderMode } from '../../systems/raftBuilder'
import { rotatePlacementLeft, rotatePlacementRight } from '../placementRotation'
import {
  ROTATE_BUTTON_GAP,
  ROTATE_BUTTON_KEY_HINT_BOTTOM,
  ROTATE_BUTTON_KEY_HINT_SIZE,
  ROTATE_BUTTON_LABEL_COLOR,
  ROTATE_BUTTON_LABEL_SIZE,
  ROTATE_BUTTON_SIZE,
  ROTATE_BUTTON_TEXTURE,
  ROTATE_BUTTON_TOP
} from '../theme'

// Top-middle pair of "rotate left / rotate right" buttons. Mounted while
// the player is previewing any placement — a raft tile (hammer placing
// mode) or a construction (grill / purifier). Carries the desktop key
// hint (E / F) under each arrow so keyboard players know the binding
// without hunting through a help screen.
export function RotateButtons(): ReactEcs.JSX.Element | null {
  const placingActive =
    getConstructionPlacementMode() !== 'idle' ||
    getRaftBuilderMode() === 'placing'
  if (!placingActive) return null
  const showKeyHint = !isMobile()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: ROTATE_BUTTON_TOP },
        width: '100%',
        height: ROTATE_BUTTON_SIZE,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <RotateArrow
        label="<"
        keyHint={showKeyHint ? 'E' : null}
        onPress={rotatePlacementLeft}
      />
      <UiEntity uiTransform={{ width: ROTATE_BUTTON_GAP, height: 1 }} />
      <RotateArrow
        label=">"
        keyHint={showKeyHint ? 'F' : null}
        onPress={rotatePlacementRight}
      />
    </UiEntity>
  )
}

function RotateArrow(props: {
  label: string
  keyHint: string | null
  onPress: () => void
}): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: ROTATE_BUTTON_SIZE,
        height: ROTATE_BUTTON_SIZE,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: ROTATE_BUTTON_TEXTURE }
      }}
      onMouseDown={props.onPress}
    >
      <Label
        value={props.label}
        fontSize={ROTATE_BUTTON_LABEL_SIZE}
        color={ROTATE_BUTTON_LABEL_COLOR}
        textAlign="middle-center"
        uiTransform={{ width: '100%', height: '100%' }}
      />
      {props.keyHint !== null && (
        <Label
          value={props.keyHint}
          fontSize={ROTATE_BUTTON_KEY_HINT_SIZE}
          color={ROTATE_BUTTON_LABEL_COLOR}
          textAlign="middle-center"
          uiTransform={{
            positionType: 'absolute',
            position: { bottom: ROTATE_BUTTON_KEY_HINT_BOTTOM },
            width: '100%',
            height: ROTATE_BUTTON_KEY_HINT_SIZE
          }}
        />
      )}
    </UiEntity>
  )
}

