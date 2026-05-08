import { PointerLock, engine } from '@dcl/sdk/ecs'
import { isMobile } from '@dcl/sdk/platform'

// True when the renderer reports the mouse pointer is captured by the camera
// (FPS-style aim). Tool systems (spear, hook, hammer) gate fire input on
// this so a click that lives in the OS cursor — e.g. on a HUD element, or
// the click that re-locks the canvas after pressing Esc — never doubles as
// an in-game action.
//
// The renderer writes PointerLock onto the camera entity. On mobile/touch,
// pointer lock is meaningless — the OS cursor doesn't exist, taps drive
// actions directly — so we always report "locked" there. (Older SDKs left
// the component absent on mobile; newer ones write `isPointerLocked: false`,
// which would otherwise gate every touch action through this helper.)
export function isPointerLocked(): boolean {
  if (isMobile()) return true
  const lock = PointerLock.getOrNull(engine.CameraEntity)
  if (lock === null) return true
  return lock.isPointerLocked
}
