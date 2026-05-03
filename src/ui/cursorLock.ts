import { PointerLock, engine } from '@dcl/sdk/ecs'

// True when the renderer reports the mouse pointer is captured by the camera
// (FPS-style aim). Tool systems (spear, hook, hammer) gate fire input on
// this so a click that lives in the OS cursor — e.g. on a HUD element, or
// the click that re-locks the canvas after pressing Esc — never doubles as
// an in-game action.
//
// The renderer writes PointerLock onto the camera entity. On platforms that
// don't surface pointer lock at all (mobile/touch), the component is absent —
// treat that as "locked" so the on-screen action button and touch input
// continue to drive actions.
export function isPointerLocked(): boolean {
  const lock = PointerLock.getOrNull(engine.CameraEntity)
  if (lock === null) return true
  return lock.isPointerLocked
}
