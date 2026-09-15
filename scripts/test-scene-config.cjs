const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const scene = JSON.parse(fs.readFileSync(path.join(root, 'scene.json'), 'utf8'))
const levels = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/factories/sceneLevels.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, { exports: levels })
assert.equal(scene.worldConfiguration.name, 'raft.dcl.eth')
assert.equal(levels.PARCEL_GRID, 50)
assert.equal(scene.scene.base, '0,0')
const expected = new Set()
for (let x = 0; x < levels.PARCEL_GRID; x++) {
  for (let z = 0; z < levels.PARCEL_GRID; z++) expected.add(`${x},${z}`)
}
assert.equal(scene.scene.parcels.length, expected.size)
assert.deepEqual(new Set(scene.scene.parcels), expected)
const side = levels.PARCEL_GRID * levels.PARCEL_SIZE_M
for (const spawn of scene.spawnPoints) {
  for (const axis of ['x', 'z']) {
    const values = Array.isArray(spawn.position[axis]) ? spawn.position[axis] : [spawn.position[axis]]
    assert.ok(values.every(value => value >= 0 && value < side), `spawn ${axis} outside scene`)
    assert.ok(spawn.cameraTarget[axis] >= 0 && spawn.cameraTarget[axis] < side)
  }
}
console.log('PASS raft.dcl.eth metadata matches the complete runtime parcel grid and contains all spawn points')
