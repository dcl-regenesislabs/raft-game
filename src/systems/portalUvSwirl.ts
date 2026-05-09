import { MeshRenderer, engine } from '@dcl/sdk/ecs'

import { PortalUvSwirl } from '../components'
import { TAU, wrapUnit } from '../utils/math'

// Per-frame UV transform: scrolls offsets AND rotates the four corners
// around the texture centre so the portal swirls. The rotation pivots
// at (n/2, n/2) where n = tileCount, so a tileCount of 1 spins around
// (0.5, 0.5) — the centre of a single tile.
export function portalUvSwirlSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(PortalUvSwirl)) {
    const swirl = PortalUvSwirl.getMutable(entity)

    swirl.offsetU = wrapUnit(swirl.offsetU + swirl.speedU * dt)
    swirl.offsetV = wrapUnit(swirl.offsetV + swirl.speedV * dt)
    swirl.rotation = (swirl.rotation + swirl.rotSpeed * dt) % TAU

    const n = swirl.tileCount
    const c = n / 2
    const cos = Math.cos(swirl.rotation)
    const sin = Math.sin(swirl.rotation)

    const corners: [number, number][] = [
      [0, 0],
      [n, 0],
      [n, n],
      [0, n]
    ]
    const uvs: number[] = []
    for (const [u, v] of corners) {
      const ru = u - c
      const rv = v - c
      const tu = ru * cos - rv * sin + c + swirl.offsetU
      const tv = ru * sin + rv * cos + c + swirl.offsetV
      uvs.push(tu, tv)
    }

    MeshRenderer.setPlane(entity, [...uvs, ...uvs])
  }
}
