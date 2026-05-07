// Yaw applied to the construction ghost preview and the committed entity
// while the placement system is active. Lives outside the system so the
// HUD's top-middle Left/Right buttons can mutate it from React-ECS event
// handlers without reaching into the system module.

const STEP_DEG = 90

let rotationDeg = 0

export function getPlacementRotationDeg(): number {
  return rotationDeg
}

export function rotatePlacementLeft(): void {
  rotationDeg = wrap(rotationDeg - STEP_DEG)
}

export function rotatePlacementRight(): void {
  rotationDeg = wrap(rotationDeg + STEP_DEG)
}

export function resetPlacementRotation(): void {
  rotationDeg = 0
}

function wrap(deg: number): number {
  const mod = deg % 360
  return mod < 0 ? mod + 360 : mod
}
