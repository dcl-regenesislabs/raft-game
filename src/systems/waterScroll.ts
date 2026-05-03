import { MeshRenderer, engine } from '@dcl/sdk/ecs'

import { WaterScroll } from '../components'
import { wrapUnit } from '../utils/math'

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

    // Both faces of the plane share the same mapping. The mesh-renderer
    // call signals the visual update; the UV offsets above are the reason
    // we touched the component mutably this frame.
    MeshRenderer.setPlane(entity, [
      u0, v0, u1, v0, u1, v1, u0, v1,
      u0, v0, u1, v0, u1, v1, u0, v1
    ])
  }
}
