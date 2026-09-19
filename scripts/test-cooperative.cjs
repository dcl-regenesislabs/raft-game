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
const A = '0x' + '1'.repeat(40),
  B = '0x' + '2'.repeat(40)
function setup() {
  const w = m.freshWorld()
  for (const address of [A, B, m.RESET_ADMIN]) {
    const p = (w.players[address] = m.freshPlayer(address))
    p.sessions.test = { sequence: 0, ok: true, error: '' }
  }
  return w
}
function command(w, address, action, sequence = w.players[address].sessions.test.sequence + 1) {
  action = { ...action }
  if (w.tiles[action.target]) action.target = m.tileObjectId(w.tiles[action.target])
  if (w.tiles[action.station]) action.station = m.tileObjectId(w.tiles[action.station])
  return m.executeRequest(w, address, { protocol: 1, session: 'test', generation: w.generation, sequence, action })
}
function supply(p, items) {
  for (const [id, n] of Object.entries(items)) assert.equal(m.give(p.slots, id, n), n, id)
}
function slot(p, id) {
  return p.slots.findIndex((s) => s.id === id)
}
let passed = 0
async function test(name, fn) {
  await fn()
  passed++
  console.log('PASS', name)
}
class MemoryStorage {
  values = new Map()
  fail = null
  ambiguous = false
  async read(key) {
    if (this.fail === 'read') throw Error('offline')
    return this.values.has(key) ? { kind: 'found', value: m.clone(this.values.get(key)) } : { kind: 'missing' }
  }
  async write(key, value) {
    if (this.fail === 'chunk' && key.includes(':chunk:')) return false
    if (this.fail === 'manifest' && key.endsWith(':manifest')) return false
    this.values.set(key, m.clone(value))
    if (this.ambiguous && key.endsWith(':manifest')) return false
    return true
  }
  async remove(key) {
    this.values.delete(key)
    return true
  }
}
;(async () => {
  await test('Initial world has exactly 81 empty platforms, a protected center and personal starter supplies', () => {
    const w = setup()
    assert.equal(Object.keys(w.tiles).length, 81)
    assert(Object.values(w.tiles).every((t) => t.x >= -4 && t.x <= 4 && t.z >= -4 && t.z <= 4 && !t.device))
    assert.equal(m.count(w.players[A].slots, 'hook'), 1)
    assert.equal(m.count(w.players[A].slots, 'potato'), 2)
    assert.equal(m.validateWorld(m.clone(w)).generation, 1)
  })
  await test('Conflicting builds debit only the winner and retries are idempotent', () => {
    let w = setup()
    for (const a of [A, B]) supply(w.players[a], { hammer: 1, wood: 4, plastic: 4, rope: 2 })
    const action = { kind: 'build', x: 5, z: 0, slot: slot(w.players[A], 'hammer') }
    const first = command(w, A, action)
    assert(first.result.ok)
    w = first.world
    const duplicate = command(w, A, action, 1)
    assert(duplicate.result.ok)
    assert.deepEqual(duplicate.world, w)
    const race = command(w, B, { ...action, slot: slot(w.players[B], 'hammer') })
    assert(!race.result.ok)
    assert.equal(m.count(race.world.players[B].slots, 'wood'), 4)
    assert.equal(m.count(race.world.players[A].slots, 'wood'), 2)
    assert(!command(w, A, { kind: 'destroy', target: '0,0', slot: action.slot }).result.ok)
  })
  await test('Pickup race and failed barrel capacity cannot duplicate or lose resources', () => {
    let w = setup()
    w.debris.d = { id: 'd', kind: 'wood', position: { ...m.ORIGIN }, velocity: { x: 0, y: 0, z: 0 }, remaining: 10 }
    const action = { kind: 'collect', target: 'd', slot: -1, hook: false }
    const first = command(w, A, action)
    assert(first.result.ok)
    w = first.world
    assert(!command(w, B, action).result.ok)
    assert.equal(m.count(w.players[A].slots, 'wood'), 1)
    w.debris.d = { id: 'd', kind: 'barrel', position: { ...m.ORIGIN }, velocity: { x: 0, y: 0, z: 0 }, remaining: 10 }
    w.players[A].slots = Array.from({ length: 25 }, () => ({ id: 'hook', count: 1, durability: 40 }))
    const full = command(w, A, action)
    assert(!full.result.ok)
    assert(full.world.debris.d)
    assert.deepEqual(full.world.players[A].slots, w.players[A].slots)
    assert.equal(full.world.seed, w.seed)
  })
  await test('Full inventory crafting rolls back costs; earned unlocks are shared', () => {
    let w = setup()
    supply(w.players[A], { plants: 4 })
    const first = command(w, A, { kind: 'craft', item: 'rope', station: '' })
    assert(first.result.ok)
    assert(first.world.progress.events.includes('rope'))
    w = first.world
    supply(w.players[B], { wood: 2, rope: 1 })
    assert(command(w, B, { kind: 'craft', item: 'hammer', station: '' }).result.ok)
    w.players[A].slots = Array.from({ length: 25 }, () => ({ id: 'hook', count: 1, durability: 40 }))
    w.players[A].slots[0] = { id: 'plants', count: 4, durability: 0 }
    const failed = command(w, A, { kind: 'craft', item: 'rope', station: '' })
    assert(!failed.result.ok)
    assert.deepEqual(failed.world.players[A].slots, w.players[A].slots)
  })
  await test('Storage withdrawals are atomic, preserve tool durability and reject stale slot state', () => {
    let w = setup()
    supply(w.players[A], { storage: 1 })
    w = command(w, A, { kind: 'place', target: '1,0', yawDeg: 0, slot: slot(w.players[A], 'storage') }).world
    const contents = w.tiles['1,0'].device.contents
    contents[0] = { id: 'hook', count: 1, durability: 7 }
    const action = {
      kind: 'transfer',
      target: '1,0',
      from: 'storage',
      to: 'player',
      a: 0,
      b: 5,
      expected: m.clone(contents[0])
    }
    const first = command(w, A, action)
    assert(first.result.ok)
    assert.equal(first.world.players[A].slots[5].durability, 7)
    assert(!command(first.world, B, action).result.ok)
    assert.equal(first.world.tiles['1,0'].device.contents[0].count, 0)
  })
  await test('Death affects only one player; respawn retains inventory and shared structures', () => {
    const w = setup()
    w.players[A].dead = true
    w.players[A].life = 0
    const result = command(w, A, { kind: 'respawn' })
    assert(result.result.ok)
    assert.deepEqual(result.world.players[A].slots, w.players[A].slots)
    assert.deepEqual(result.world.tiles, w.tiles)
    assert.deepEqual(result.world.players[B], w.players[B])
    assert.equal(result.world.players[A].life, 1)
  })
  await test('Only authenticated admin resets, clearing offline bags and rejecting old generations', () => {
    const w = setup()
    assert(!command(w, A, { kind: 'reset' }).result.ok)
    const reset = command(w, m.RESET_ADMIN, { kind: 'reset' })
    assert(reset.result.ok)
    assert.equal(reset.world.generation, 2)
    assert(!reset.world.players[A])
    assert.equal(Object.keys(reset.world.tiles).length, 81)
    assert(
      !m.executeRequest(reset.world, m.RESET_ADMIN, {
        protocol: 1,
        generation: 1,
        session: 'test',
        sequence: 2,
        action: { kind: 'reset' }
      }).result.ok
    )
  })
  await test('Empty worlds freeze, offline players take no damage and production resumes', () => {
    const w = setup(),
      before = m.clone(w)
    m.simulateWorld(w, 1, new Set())
    assert.deepEqual(w, before)
    m.simulateWorld(w, 1, new Set([A]))
    assert(w.players[A].hunger < 1)
    assert.equal(w.players[B].hunger, 1)
    assert.equal(w.progress.seconds, 1)
  })
  await test('Durable manifest reload preserves the complete state and confirmed request deduplication', async () => {
    const store = new MemoryStorage(),
      repo = new m.WorldRepository(store, 'writer')
    assert.equal(await repo.load(), null)
    let w = setup()
    supply(w.players[A], { plants: 4 })
    w = command(w, A, { kind: 'craft', item: 'rope', station: '' }).world
    w.revision = 1
    await repo.commit(w)
    const restored = await new m.WorldRepository(store, 'restart').load()
    assert.deepEqual(restored, w)
    assert.deepEqual(command(restored, A, { kind: 'craft', item: 'rope', station: '' }, 1).world, restored)
  })
  await test('Partial writes leave last commit intact; failed commit never advances visible state', async () => {
    const store = new MemoryStorage(),
      repo = new m.WorldRepository(store, 'writer')
    const w = setup()
    await repo.commit(w)
    const coordinator = new m.CommitCoordinator(w, repo),
      next = m.clone(w)
    next.players[A].hunger = 0.5
    coordinator.stage(next)
    store.fail = 'manifest'
    await assert.rejects(() => coordinator.flush())
    assert.equal(coordinator.committed.players[A].hunger, 1)
    assert.equal((await new m.WorldRepository(store, 'reader').load()).players[A].hunger, 1)
    store.fail = null
    assert(await coordinator.flush())
    assert.equal((await new m.WorldRepository(store, 'restart').load()).players[A].hunger, 0.5)
  })
  await test('Ambiguous successful storage writes reconcile without duplicate effects', async () => {
    const store = new MemoryStorage(),
      repo = new m.WorldRepository(store, 'writer')
    const w = setup()
    store.ambiguous = true
    await repo.commit(w)
    assert.deepEqual(await new m.WorldRepository(store, 'restart').load(), w)
  })
  await test('Storage errors and corruption never initialize a new world', async () => {
    const store = new MemoryStorage(),
      repo = new m.WorldRepository(store, 'writer')
    store.fail = 'read'
    await assert.rejects(() => repo.load())
    assert.equal(store.values.size, 0)
    store.fail = null
    await repo.commit(setup())
    const root = store.values.get('cooperative:v1:manifest')
    store.values.delete(root.chunks[0])
    await assert.rejects(() => new m.WorldRepository(store, 'restart').load())
    assert.throws(() => m.validateWorld({ ...setup(), version: 999 }))
    const malformed = setup()
    malformed.players[A].slots[0].count = -1
    assert.throws(() => m.validateWorld(malformed))
  })
  await test('Conflicting writers stop instead of overwriting another committed revision', async () => {
    const store = new MemoryStorage(),
      repo = new m.WorldRepository(store, 'writer')
    const w = setup()
    await repo.commit(w)
    const second = new m.WorldRepository(store, 'second')
    await second.load()
    w.revision++
    await repo.commit(w)
    const other = setup()
    other.revision = 2
    await assert.rejects(() => second.commit(other), /Another server/)
  })
  await test('Chunk transport survives duplication and reordering, detects corruption and stays below 13 KB', () => {
    const snapshot = { world: m.publicWorld(setup()), player: setup().players[A], session: 'test' }
    const chunks = m.splitMessage('id', { kind: 'snapshot', value: snapshot })
    assert(chunks.length > 1)
    assert(chunks.every((c) => Buffer.byteLength(JSON.stringify(c)) < 13000))
    const assembler = new m.Assembler()
    assembler.accept(chunks[0], 0)
    assembler.accept(chunks[0], 0)
    let actual
    for (const chunk of chunks.slice(1).reverse()) actual = assembler.accept(chunk, 10)
    assert.deepEqual(actual.value, snapshot)
    const bad = new m.Assembler()
    bad.accept(chunks[0], 0)
    assert.throws(() => bad.accept({ ...chunks[0], body: 'corrupt' }, 0))
  })
  await test('Deltas converge and missing revisions demand resynchronization; private bags never broadcast', () => {
    const w = setup(),
      before = { world: m.publicWorld(w), player: m.clone(w.players[A]), session: 'test' }
    w.revision = 1
    w.tiles['1,1'].health = 50
    const after = { world: m.publicWorld(w), player: m.clone(w.players[A]), session: 'test' }
    const delta = m.makeDelta(before.world, after)
    assert.deepEqual(m.applyDelta(before, delta), after)
    assert.throws(() => m.applyDelta(after, delta))
    assert(!('players' in before.world))
    assert(!JSON.stringify(delta).includes(B))
  })
  await test('Headless cooking, water and production commit their outputs without full-bag loss', () => {
    let w = setup()
    supply(w.players[A], { grill: 1, purifier: 1, smelter: 1, cup: 1, wood: 10, metal: 6 })
    const place = (item, target) => {
      const r = command(w, A, { kind: 'place', target, yawDeg: 0, slot: slot(w.players[A], item) })
      assert(r.result.ok, r.result.error)
      w = r.world
    }
    place('grill', '1,0')
    place('purifier', '-1,0')
    place('smelter', '0,1')
    let r = command(w, A, { kind: 'cook', target: '1,0', recipe: 'roasted_potato' })
    assert(r.result.ok, r.result.error)
    w = r.world
    for (let i = 0; i < 16; i++) m.simulateWorld(w, 1, new Set([A]))
    r = command(w, A, { kind: 'interact', target: '1,0', slot: 0, secondary: false })
    assert(r.result.ok)
    w = r.world
    assert.equal(m.count(w.players[A].slots, 'roasted_potato'), 1)
    assert(!w.progress.events.includes('cookedMeal'))
    w = command(w, A, { kind: 'consume', slot: slot(w.players[A], 'roasted_potato') }).world
    assert(w.progress.events.includes('cookedMeal'))
    w = command(w, A, { kind: 'fillCup', slot: slot(w.players[A], 'cup') }).world
    w = command(w, A, {
      kind: 'interact',
      target: '-1,0',
      slot: slot(w.players[A], 'saltWater'),
      secondary: false
    }).world
    w = command(w, A, { kind: 'interact', target: '-1,0', slot: 0, secondary: true }).world
    for (let i = 0; i < 16; i++) m.simulateWorld(w, 1, new Set([A]))
    assert(w.tiles['-1,0'].device.freshAmount > 0.99)
    w = command(w, A, { kind: 'interact', target: '-1,0', slot: 0, secondary: false }).world
    assert(w.progress.events.includes('drink'))
    w = command(w, A, { kind: 'interact', target: '0,1', slot: 0, secondary: false }).world
    assert.equal(w.tiles['0,1'].device.queued, 1)
    for (let i = 0; i < 22; i++) m.simulateWorld(w, 1, new Set([A]))
    assert.equal(w.tiles['0,1'].device.stock, 0, 'No production without fuel')
    w = command(w, A, { kind: 'interact', target: '0,1', slot: 0, secondary: true }).world
    for (let i = 0; i < 22; i++) m.simulateWorld(w, 1, new Set([A]))
    assert.equal(w.tiles['0,1'].device.stock, 1)
    assert(w.progress.events.includes('plate'))
    w.players[A].slots = Array.from({ length: 25 }, () => ({ id: 'hook', count: 1, durability: 40 }))
    w = command(w, A, { kind: 'interact', target: '0,1', slot: 0, secondary: false }).world
    assert.equal(w.tiles['0,1'].device.stock, 1, 'Full bags retain produced output')
  })
  await test('Fishing and combat enforce server timers, ammo and duplicate request receipts', () => {
    let w = setup()
    supply(w.players[A], { fishingRod: 1, bow: 1, arrows: 4 })
    const rod = slot(w.players[A], 'fishingRod')
    w = command(w, A, { kind: 'fishStart', slot: rod }).world
    assert(!command(w, A, { kind: 'fishCatch', slot: rod }).result.ok)
    w.progress.seconds = w.players[A].fishing.readyAt
    const caught = command(w, A, { kind: 'fishCatch', slot: rod })
    assert(caught.result.ok)
    assert.deepEqual(
      command(caught.world, A, { kind: 'fishCatch', slot: rod }, caught.result.sequence).world,
      caught.world
    )
    w = caught.world
    w.enemies.test = {
      id: 'test',
      kind: 'zombie',
      hp: 100,
      position: { ...m.ORIGIN, z: m.ORIGIN.z + 3 },
      cooldown: 0,
      slow: 0,
      boarding: true,
      shots: 0,
      target: '0,1'
    }
    const shot = { kind: 'attack', slot: slot(w.players[A], 'bow'), target: 'test' }
    const hit = command(w, A, shot)
    assert(hit.result.ok)
    assert.equal(m.count(hit.world.players[A].slots, 'arrows'), 3)
    assert(!command(hit.world, A, shot).result.ok)
    assert.equal(hit.world.enemies.test.hp, 65)
  })
  await test('Slow chunk transfers retain progress and corrupted oversized chunks fail closed', () => {
    const chunks = m.splitMessage('slow', { text: 'x'.repeat(10000) }),
      assembler = new m.Assembler()
    let packet
    for (let i = 0; i < chunks.length; i++) packet = assembler.accept(chunks[i], i * 10000)
    assert.equal(packet.text.length, 10000)
    assert.throws(() => new m.Assembler().accept({ ...chunks[0], body: 'x'.repeat(1501) }, 0))
  })
  await test('Delayed object actions cannot mutate a replacement in the same cell', () => {
    let w = setup()
    supply(w.players[A], { hammer: 1, wood: 4, plastic: 4, rope: 2 })
    const old = m.tileObjectId(w.tiles['1,0']),
      hammer = slot(w.players[A], 'hammer')
    w = command(w, A, { kind: 'destroy', target: old, slot: hammer }).world
    w = command(w, A, { kind: 'build', x: 1, z: 0, slot: hammer }).world
    assert.notEqual(m.tileObjectId(w.tiles['1,0']), old)
    assert(!command(w, A, { kind: 'destroy', target: old, slot: hammer }).result.ok)
    assert(w.tiles['1,0'])
  })
  console.log(`${passed} cooperative tests passed`)
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
