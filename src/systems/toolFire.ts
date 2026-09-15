import { getSelectedSlot } from '../ui/inventoryState'
import { isMobileUiInputBlocked } from '../ui/mobileControlsState'
import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import {
  actionButtonJustPressed,
  isActionButtonPressed
} from '../ui/actionButton'

// Single seam for the held-tool fire input (rod cast / hook & anchor
// throw / spear stab / eat / placement commit).
//
// Native mode (default): the real IA_POINTER press on every platform.
// On mobile that's the native on-screen pointer button, surfaced
// contextually by touchControls. isPointerLocked() is true on mobile,
// so consumers that gate on it behave the same on both platforms.
//
// Fallback mode (USE_NATIVE_POINTER = false): mobile reads the legacy
// custom ActionButton's virtual press instead — flip this single flag
// if the native client turns out to deliver global IA_POINTER for
// every screen tap (the e49a230 tap-hijack), which would make camera
// drags fire the held tool. ActionButton.tsx and touchControls key off
// the same flag, so the custom button re-mounts and the native pointer
// button stays hidden.
export const USE_NATIVE_POINTER = true

export function toolFireJustPressed(): boolean {
  if (isMobileUiInputBlocked() || (isMobile() && getSelectedSlot() < 0)) return false
  if (!USE_NATIVE_POINTER && isMobile()) return actionButtonJustPressed()
  return inputSystem.isTriggered(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN
  )
}

export function isToolFirePressed(): boolean {
  if (isMobile() && getSelectedSlot() < 0) return false
  if (!USE_NATIVE_POINTER && isMobile()) return isActionButtonPressed()
  return inputSystem.isPressed(InputAction.IA_POINTER)
}

// Native mobile interaction buttons emit global input. The caller supplies
// the same looked-at target and reach checks as its entity-targeted path.
export function mobileInteractionJustPressed(action: InputAction): boolean {
  return isMobile() && !isMobileUiInputBlocked() && inputSystem.isTriggered(action, PointerEventType.PET_DOWN)
}
