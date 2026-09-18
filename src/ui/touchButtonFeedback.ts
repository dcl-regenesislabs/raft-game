import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'

// Global IA_POINTER also reflects unrelated UI touches. Visual feedback must
// belong to the control that actually received the press.
const heldButtons = new Set<InputAction>()
export function pressTouchFeedback(action: InputAction): void { heldButtons.add(action) }
export function releaseTouchFeedback(action: InputAction): void { heldButtons.delete(action) }
export function clearTouchFeedback(): void { heldButtons.clear() }
export function isTouchFeedbackPressed(action: InputAction): boolean { return heldButtons.has(action) }
export function touchFeedbackSystem(): void {
  for (const action of heldButtons) {
    if (!inputSystem.isPressed(action) || inputSystem.isTriggered(action, PointerEventType.PET_UP)) {
      heldButtons.delete(action)
    }
  }
}
