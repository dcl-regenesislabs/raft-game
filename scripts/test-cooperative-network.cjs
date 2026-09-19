const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const bundle = esbuild.buildSync({
  stdin: {
    contents: `export * from './src/multiplayer/world'; export * from './src/multiplayer/types'; export * from './src/multiplayer/authority'; export * from './src/multiplayer/persistence'; export * from './src/multiplayer/inventory'; export * from './src/multiplayer/transport'; export * from './src/multiplayer/simulation';`,
    resolveDir: root
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
})
const moduleOut = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, moduleOut, moduleOut.exports)
const m = moduleOut.exports
let now = 10000
function load(file, mocks) {
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  vm.runInNewContext(source, {
    exports,
    Date: { now: () => now },
    console: { log() {}, error() {} },
    require(name) {
      assert(name in mocks, 'Unmocked import ' + name)
      return mocks[name]
    }
  })
  return exports
}
const A = '0x' + '1'.repeat(40),
  B = '0x' + '2'.repeat(40)
async function main() {
  let storageResponse = [null, null, 404]
  const adapter = load('src/server/worldStorage.ts', {
    '@dcl/sdk/server': { Storage: { set: async () => false, delete: async () => false } },
    '@dcl/sdk/server/storage-url': { getStorageServerUrl: async () => 'https://storage.example' },
    '@dcl/sdk/server/utils': { wrapSignedFetch: async () => storageResponse }
  }).worldStorage
  assert.equal((await adapter.read('missing')).kind, 'missing')
  for (const response of [
    [new Error('offline'), null, undefined],
    [null, null, 500],
    [null, { value: null }, 503],
    [null, {}, 200]
  ]) {
    storageResponse = response
    await assert.rejects(() => adapter.read('world'))
  }
  storageResponse = [null, { value: null }, 200]
  assert.equal((await adapter.read('malformed')).kind, 'found', 'Malformed stored null must not become absence')
  console.log('PASS storage adapter separates confirmed absence, malformed values and service errors')
  const values = new Map(),
    serverHandlers = new Map(),
    clients = [],
    outbound = [],
    systems = []
  let unavailable = false,
    dropChunk = false,
    dropped = 0,
    disconnected = new Set()
  const storage = {
    async read(key) {
      return values.has(key) ? { kind: 'found', value: m.clone(values.get(key)) } : { kind: 'missing' }
    },
    async write(key, value) {
      if (unavailable) return false
      values.set(key, m.clone(value))
      return true
    },
    async remove(key) {
      values.delete(key)
      return true
    }
  }
  const initial = m.freshWorld()
  for (const a of [A, B]) {
    initial.players[a] = m.freshPlayer(a)
    for (const [id, n] of Object.entries({ hammer: 1, wood: 4, plastic: 4, rope: 2 }))
      m.give(initial.players[a].slots, id, n)
  }
  await new m.WorldRepository(storage, 'fixture').commit(initial)
  const room = {
    isReady: () => true,
    onMessage: (name, fn) => serverHandlers.set(name, fn),
    async send(name, data, options) {
      assert(Buffer.byteLength(JSON.stringify(data)) < 13000)
      if (name === 'worldChunk' && dropChunk) {
        dropChunk = false
        dropped++
        return
      }
      outbound.push({ name, data: m.clone(data), options })
    }
  }
  load('src/server/cooperativeServer.ts', {
    '@dcl/sdk/ecs': {
      engine: {
        addSystem: (fn) => systems.push(fn),
        *getEntitiesWith() {
          yield [1, { address: A }]
          yield [2, { address: B }]
          yield [3, { address: m.RESET_ADMIN }]
        }
      },
      PlayerIdentityData: {},
      Transform: { getOrNull: () => ({ position: { ...m.ORIGIN, y: m.ORIGIN.y + 1 } }) }
    },
    '../shared/messages': { worldRoom: room },
    '../config/gameConfig': {
      MULTIPLAYER_MAX_PENDING: 64,
      MULTIPLAYER_MAX_PLAYERS: 32,
      MULTIPLAYER_BATCH_S: 0.25,
      MULTIPLAYER_CHECKPOINT_S: 1,
      MULTIPLAYER_HEARTBEAT_S: 2,
      MULTIPLAYER_TIMEOUT_S: 8
    },
    '../multiplayer/authority': m,
    '../multiplayer/persistence': m,
    './worldStorage': { worldStorage: storage },
    '../multiplayer/types': m,
    '../multiplayer/world': m,
    '../multiplayer/simulation': m,
    '../multiplayer/transport': m
  }).runCooperativeServer()
  function client(address) {
    const handlers = new Map(),
      ticks = [],
      rendered = []
    const state = load('src/client/multiplayerState.ts', { '../multiplayer/types': m })
    const clientRoom = {
      onMessage: (name, fn) => handlers.set(name, fn),
      async send(name, data) {
        if (!disconnected.has(address)) serverHandlers.get(name)(m.clone(data), { from: address })
      }
    }
    load('src/client/cooperativeClient.ts', {
      '@dcl/sdk/ecs': {
        engine: { PlayerEntity: 1, addSystem: (fn) => ticks.push(fn) },
        InputModifier: { createOrReplace() {}, Mode: { Standard: (x) => x } }
      },
      '@dcl/sdk/network': { isStateSyncronized: () => !disconnected.has(address) },
      '../shared/messages': { worldRoom: clientRoom },
      '../multiplayer/types': m,
      '../multiplayer/transport': m,
      './multiplayerState': state,
      './worldRenderer': { renderWorld: (snap) => rendered.push(snap.world.revision) },
      '../ui/notification': { showNotification() {} },
      '../ui/systemSession': { isSystemMenuOpen: () => false },
      '../ui/craftToggle': { isCraftOpen: () => false },
      '../ui/cookToggle': { isCookOpen: () => false },
      '../ui/storageToggle': { isStorageOpen: () => false },
      '../ui/inventoryToggle': { isInventoryOpen: () => false },
      '../systems/nativeEquipment': { equipCraftedItem() {} }
    }).initCooperativeClient()
    const c = { address, handlers, ticks, state, rendered }
    clients.push(c)
    return c
  }
  async function step(count = 1) {
    for (let i = 0; i < count; i++) {
      now += 100
      for (const c of clients) for (const tick of c.ticks) tick(0.1)
      for (const tick of systems) tick(0.1)
      await new Promise(setImmediate)
      // Actual SDK delivers authoritative callbacks without context. Reverse delivery to exercise reordering.
      for (const packet of outbound.splice(0).reverse())
        for (const c of clients) {
          if (disconnected.has(c.address) || (packet.options && !packet.options.to.includes(c.address))) continue
          c.handlers.get(packet.name)?.(m.clone(packet.data))
        }
    }
  }
  async function until(predicate, message) {
    for (let i = 0; i < 400; i++) {
      await step()
      if (predicate()) return
    }
    throw Error(message)
  }
  dropChunk = true
  const a = client(A),
    b = client(B)
  await step(8)
  assert.equal(
    (await new m.WorldRepository(storage, 'loading-audit').load()).progress.seconds,
    0,
    'Loading players must not start survival before snapshot acknowledgement'
  )
  await until(
    () => a.state.multiplayerReady() && b.state.multiplayerReady(),
    'Concurrent joins failed to recover lost snapshot chunk'
  )
  assert.equal(dropped, 1)
  assert.equal(Object.keys(a.state.getMultiplayerSnapshot().world.tiles).length, 81)
  assert.equal(a.state.getMultiplayerSnapshot().player.address, A)
  assert.equal(b.state.getMultiplayerSnapshot().player.address, B)
  assert(!('players' in a.state.getMultiplayerSnapshot().world))
  console.log('PASS simultaneous joins, private snapshots, missing chunk recovery and SDK callback context')
  const build = { kind: 'build', x: 5, z: 0, slot: 2 }
  assert(a.state.sendWorldAction(build))
  assert(b.state.sendWorldAction(build))
  await until(
    () => a.state.getMultiplayerSnapshot().world.tiles['5,0'] && b.state.getMultiplayerSnapshot().world.tiles['5,0'],
    'Build did not converge'
  )
  await step(20)
  const bags = [a, b].map((c) => m.count(c.state.getMultiplayerSnapshot().player.slots, 'wood')).sort()
  assert.deepEqual(bags, [2, 4])
  console.log('PASS competing placements converge with exactly one debit')
  unavailable = true
  assert(
    a.state.sendWorldAction({
      kind: 'swap',
      a: 1,
      b: 12,
      expected: m.clone(a.state.getMultiplayerSnapshot().player.slots[1])
    })
  )
  await step(40)
  assert.equal(a.state.getMultiplayerSnapshot().player.slots[1].id, 'potato')
  unavailable = false
  await until(
    () => a.state.getMultiplayerSnapshot().player.slots[12].id === 'potato',
    'Failed transaction did not retry'
  )
  console.log('PASS failed storage commit remains invisible and exact transaction retries')
  disconnected.add(A)
  disconnected.add(B)
  await step(100)
  const repo = new m.WorldRepository(storage, 'audit'),
    paused = await repo.load()
  await step(50)
  assert.deepEqual(await repo.load(), paused)
  disconnected.delete(A)
  disconnected.delete(B)
  await until(() => a.state.multiplayerReady() && b.state.multiplayerReady(), 'Reconnect failed')
  assert.equal(a.state.getMultiplayerSnapshot().player.slots[12].id, 'potato')
  const duplicate = client(A)
  await step(80)
  assert.equal(duplicate.state.multiplayerReady(), false)
  assert(a.state.multiplayerReady())
  console.log('PASS empty-world pause, reconnect persistence and duplicate wallet exclusion')
  // Inspect persisted state after coordinator commits, independent from the clients.
  const saved = await new m.WorldRepository(storage, 'cold-start').load()
  assert(saved.tiles['5,0'])
  assert.equal(saved.players[A].slots[12].id, 'potato')
  const admin = client(m.RESET_ADMIN)
  await until(() => admin.state.multiplayerReady(), 'Admin failed to join')
  disconnected.add(B)
  await step(100)
  assert(admin.state.sendWorldAction({ kind: 'reset' }))
  await until(
    () => a.state.getMultiplayerSnapshot().world.generation === 2 && a.state.multiplayerReady(),
    'Connected player failed to rejoin reset world'
  )
  assert.equal(Object.keys(a.state.getMultiplayerSnapshot().world.tiles).length, 81)
  assert.equal(m.count(a.state.getMultiplayerSnapshot().player.slots, 'hammer'), 0)
  disconnected.delete(B)
  await until(
    () => b.state.getMultiplayerSnapshot().world.generation === 2 && b.state.multiplayerReady(),
    'Offline player failed to rejoin reset world'
  )
  assert.equal(m.count(b.state.getMultiplayerSnapshot().player.slots, 'hammer'), 0)
  assert.equal(m.count(b.state.getMultiplayerSnapshot().player.slots, 'potato'), 2)
  console.log('PASS committed reset resynchronizes online players and invalidates offline bags')
  console.log('Cooperative server/client integration passed')
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
