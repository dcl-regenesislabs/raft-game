const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '../src')
const cache = new Map()
const mocks = new Map()
function load(relative) {
  const file = path.resolve(root, relative)
  if (mocks.has(file)) return mocks.get(file)
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  new Function('require', 'module', 'exports', code)((name) => {
    if (mocks.has(name)) return mocks.get(name)
    return load(path.resolve(path.dirname(file), name + '.ts'))
  }, module, module.exports)
  return module.exports
}
function stub(relative, value) { mocks.set(path.resolve(root, relative), value) }
const weather = load('expansion/weather.ts')
for (const [time, raining] of [[0, false], [119.99, false], [120, true], [179.99, true], [180, false], [300, true]]) {
  assert.equal(weather.isRainingAt(time), raining)
}
assert.equal(weather.rainCloudPass(0).visible, false)
assert.equal(weather.rainCloudPass(99).visible, false)
assert.equal(weather.rainCloudPass(110).scale, 0.5)
assert.equal(weather.rainCloudPass(150).scale, 1)
assert.equal(weather.rainCloudPass(190).scale, 0.5)
assert.equal(weather.rainCloudPass(200).visible, false)
assert.equal(weather.rainCloudPass(280).progress, 0)
const { advanceProduction } = load('expansion/rules.ts')
const collector = { fuel: 0, progress: 0, stock: 0, ammo: 0, active: false, installed: false }
for (let t = 0; t < 120; t++) advanceProduction('rainCollector', collector, 1, weather.isRainingAt(t))
assert.equal(collector.stock, 0)
for (let t = 120; t < 180; t++) advanceProduction('rainCollector', collector, 1, weather.isRainingAt(t))
assert.equal(collector.stock, 4)
assert.equal(collector.progress, 0)
console.log('PASS rain cadence, production, approach, departure and cycle wrap')

function component() {
  const data = new Map()
  return { data, create: (e, v = {}) => data.set(e, v), get: e => data.get(e), getMutable: e => data.get(e),
    getOrNull: e => data.get(e) ?? null }
}
const Transform = component(), ParticleSystem = component()
ParticleSystem.Shape = { Box: value => value }
const Platform = component(), ExpansionState = component(), PlatformConstruction = component()
const all = [Transform, ParticleSystem, Platform, ExpansionState, PlatformConstruction]
let next = 1
const live = new Set()
const engine = {
  PlayerEntity: 0,
  addEntity() { const e = next++; live.add(e); return e },
  removeEntity(e) { live.delete(e); all.forEach(c => c.data.delete(e)) },
  *getEntitiesWith(...components) {
    for (const e of live) if (components.every(c => c.data.has(e))) yield [e, ...components.map(c => c.get(e))]
  }
}
mocks.set('@dcl/sdk/ecs', { engine, Transform, ParticleSystem, MeshRenderer: { setSphere() {} },
  Material: { setPbrMaterial() {} }, PBParticleSystem_BlendMode: { PSB_ALPHA: 0 },
  PBParticleSystem_SimulationSpace: { PSS_WORLD: 1 } })
mocks.set('@dcl/sdk/math', { Vector3: { create: (x,y,z) => ({ x,y,z }) }, Color4: { create: (r,g,b,a) => ({r,g,b,a}) } })
stub('components.ts', { Platform, ExpansionState, PlatformConstruction })
stub('factories/platform.ts', { PLATFORM_SIZE_X: 3, PLATFORM_SIZE_Z: 3 })
let seconds = 0, gated = false, multiplayer = false, ready = true
stub('expansion/runtime.ts', { getWeatherElapsedSeconds: () => seconds })
stub('client/multiplayerState.ts', { isMultiplayer: () => multiplayer, multiplayerReady: () => ready,
  getMultiplayerSnapshot: () => ({ world: { progress: { seconds: seconds + 120 } } }) })
stub('ui/startupGate.ts', { isStartupGateActive: () => gated })
stub('ui/gameOver.ts', { isGameOver: () => false })
stub('ui/winScreen.ts', { isWinActive: () => false })
const { rainSystem } = load('systems/rain.ts')
const tiles = []
for (let i = 0; i < 12; i++) {
  const tile = engine.addEntity(), child = engine.addEntity()
  tiles.push(tile)
  Transform.create(tile, { position: { x: 400 + i * 3, y: 16, z: 400 } })
  Transform.create(child, { position: { x: 400 + i * 3, y: 16.9, z: 400 } })
  Platform.create(tile, {})
  ExpansionState.create(tile, { stock: 0 })
  PlatformConstruction.create(tile, { kind: 'rainCollector', child })
}
const baseline = live.size
rainSystem(0.1)
assert.equal(live.size, baseline)
seconds = 110
rainSystem(0.1)
assert.equal(ParticleSystem.data.size, 1)
assert.equal([...ParticleSystem.data.values()][0].active, false)
seconds = 120
rainSystem(0.1)
assert.equal(ParticleSystem.data.size, 9)
assert([...ParticleSystem.data.values()].reduce((sum, p) => sum + p.maxParticles, 0) < 1000)
const rain = [...ParticleSystem.data.values()][0]
assert.equal(rain.active, true)
const dropEntity = [...ParticleSystem.data.keys()][0]
const dropX = Transform.get(dropEntity).position.x
assert(dropX - rain.shape.size.x / 2 <= 398.5 && dropX + rain.shape.size.x / 2 >= 434.5)
// Destroying a collector releases its effect and allows another nearby one to show.
const oldChild = PlatformConstruction.get(tiles[0]).child
engine.removeEntity(oldChild)
engine.removeEntity(tiles[0])
rainSystem(0.1)
assert(![...Transform.data.values()].some(t => t.parent === oldChild))
seconds = 180
rainSystem(0.1)
assert.equal(ParticleSystem.data.size, 1)
assert.equal([...ParticleSystem.data.values()][0].active, false)
seconds = 200
rainSystem(0.1)
assert.equal(live.size, baseline - 2)
multiplayer = true
seconds = 0
rainSystem(0.1)
assert.equal([...ParticleSystem.data.values()][0].active, true)
ready = false
rainSystem(0.1)
assert.equal(ParticleSystem.data.size, 0)
ready = true
rainSystem(0.1)
gated = true
rainSystem(0.1)
assert.equal(live.size, baseline - 2)
console.log('PASS collector cap, coverage, removal cleanup, multiplayer clock and transition cleanup')
