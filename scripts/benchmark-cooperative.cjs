const assert = require('node:assert/strict')
const esbuild = require('esbuild')
const path = require('node:path')
const bundle = esbuild.buildSync({
  stdin: {
    contents: `export * from './src/multiplayer/world'; export * from './src/multiplayer/types'; export * from './src/multiplayer/authority'; export * from './src/multiplayer/persistence'; export * from './src/multiplayer/inventory'; export * from './src/multiplayer/transport'; export * from './src/multiplayer/simulation';`,
    resolveDir: path.resolve(__dirname, '..'),
    loader: 'ts'
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
})
const mod = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, mod, mod.exports)
const m = mod.exports

const { performance } = require('node:perf_hooks')
const fs = require('node:fs')
const reports = []
for (const size of [9, 16]) {
  let world = m.freshWorld(),
    previous = m.publicWorld(world)
  world.tiles = {}
  for (let x = -Math.floor(size / 2); x < Math.ceil(size / 2); x++)
    for (let z = -Math.floor(size / 2); z < Math.ceil(size / 2); z++) {
      const id = `${x},${z}`
      world.tiles[id] = { id, x, z, health: 100, device: null }
    }
  const addresses = Array.from({ length: 32 }, (_, i) => '0x' + (i + 1).toString(16).padStart(40, '0'))
  for (const a of addresses) world.players[a] = m.freshPlayer(a)
  for (let i = 0; i < 80; i++)
    world.debris['d' + i] = {
      id: 'd' + i,
      kind: 'wood',
      remaining: 1000,
      position: { ...m.ORIGIN, x: m.ORIGIN.x + (i % 16) },
      velocity: { x: 0.1, y: 0, z: 0.1 }
    }
  for (let i = 0; i < 8; i++)
    world.enemies['e' + i] = {
      id: 'e' + i,
      kind: 'zombie',
      hp: 100,
      position: { ...m.ORIGIN, x: m.ORIGIN.x + 40 },
      cooldown: 0,
      slow: 0,
      boarding: false,
      shots: 0,
      target: ''
    }
  for (const t of Object.values(world.tiles)
    .filter((t) => t.id !== '0,0')
    .slice(0, 64))
    t.device = {
      kind: 'smelter',
      yawDeg: 0,
      health: 100,
      maxHealth: 100,
      fuel: 100,
      progress: 0,
      stock: 0,
      queued: 5,
      ammo: 0,
      active: true,
      installed: false,
      contents: [],
      saltAmount: 0,
      freshAmount: 0,
      recipeId: '',
      cookElapsed: 0,
      cookStatus: 0
    }
  const times = []
  for (let i = 0; i < 100; i++) {
    const start = performance.now()
    world = m.clone(world)
    m.simulateWorld(world, 0.25, new Set(addresses))
    world.revision++
    JSON.stringify(world) // Durable chunk serialization (storage latency is not measured here).
    const shared = m.publicWorld(world)
    const delta = m.makeDelta(previous, { world: shared, player: world.players[addresses[0]], session: 'benchmark' })
    for (const a of addresses)
      m.splitMessage('benchmark:' + i, {
        kind: 'delta',
        value: { ...delta, player: m.clone(world.players[a]), session: a }
      })
    previous = shared
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  reports.push({
    scenario: `${size * size} starting tiles, 64 production devices, 32 players, 80 salvage, 8 enemies`,
    batches: times.length,
    milliseconds_p50: times[50],
    milliseconds_p95: times[95],
    milliseconds_max: times[99],
    world_bytes: Buffer.byteLength(JSON.stringify(world)),
    note: 'Node 22 CPU benchmark; excludes network, storage service latency, ECS rendering and GPU. Not phone FPS.'
  })
}
console.log(JSON.stringify(reports, null, 2))
fs.writeFileSync('docs/qa/cooperative/server-cpu-benchmark.json', JSON.stringify(reports, null, 2))
