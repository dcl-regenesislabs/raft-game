import { MOBILE_TOOL_ACTION } from '../mobileToolInput'
import { isTouchFeedbackPressed, pressTouchFeedback, releaseTouchFeedback } from '../touchButtonFeedback'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { InputAction } from '@dcl/sdk/ecs'
import { resolveMobileControls, ControlAction } from '../../systems/touchControls'
import { getProximityConstruction } from '../../systems/lookAtTarget'
import { getRaftBuilderMode } from '../../systems/raftBuilder'
import { getConstructionPlacementMode } from '../../systems/constructionPlacement'
import { getFishingBiteIntensity, isFishingBiting } from '../../systems/fishingRod'
import { getMobileLayout } from '../mobileLayout'
const CONTROL_REST = 'images/hud/controls/rest.png'
const CONTROL_PRESSED = 'images/hud/controls/pressed.png'
const JUMP_ICON = 'images/hud/controls/jump.png'

// Bind real input rather than synthesizing a click: hold/release tools, native
// jump physics and multi-touch movement all use the same gameplay input path.
// Removing a binding when a panel opens also releases it in the renderer.
export function MobileActionControls(): ReactEcs.JSX.Element | null {
  const state = resolveMobileControls()
  if (!state.pointer.visible) return null
  const area = getMobileLayout(true)
  const proximity = getProximityConstruction() !== null &&
    getRaftBuilderMode() === 'idle' && getConstructionPlacementMode() === 'idle'
  const bite = isFishingBiting() ? getFishingBiteIntensity() : 0
  return <UiEntity uiTransform={{ positionType: 'absolute',
    position: { right: area.right + 20, bottom: area.bottom + 24 },
    width: 280, height: 280 }}>
    <TouchAction action={MOBILE_TOOL_ACTION} control={state.pointer}
      right={12} bottom={0} size={132} pulse={bite} />
    <TouchAction action={InputAction.IA_JUMP} control={{ visible: true, label: 'Jump', icon: JUMP_ICON }}
      right={170} bottom={0} size={88} />
    <TouchAction action={InputAction.IA_ACTION_3} control={state.shortcuts[0]}
      right={170} bottom={100} size={80} />
    {!proximity && <TouchAction action={InputAction.IA_PRIMARY} control={state.e}
      right={12} bottom={164} size={80} />}
    {!proximity && <TouchAction action={InputAction.IA_SECONDARY} control={state.f}
      right={106} bottom={194} size={80} />}
  </UiEntity>
}

function TouchAction(props: { action: InputAction; control: ControlAction;
  right: number; bottom: number; size: number; pulse?: number }): ReactEcs.JSX.Element | null {
  if (!props.control.visible) return null
  const held = isTouchFeedbackPressed(props.action)
  const pulse = props.pulse ?? 0
  // Keep the hit area stationary: resizing a held binding can cancel a touch
  // near its edge. Only the artwork changes size for feedback.
  const iconSize = props.action === MOBILE_TOOL_ACTION ? 66 : 64
  const artSize = props.size * iconSize / 100 * (held ? 0.94 : 1 + pulse * 0.04)
  return <UiEntity uiTransform={{ positionType: 'absolute',
    position: { right: props.right, bottom: props.bottom },
    width: props.size, height: props.size, alignItems: 'center', justifyContent: 'center' }}
    onMouseDown={() => pressTouchFeedback(props.action)}
    onMouseUp={() => releaseTouchFeedback(props.action)}
    onMouseLeave={() => releaseTouchFeedback(props.action)}
    uiInputBinding={{ actions: [props.action] }}
    uiBackground={{ textureMode: 'stretch', texture: {
      src: held || pulse > 0.5 ? CONTROL_PRESSED : CONTROL_REST
    } }}>
    {props.control.icon && <UiEntity uiTransform={{ width: artSize, height: artSize }}
      uiBackground={{ textureMode: 'stretch', texture: { src: props.control.icon } }} />}
  </UiEntity>
}
