import { getExpansionModel } from './models'
import {
  ColliderLayer, Entity, GltfContainer, Material,
  MaterialTransparencyMode, MeshCollider, MeshRenderer, Transform, engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

// Prototype artwork is shared with inventory icons. Keep full-resolution Meshy
// references in images/concepts; only optimized copies ship as world textures.
export const spriteTexture = (kind: string) => `images/scene/expansion/${kind}.png`
const visuals = new Map<Entity, { kind: string; children: Entity[] }>()
export function getSpriteKind(entity: Entity): string | undefined {
  return visuals.get(entity)?.kind
}
export function spriteSize(kind: string): number {
  if (['sail', 'antennaMast', 'lookoutPost', 'upperFloor', 'towerPlatform', 'stairs'].includes(kind)) return 3
  if (['wall', 'gate', 'railing', 'armoredFoundation', 'spikeStrip'].includes(kind)) return 2.7
  return 1.8
}
export function paintSprite(entity: Entity, kind: string, tint?: Color4): void {
  MeshRenderer.setPlane(entity)
  const texture = Material.Texture.Common({ src: spriteTexture(kind) })
  // Explicit cutout writes depth; alpha blending lets the ocean show through.
  Material.setPbrMaterial(entity, {
    texture, emissiveTexture: texture, emissiveColor: tint ? Color3.create(tint.r, tint.g, tint.b) : Color3.White(),
    emissiveIntensity: 1, albedoColor: Color4.create(0, 0, 0, 1),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST, alphaTest: 0.1,
    castShadows: false, roughness: 1, metallic: 0, specularIntensity: 0
  })
}

// The root has uniform world scale. Sprite and physical shapes are siblings:
// both inherit the placed rotation, without following the camera.
export function attachPrototypeSprite(root: Entity, kind: string, physical = true): void {
  const children: Entity[] = []
  const sprite = engine.addEntity()
  children.push(sprite)
  const model = getExpansionModel(kind)
  if (model) {
    Transform.create(sprite, {
      parent: root,
      position: Vector3.create(0, model.deckOffset - 0.9, 0),
      scale: Vector3.create(model.scale, model.scale, model.scale)
    })
    // Logical root owns pointer events; simple collision proxies stay separate.
    GltfContainer.create(sprite, { src: model.src, visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: 0 })
  } else {
    const size = spriteSize(kind)
    Transform.create(sprite, { parent: root, position: Vector3.create(0, size / 2 - 0.7, 0), scale: Vector3.create(size, size, 1) })
    paintSprite(sprite, kind)
  }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number) => {
    const e = engine.addEntity()
    children.push(e)
    Transform.create(e, { parent: root, position: Vector3.create(x, y - 0.7, z), scale: Vector3.create(w, h, d) })
    MeshCollider.setBox(e, ColliderLayer.CL_PHYSICS)
  }
  // Pointer ray targets stay on the logical root so placement can resolve tiles.
  MeshCollider.setBox(root, ColliderLayer.CL_POINTER)
  if (physical) {
    if (model) {
      const { min, max, scale } = model
      const height = (max[1] - min[1]) * scale
      box((min[0] + max[0]) * scale / 2, height / 2, (min[2] + max[2]) * scale / 2,
        (max[0] - min[0]) * scale, height, (max[2] - min[2]) * scale)
    } else if (kind === 'stairs') {
      for (let i = 0; i < 8; i++) box(0, (i + 1) * 0.14, -1.2 + i * 0.32, 2, (i + 1) * 0.28, 0.32)
    } else if (['upperFloor', 'towerPlatform', 'lookoutPost'].includes(kind)) {
      box(0, 2.25, 0, 2.7, 0.15, 2.7)
      for (const x of [-1.15, 1.15]) for (const z of [-1.15, 1.15]) box(x, 1.1, z, 0.12, 2.2, 0.12)
    } else if (['wall', 'gate', 'railing', 'ropeBarricade'].includes(kind)) {
      const h = kind === 'wall' || kind === 'gate' ? 2 : 1
      box(0, h / 2, 0, 2.3, h, 0.2)
    } else if (kind === 'armoredFoundation') box(0, 0.08, 0, 2.9, 0.16, 2.9)
    else if (kind !== 'spikeStrip') box(0, 0.5, 0, 1.2, 1, 0.9)
  }
  visuals.set(root, { kind, children })
}
export function removePrototypeEntity(root: Entity): void {
  for (const child of visuals.get(root)?.children ?? []) engine.removeEntity(child)
  visuals.delete(root)
  engine.removeEntity(root)
}
