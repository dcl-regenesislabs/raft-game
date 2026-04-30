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

import { SEABED_Y } from './sceneLevels'

const PARCEL_GRID = 50
const PARCEL_SIZE = 16
const TOTAL_SIZE = PARCEL_GRID * PARCEL_SIZE // 800 m
const SAND_TEXTURE = 'assets/scene/seabed/sand.png'
// Higher repeat than water: sand grain reads as fine detail, not as a tile.
const TILE_COUNT = 100

export function createSeabed(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(TOTAL_SIZE / 2, SEABED_Y, TOTAL_SIZE / 2),
    rotation: Quaternion.fromEulerDegrees(-90, 0, 0),
    scale: Vector3.create(TOTAL_SIZE, TOTAL_SIZE, 1)
  })

  MeshRenderer.setPlane(entity, buildTiledUVs(TILE_COUNT))

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
