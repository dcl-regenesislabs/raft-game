// Bakes KHR_texture_transform offset/scale/rotation into mesh UV accessors
// and strips the extension. Decentraland's renderer does not support the
// extension; without baking, the loader rejects the GLB outright because
// the file lists it in extensionsRequired.

import { NodeIO } from '@gltf-transform/core'
import { KHRTextureTransform, ALL_EXTENSIONS } from '@gltf-transform/extensions'
import process from 'node:process'

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/bake-texture-transform.mjs <file.glb> [...]')
  process.exit(1)
}

function applyTransform(u, v, offset, scale, rotation) {
  const sx = scale?.[0] ?? 1
  const sy = scale?.[1] ?? 1
  const ox = offset?.[0] ?? 0
  const oy = offset?.[1] ?? 0
  const r = rotation ?? 0
  // glTF KHR_texture_transform matrix (row-major):
  //   | sx*cos(r)  -sy*sin(r)  ox |
  //   | sx*sin(r)   sy*cos(r)  oy |
  //   | 0           0           1 |
  // newUV = M * [u, v, 1]^T
  const cr = Math.cos(r)
  const sr = Math.sin(r)
  const nu = sx * cr * u - sy * sr * v + ox
  const nv = sx * sr * u + sy * cr * v + oy
  return [nu, nv]
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

for (const path of files) {
  const doc = await io.read(path)
  const root = doc.getRoot()

  // Collect transforms per material -> texCoord set -> {offset, scale, rotation}
  let bakedAny = false

  for (const material of root.listMaterials()) {
    // We only handle baseColorTexture here — extend if other slots ever get
    // transforms in this project's assets.
    const tex = material.getBaseColorTextureInfo()
    if (!tex) continue
    const transform = tex.getExtension('KHR_texture_transform')
    if (!transform) continue

    const offset = transform.getOffset()
    const scale = transform.getScale()
    const rotation = transform.getRotation()
    const texCoord = transform.getTexCoord() ?? tex.getTexCoord() ?? 0

    // Find every primitive using this material, mutate (a cloned copy of)
    // its TEXCOORD_<n> accessor so the transform is baked into vertex data.
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial() !== material) continue
        const semantic = `TEXCOORD_${texCoord}`
        const accessor = prim.getAttribute(semantic)
        if (!accessor) continue

        // Clone so we don't corrupt accessors shared with other primitives
        // that may not want the same bake.
        const cloned = accessor.clone()
        const count = cloned.getCount()
        const out = new Float32Array(count * 2)
        const tmp = [0, 0]
        for (let i = 0; i < count; i++) {
          cloned.getElement(i, tmp)
          const [nu, nv] = applyTransform(tmp[0], tmp[1], offset, scale, rotation)
          out[i * 2] = nu
          out[i * 2 + 1] = nv
        }
        cloned.setArray(out)
        prim.setAttribute(semantic, cloned)
        bakedAny = true
      }
    }

    // Drop the per-textureInfo extension instance.
    transform.dispose()
  }

  // If the document's KHRTextureTransform extension still exists with no
  // remaining property instances, disable it so it's removed from
  // extensionsUsed / extensionsRequired on write.
  const ext = doc.createExtension(KHRTextureTransform)
  ext.setRequired(false)
  ext.dispose()

  if (!bakedAny) {
    console.log(`${path}: nothing to bake (no KHR_texture_transform)`)
    continue
  }

  await io.write(path, doc)
  console.log(`${path}: baked & stripped`)
}
