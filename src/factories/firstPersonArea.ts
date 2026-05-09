import {
  CameraModeArea,
  CameraType,
  Entity,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { PARCEL_SIZE_M } from './sceneLevels'

// Force first-person across the whole scene by dropping a CameraModeArea
// volume centered on the parcel grid, sized to cover every parcel and tall
// enough that the player can't fall/jump out of it.
let firstPersonAreaEntity: Entity | null = null

export function createFirstPersonArea(parcelGrid: number): void {
  const sideM = parcelGrid * PARCEL_SIZE_M
  const center = sideM / 2

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(center, 0, center)
  })
  CameraModeArea.create(entity, {
    area: Vector3.create(sideM, 1000, sideM),
    mode: CameraType.CT_FIRST_PERSON
  })
  firstPersonAreaEntity = entity
}

// Returns the camera-mode-area entity created by createFirstPersonArea, or
// null if it hasn't been built yet. Used by the BACK TO LOBBY sweep to
// preserve the volume so the player stays in first-person after the
// game world is torn down.
export function getFirstPersonAreaEntity(): Entity | null {
  return firstPersonAreaEntity
}
