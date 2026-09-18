import { MOBILE_TOOL_ACTION } from './mobileToolInput'
import { clearTouchFeedback, touchFeedbackSystem } from './touchButtonFeedback'
import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

let releaseRequired = false
let quietTime = 0

// Automatic fallback after consuming a placed item happens before other tool
// systems run. Block that same press on every platform, not just UI touches.
const EQUIPMENT_COOLDOWN_S = 0.4
let equipmentQuietTime = 0
let equipmentReleaseRequired = false
export function beginEquipmentTransition(): void {
  clearTouchFeedback()
  equipmentQuietTime = EQUIPMENT_COOLDOWN_S
  equipmentReleaseRequired = true
}
export function isEquipmentInputBlocked(): boolean {
  return equipmentReleaseRequired || equipmentQuietTime > 0
}

export function beginUiTouch(): void {
  clearTouchFeedback()
  if (!isMobile()) return
  releaseRequired = true
  quietTime = 0.15
}
export function isMobileUiInputBlocked(): boolean {
  // Some touch clients retain isPressed after a UI closes or native buttons
  // reflow. A fresh DOWN after the debounce is a new gesture, never a held one.
  if (releaseRequired && quietTime === 0 && [
    InputAction.IA_POINTER, InputAction.IA_PRIMARY, InputAction.IA_SECONDARY,
    InputAction.IA_ACTION_3, InputAction.IA_ACTION_4, MOBILE_TOOL_ACTION
  ].some(action => inputSystem.isTriggered(action, PointerEventType.PET_DOWN))) {
    releaseRequired = false
  }
  return isMobile() && (releaseRequired || quietTime > 0)
}
export function mobileUiInputSystem(dt: number): void {
  touchFeedbackSystem()
  equipmentQuietTime = Math.max(0, equipmentQuietTime - dt)
  // A release can arrive during the cooldown. Remember it; holding the action
  // longer than the cooldown must never activate the newly equipped tool.
  const toolAction = isMobile() ? MOBILE_TOOL_ACTION : InputAction.IA_POINTER
  if (!inputSystem.isPressed(toolAction) || inputSystem.isTriggered(toolAction, PointerEventType.PET_UP)) {
    equipmentReleaseRequired = false
  }
  quietTime = Math.max(0, quietTime - dt)
  if (quietTime === 0 && ![InputAction.IA_POINTER, InputAction.IA_PRIMARY, InputAction.IA_SECONDARY, InputAction.IA_ACTION_3, InputAction.IA_ACTION_4, InputAction.IA_ACTION_5, InputAction.IA_ACTION_6].some(action => inputSystem.isPressed(action))) {
    releaseRequired = false
  }
}
