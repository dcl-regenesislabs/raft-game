import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { getConstructionPlacementMode } from '../../systems/constructionPlacement'
import { getRaftBuilderMode, toggleRaftBuilderMode } from '../../systems/raftBuilder'
import { rotatePlacementLeft, rotatePlacementRight } from '../placementRotation'
import { ROTATE_BUTTON_BOTTOM_DESKTOP } from '../theme'
import { UI_ACCENT, UI_BORDER, UI_CELL, UI_INK, UI_MUTED, UI_PAPER } from '../visualTheme'

const REMOVE_ACTIVE = Color4.create(0.62, 0.16, 0.16, 1)

// Desktop builder strip above the tool bar: BUILD / REMOVE switch while the
// hammer is equipped, plus the E / F rotate keys while a preview is placed.
export function BuilderControls(): ReactEcs.JSX.Element | null {
  const mode = getRaftBuilderMode()
  const hammer = mode !== 'idle'
  const rotating = mode === 'placing' || getConstructionPlacementMode() !== 'idle'
  if (!hammer && !rotating) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: ROTATE_BUTTON_BOTTOM_DESKTOP, left: 0, right: 0 },
        flexDirection: 'row',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          height: 56,
          padding: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: UI_BORDER,
          flexDirection: 'row',
          alignItems: 'center'
        }}
        uiBackground={{ color: UI_PAPER }}
      >
        {hammer && (
          <UiEntity uiTransform={{ flexDirection: 'row' }}>
            <Segment label="BUILD" active={mode === 'placing'} activeColor={UI_ACCENT} onPress={toggleRaftBuilderMode} />
            <Segment label="REMOVE" active={mode === 'destroying'} activeColor={REMOVE_ACTIVE} onPress={toggleRaftBuilderMode} />
          </UiEntity>
        )}
        {hammer && rotating && (
          <UiEntity uiTransform={{ width: 1, height: 28, margin: { left: 10, right: 10 } }} uiBackground={{ color: UI_BORDER }} />
        )}
        {rotating && (
          <UiEntity uiTransform={{ flexDirection: 'row' }}>
            <RotateKey arrow="<" hotkey="E" onPress={rotatePlacementLeft} />
            <RotateKey arrow=">" hotkey="F" onPress={rotatePlacementRight} marginLeft={6} />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  )
}

function Segment(props: { label: string; active: boolean; activeColor: Color4; onPress: () => void }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{ width: 96, height: 40, borderRadius: 8, margin: { right: 4 } }}
      uiBackground={{ color: props.active ? props.activeColor : UI_CELL }}
      onMouseDown={props.active ? undefined : props.onPress}
    >
      <Label
        value={props.label}
        fontSize={15}
        color={props.active ? UI_INK : UI_MUTED}
        uiTransform={{ width: '100%', height: '100%' }}
      />
    </UiEntity>
  )
}

function RotateKey(props: { arrow: string; hotkey: string; onPress: () => void; marginLeft?: number }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: 72,
        height: 40,
        borderRadius: 8,
        margin: { left: props.marginLeft ?? 0 },
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: UI_CELL }}
      onMouseDown={props.onPress}
    >
      <Label value={props.arrow} fontSize={22} color={UI_INK} uiTransform={{ width: 20, height: 32 }} />
      <UiEntity
        uiTransform={{ width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: UI_MUTED, margin: { left: 6 } }}
      >
        <Label value={props.hotkey} fontSize={13} color={UI_MUTED} uiTransform={{ width: '100%', height: '100%' }} />
      </UiEntity>
    </UiEntity>
  )
}
