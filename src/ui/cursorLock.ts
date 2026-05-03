// Pointer-lock gating is disabled: macOS / browser-embedded clients often
// fail to acquire pointer lock, which silently blocks every tool action. We
// always report "locked" so spear/hook/hammer/food/build inputs fire whether
// or not the cursor is captured. Selection-lockout (HUD interactions) is
// still handled separately via isSelectionPointerLockoutActive.
export function isPointerLocked(): boolean {
  return true
}
