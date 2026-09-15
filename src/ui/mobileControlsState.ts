import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

let releaseRequired = false
let quietTime = 0

export function beginUiTouch(): void {
  if (!isMobile()) return
  releaseRequired = true
  quietTime = 0.15
}
export function isMobileUiInputBlocked(): boolean {
  // Some touch clients retain isPressed after a UI closes or native buttons
  // reflow. A fresh DOWN after the debounce is a new gesture, never a held one.
  if (releaseRequired && quietTime === 0 && [
    InputAction.IA_POINTER, InputAction.IA_PRIMARY, InputAction.IA_SECONDARY,
    InputAction.IA_ACTION_3, InputAction.IA_ACTION_4
  ].some(action => inputSystem.isTriggered(action, PointerEventType.PET_DOWN))) {
    releaseRequired = false
  }
  return isMobile() && (releaseRequired || quietTime > 0)
}
export function mobileUiInputSystem(dt: number): void {
  quietTime = Math.max(0, quietTime - dt)
  if (quietTime === 0 && ![InputAction.IA_POINTER, InputAction.IA_PRIMARY, InputAction.IA_SECONDARY, InputAction.IA_ACTION_3, InputAction.IA_ACTION_4, InputAction.IA_ACTION_5, InputAction.IA_ACTION_6].some(action => inputSystem.isPressed(action))) {
    releaseRequired = false
  }
}
