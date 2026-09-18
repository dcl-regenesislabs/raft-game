import { MOBILE_TOOL_ACTION } from '../ui/mobileToolInput'
import { getSelectedSlot } from '../ui/inventoryState'
import { isMobileUiInputBlocked, isEquipmentInputBlocked } from '../ui/mobileControlsState'
import { InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

import {
  actionButtonJustPressed,
  isActionButtonPressed
} from '../ui/actionButton'

// Single seam for the held-tool fire input (rod cast / hook & anchor
// throw / spear stab / eat / placement commit).
//
// Desktop uses IA_POINTER; mobile uses a dedicated bound action so generic
// UI touches (including jump) cannot fire the held tool.
// Keep the legacy virtual button fallback for existing desktop fishing UI.
export const USE_NATIVE_POINTER = true

export function toolFireJustPressed(): boolean {
  if (isEquipmentInputBlocked() || isMobileUiInputBlocked() || (isMobile() && getSelectedSlot() < 0)) return false
  if (!USE_NATIVE_POINTER && isMobile()) return actionButtonJustPressed()
  return inputSystem.isTriggered(
    isMobile() ? MOBILE_TOOL_ACTION : InputAction.IA_POINTER,
    PointerEventType.PET_DOWN
  )
}

export function isToolFirePressed(): boolean {
  if (isEquipmentInputBlocked()) return false
  if (isMobile() && getSelectedSlot() < 0) return false
  if (!USE_NATIVE_POINTER && isMobile()) return isActionButtonPressed()
  return inputSystem.isPressed(isMobile() ? MOBILE_TOOL_ACTION : InputAction.IA_POINTER)
}

// Custom mobile input bindings emit global input. The caller supplies
// the same looked-at target and reach checks as its entity-targeted path.
export function mobileInteractionJustPressed(action: InputAction): boolean {
  return isMobile() && !isEquipmentInputBlocked() && !isMobileUiInputBlocked() && inputSystem.isTriggered(action === InputAction.IA_POINTER ? MOBILE_TOOL_ACTION : action, PointerEventType.PET_DOWN)
}
