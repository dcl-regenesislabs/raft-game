import {
  Entity,
  Material,
  MeshRenderer,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

import { DEMO_PARCEL_GRID, PARCEL_SIZE_M, SEABED_Y } from './sceneLevels'

const SAND_TEXTURE = 'assets/scene/seabed/sand.png'
// Sand grain reads as fine detail, so we keep ~2 repeats per parcel
// regardless of scene size (10 tiles for 5x5; 100 tiles for 50x50).
const TILES_PER_PARCEL = 2

export function createSeabed(parcelGrid: number = DEMO_PARCEL_GRID): Entity {
  const totalSize = parcelGrid * PARCEL_SIZE_M
  const tileCount = parcelGrid * TILES_PER_PARCEL

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(totalSize / 2, SEABED_Y, totalSize / 2),
    rotation: Quaternion.fromEulerDegrees(-90, 0, 0),
    scale: Vector3.create(totalSize, totalSize, 1)
  })

  MeshRenderer.setPlane(entity, buildTiledUVs(tileCount))

  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({
      src: SAND_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    roughness: 1,
    metallic: 0
  })

  return entity
}

function buildTiledUVs(n: number): number[] {
  const face = [0, 0, n, 0, n, n, 0, n]
  return [...face, ...face]
}
