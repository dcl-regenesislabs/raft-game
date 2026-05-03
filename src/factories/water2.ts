import {
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { WaterScroll } from '../components'
import { DEMO_PARCEL_GRID, PARCEL_SIZE_M, WATER_LEVEL } from './sceneLevels'

const WATER_TEXTURE = 'assets/scene/water/water-tile-v2.png'
const WATER_BUMP_TEXTURE = 'assets/scene/water/water-bump.png'
const WATER_Y = WATER_LEVEL
const WATER_ALPHA = 0.95
// One image repeat per parcel keeps a constant tile density across scene
// sizes (5 tiles for the demo, 50 for the BIG raft world).

export function createWaterFloorV2(parcelGrid: number = DEMO_PARCEL_GRID): Entity {
  const totalSize = parcelGrid * PARCEL_SIZE_M
  const tileCount = parcelGrid

  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(totalSize / 2, WATER_Y, totalSize / 2),
    rotation: Quaternion.fromEulerDegrees(-90, 0, 0),
    scale: Vector3.create(totalSize, totalSize, 1)
  })

  MeshRenderer.setPlane(entity, buildTiledUVs(tileCount))

  // Slow UV drift so the still texture looks like flowing water. The system
  // (systems/waterScroll.ts) overrides MeshRenderer.setPlane each frame.
  WaterScroll.create(entity, {
    speedU: 0.04,
    speedV: 0.025,
    offsetU: 0,
    offsetV: 0,
    tileCount: tileCount
  })

  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({
      src: WATER_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    bumpTexture: Material.Texture.Common({
      src: WATER_BUMP_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    albedoColor: Color4.create(1, 1, 1, WATER_ALPHA),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false,
    // Lower roughness + dim specular gives the bump map moving highlights —
    // crucial for "3D wave" feel. reflectivityColor is a dark blue tint
    // (not white/black) so what reflections do form pick up a water hue
    // instead of the actual skybox color.
    roughness: 0.5,
    metallic: 0,
    specularIntensity: 0.4,
    reflectivityColor: Color3.create(0.04, 0.06, 0.08)
  })

  return entity
}

// SDK7 plane has 4 vertices per side (front + back). With wrapMode REPEAT,
// UVs above 1 tile the texture; we set them to (0..n) so the image repeats
// `n` times across each axis.
function buildTiledUVs(n: number): number[] {
  const face = [0, 0, n, 0, n, n, 0, n]
  return [...face, ...face]
}
