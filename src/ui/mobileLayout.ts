import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'

// Insets arrive in canvas pixels; scene dimensions use the 1600×720 virtual canvas.
export function getMobileLayout(hardwareOnly = false) {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  const scale = canvas ? Math.min(canvas.width / 1600, canvas.height / 720) : 1
  const divisor = Math.max(scale, 0.01)
  const area = hardwareOnly ? canvas?.screenInsetArea : canvas?.interactableArea
  const top = (area?.top ?? 0) / divisor
  const left = (area?.left ?? 0) / divisor
  const right = (area?.right ?? 0) / divisor
  const bottom = (area?.bottom ?? 0) / divisor
  return {
    top, left, right, bottom,
    width: (canvas?.width ?? 1600) / divisor - left - right,
    height: (canvas?.height ?? 720) / divisor - top - bottom
  }
}
