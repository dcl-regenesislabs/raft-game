import {
  AvatarModifierArea,
  AvatarModifierType,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PARCEL_SIZE_M } from './sceneLevels'

// Hides every avatar (self + other players) anywhere in the scene by dropping
// an AvatarModifierArea that spans the parcel grid and is tall enough to
// cover the airspace players can reach. The hide effect only applies to
// avatars *inside* the volume, so it must cover wherever other players can
// actually be — the full scene footprint does that.
//
// Lifecycle: created by `buildGameWorld` when the player commits to a
// portal, and removed by the BACK TO LOBBY sweep (which deletes everything
// with a Transform except the explicit keep-set). Not built for the lobby
// itself — players still see each other while picking a portal.
export function createAvatarHideArea(parcelGrid: number): void {
  const sideM = parcelGrid * PARCEL_SIZE_M
  const center = sideM / 2

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(center, 0, center)
  })
  AvatarModifierArea.create(entity, {
    area: Vector3.create(sideM, 1000, sideM),
    excludeIds: [],
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS]
  })
}
