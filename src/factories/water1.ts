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
// import { VideoPlayer } from '@dcl/sdk/ecs' // re-enable when switching back to MP4 water

import { WaterScroll } from '../components'
import { WATER_LEVEL } from './sceneLevels'

const PARCEL_GRID = 50
const PARCEL_SIZE = 16
const TOTAL_SIZE = PARCEL_GRID * PARCEL_SIZE // 800 m
const WATER_TEXTURE = 'assets/scene/water/water-tile.png'
const WATER_BUMP_TEXTURE = 'assets/scene/water/water-bump.png'
const WATER_Y = WATER_LEVEL
const WATER_ALPHA = 0.95
// One tile per parcel (16 m of world = one image repeat). Bigger = blurrier;
// smaller = more visible repetition. Tune as needed.
const TILE_COUNT = 50

export function createWaterFloorV1(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(TOTAL_SIZE / 2, WATER_Y, TOTAL_SIZE / 2),
    rotation: Quaternion.fromEulerDegrees(-90, 0, 0),
    scale: Vector3.create(TOTAL_SIZE, TOTAL_SIZE, 1)
  })

  MeshRenderer.setPlane(entity, buildTiledUVs(TILE_COUNT))

  // Slow UV drift so the still texture looks like flowing water. The system
  // (systems/waterScroll.ts) overrides MeshRenderer.setPlane each frame.
  WaterScroll.create(entity, {
    speedU: 0.04,
    speedV: 0.025,
    offsetU: 0,
    offsetV: 0,
    tileCount: TILE_COUNT
  })

  Material.setPbrMaterial(entity, {
    texture: Material.Texture.Common({
      src: WATER_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    // Normal map adds the illusion of ripples that catch light as the camera
    // moves. Shares the mesh UVs with the albedo, so the scroll system
    // animates both at once.
    bumpTexture: Material.Texture.Common({
      src: WATER_BUMP_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    albedoColor: Color4.create(1, 1, 1, WATER_ALPHA),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false,
    roughness: 1,
    metallic: 0,
    specularIntensity: 0,
    reflectivityColor: Color3.Black()
  })

  // --- Animated MP4 floor (kept for reference) -----------------------------
  // VideoPlayer.create(entity, {
  //   src: 'assets/scene/water/water-loop.mp4',
  //   playing: true,
  //   loop: true,
  //   volume: 0,
  //   playbackRate: 0.1
  // })
  // Material.setBasicMaterial(entity, {
  //   texture: Material.Texture.Video({ videoPlayerEntity: entity })
  // })
  // -------------------------------------------------------------------------

  return entity
}

// SDK7 plane has 4 vertices per side (front + back). With wrapMode REPEAT,
// UVs above 1 tile the texture; we set them to (0..n) so the image repeats
// `n` times across each axis.
function buildTiledUVs(n: number): number[] {
  const face = [0, 0, n, 0, n, n, 0, n]
  return [...face, ...face]
}
