import { MeshRenderer, engine } from '@dcl/sdk/ecs'

import { GrillFire } from '../components'

// Steps each grill's flame-sprite plane through the 11-frame fire
// spritesheet (4 cols × 3 rows; frame 11 / bottom-right cell is empty
// and skipped). UVs are re-emitted EVERY frame (same pattern as
// `waterScroll.ts`) — gating the `setPlane` call behind the frame
// advance leaves stale UVs on the component between advances.
//
// Plane vertex order in `MeshRenderer.setPlane`:
//   BL → (u0, v0)   BR → (u1, v0)   TR → (u1, v1)   TL → (u0, v1)
// In DCL UV space, V increases bottom→top (BL has v0, TL has v1), so
// to render image-row 0 (top of PNG) we map it to UV-row ROWS-1 (the
// top of UV space).
const FRAME_HZ = 12
const FRAME_DURATION = 1 / FRAME_HZ
const FRAME_COUNT = 11
const COLS = 4
const ROWS = 3

export function grillFireSystem(dt: number): void {
  for (const [entity] of engine.getEntitiesWith(GrillFire)) {
    const fire = GrillFire.getMutable(entity)
    fire.frameTimer += dt
    if (fire.frameTimer >= FRAME_DURATION) {
      fire.frameTimer -= FRAME_DURATION
      fire.currentFrame = (fire.currentFrame + 1) % FRAME_COUNT
    }

    const col = fire.currentFrame % COLS
    const imgRow = Math.floor(fire.currentFrame / COLS)
    const uvRow = ROWS - 1 - imgRow
    const u0 = col / COLS
    const u1 = (col + 1) / COLS
    const v0 = uvRow / ROWS
    const v1 = (uvRow + 1) / ROWS

    // The billboarded plane comes out rotated 90° from the viewer in
    // this scene, so we rotate the UV mapping 90° in the opposite
    // direction to cancel it. Mapping that lands the flame upright:
    //   BL plane → image BR  (u1, v0)
    //   BR plane → image TR  (u1, v1)
    //   TR plane → image TL  (u0, v1)
    //   TL plane → image BL  (u0, v0)
    MeshRenderer.setPlane(entity, [
      u1, v0, u1, v1, u0, v1, u0, v0,
      u1, v0, u1, v1, u0, v1, u0, v0
    ])
  }
}
