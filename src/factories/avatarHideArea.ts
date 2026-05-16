import {
  AvatarModifierArea,
  AvatarModifierType,
  Entity,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PARCEL_SIZE_M } from './sceneLevels'

// Hides every avatar (self + other players) inside an XZ-spanning,
// Y-range-bounded volume. The hide effect only applies to avatars
// physically *inside* the volume, so callers pick the Y band that
// covers the avatars they want filtered out.
//
// Two callers today:
//   - Game world (`buildGameWorld`): wide-open band that covers the
//     entire scene airspace — every avatar is hidden for the duration
//     of the game session, removed by the BACK TO LOBBY sweep.
//   - Lobby (`createLobby`): band starting at the game's WATER_LEVEL
//     and extending up, so lobby visitors (who stand at LOBBY_RAFT_Y,
//     well below the game water) remain visible to each other while
//     anyone currently in-game (standing on rafts above water) is
//     hidden. Tagged with LobbyTag by the caller so `teardownLobby`
//     sweeps it when the player commits to a portal.
export interface AvatarHideAreaOptions {
  // World-space Y extents of the hide volume. Defaults span ±500 m
  // around y=0, matching the original "hide everything anywhere"
  // behaviour the game world relies on.
  minY?: number
  maxY?: number
}

export function createAvatarHideArea(
  parcelGrid: number,
  opts: AvatarHideAreaOptions = {}
): Entity {
  const sideM = parcelGrid * PARCEL_SIZE_M
  const center = sideM / 2
  const minY = opts.minY ?? -500
  const maxY = opts.maxY ?? 500
  const heightM = maxY - minY
  const yCenter = (minY + maxY) / 2

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(center, yCenter, center)
  })
  AvatarModifierArea.create(entity, {
    area: Vector3.create(sideM, heightM, sideM),
    excludeIds: [],
    modifiers: [
      AvatarModifierType.AMT_HIDE_AVATARS,
      AvatarModifierType.AMT_DISABLE_PASSPORTS
    ]
  })
  return entity
}
