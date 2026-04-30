import { MeshRenderer, engine } from '@dcl/sdk/ecs'

import { WaterScroll } from '../components'

// Per-frame UV drift. Re-emits the tiled plane's UVs offset by an
// accumulating value so the still water texture appears to flow.
export function waterScrollSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(WaterScroll)) {
    const scroll = WaterScroll.getMutable(entity)

    scroll.offsetU = wrapUnit(scroll.offsetU + scroll.speedU * dt)
    scroll.offsetV = wrapUnit(scroll.offsetV + scroll.speedV * dt)

    const n = scroll.tileCount
    const u0 = scroll.offsetU
    const v0 = scroll.offsetV
    const u1 = u0 + n
    const v1 = v0 + n

    const face = [
      u0, v0, // BL
      u1, v0, // BR
      u1, v1, // TR
      u0, v1  // TL
    ]
    // Both faces of the plane share the same mapping.
    MeshRenderer.setPlane(entity, [...face, ...face])
  }
}

function wrapUnit(value: number): number {
  // Keep offsets bounded so floating-point precision doesn't degrade over time.
  // wrapMode REPEAT means any integer-shifted UV looks identical, so we wrap to [0,1).
  return ((value % 1) + 1) % 1
}
