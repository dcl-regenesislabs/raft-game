const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const transforms = new Map(), garbage = new Map(), alive = new Set()
let next = 10, banked = 0, accept = true, copies = 0
const world = { debris: {} }
const vectors = { create: (x, y, z) => ({ x, y, z }), Zero: () => ({ x: 0, y: 0, z: 0 }) }
const component = (map) => ({ get: e => { assert(map.has(e), `Dead component ${e}`); return map.get(e) },
  getMutable: e => { assert(map.has(e)); return map.get(e) }, deleteFrom: e => map.delete(e) })
function remove(e) { alive.delete(e); transforms.delete(e); garbage.delete(e) }
function spawn(kind, position) {
  const e = next++, visual = next++
  alive.add(e); alive.add(visual)
  transforms.set(e, { position: { ...position } })
  garbage.set(e, { kind, visual })
  return e
}
const mocks = {
  '../client/multiplayerState': {
    isMultiplayer: () => true, getMultiplayerSnapshot: () => ({ world }),
    sendWorldAction(action) {
      if (!accept) return false
      const entity = Number(action.target)
      remove(garbage.get(entity).visual); remove(entity)
      delete world.debris[action.target]
      return true
    }
  },
  '../client/worldEntities': { worldEntityId: e => String(e) },
  '@dcl/sdk/ecs': { engine: { RootEntity: 0, removeEntity: remove,
    *getEntitiesWith() { for (const [e] of [...garbage]) yield [e] } },
    Transform: component(transforms), PointerEvents: { deleteFrom() {} } },
  '@dcl/sdk/math': { Vector3: vectors },
  '@dcl/sdk/platform': {}, '../audio/sfx': {},
  '../config/gameConfig': { HOOK_COLLECT_RADIUS_XZ: 1.8 },
  '../components': { FloatingGarbage: component(garbage) },
  '../factories': {},
  '../factories/floatingGarbage': { createFloatingGarbage: ({ kind, position }) => { copies++; return spawn(kind, position) } },
  '../factories/garbageBank': { bankGarbageKind: () => banked++ },
  '../factories/heldItem': {}, '../factories/sceneLevels': {},
  './toolFire': {}, '../ui/cursorLock': {}, './anchorThrower': {}, './fishingRod': {},
  '../ui/worldClickGate': {}, '../ui/inventoryState': { getSelectedSlot: () => 0 },
  '../ui/inventoryToggle': {}, '../utils/math': {}, '../utils/wobble': {}
}
const source = fs.readFileSync('src/systems/hookThrower.ts', 'utf8') + `
export const harness = { setHook: (e: Entity) => { hookEntity = e }, collect: collectGarbageNearHook, follow: followGrabbedItems, despawn: despawnHook }
`
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const exportsOut = {}
vm.runInNewContext(output, { exports: exportsOut, require: name => { assert(name in mocks, name); return mocks[name] } })
const h = exportsOut.harness
transforms.set(1, { position: { x: 0, y: 4, z: 0 } }); alive.add(1); h.setHook(1)
const original = spawn('wood', { x: 0, y: 4, z: 0 }); world.debris[original] = {}
h.collect(0, 0)
assert(!alive.has(original))
assert.equal(copies, 1)
assert.equal(garbage.size, 0, 'Cosmetic reel objects must not remain interactable pickups')
const cosmetic = [...transforms.keys()].find(e => e !== 1)
transforms.get(1).position.x = 5; h.follow()
assert(transforms.get(cosmetic).position.x > 4, 'Collected visual must follow hook immediately')
world.debris[original] = {}; h.follow()
assert(!alive.has(cosmetic), 'Rejected pickup must cancel speculative reel visual')
accept = false
spawn('wood', { x: 0, y: 4, z: 0 }); h.collect(0, 0)
assert.equal(copies, 1, 'A full request queue must not allocate cosmetic objects every frame')
h.despawn()
assert.equal(banked, 0, 'Returning multiplayer hook must never grant inventory locally')
console.log('PASS immediate multiplayer hook visuals, rejection cleanup, bounded allocations and no double grants')
