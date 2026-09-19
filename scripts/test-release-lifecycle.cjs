const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const esbuild = require('esbuild')
const bundle = esbuild.buildSync({
  stdin: {
    contents: `export * from './src/multiplayer/releases'; export * from './src/server/releaseWorld'; export * from './src/multiplayer/persistence'; export * from './src/multiplayer/world'; export * from './src/multiplayer/types'; export * from './src/multiplayer/authority'; export * from './src/multiplayer/liveAuthority'; export * from './src/multiplayer/simulation'; export * from './src/multiplayer/transport';`,
    resolveDir: process.cwd()
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false
})
const mod = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, mod, mod.exports)
const m = mod.exports
const a = {
  format: 1,
  world: 'raft.dcl.eth',
  id: 'build-a',
  sequence: 1,
  compatibility: 1,
  previous: 'legacy',
  previousCompatibility: 1
}
const b = { ...a, id: 'build-b', sequence: 2, previous: a.id }
const wallet = '0x' + '1'.repeat(40)
const values = new Map()
let outage = false,
  now = 10000,
  published = a,
  lookupFails = false
const storage = {
  async read(key) {
    if (outage) throw Error('offline')
    return values.has(key) ? { kind: 'found', value: m.clone(values.get(key)) } : { kind: 'missing' }
  },
  async write(key, value) {
    if (outage) return false
    values.set(key, m.clone(value))
    return true
  },
  async remove(key) {
    return values.delete(key)
  }
}
async function main() {
  const initial = m.freshWorld()
  initial.players[wallet] = m.freshPlayer(wallet)
  const repoA = new m.WorldRepository(storage, 'initial', m.releaseNamespace(a.id))
  await repoA.commit(initial)
  assert.equal(
    (await m.inheritReleaseWorld(storage, b, false)).waiting,
    true,
    'A live predecessor gets a chance to finish its checkpoint'
  )
  const handlers = new Map(),
    systems = [],
    outbound = []
  const mocks = {
    '../config/release': { RELEASE: a },
    '../config/env': { IS_PRODUCTION: true },
    '../multiplayer/releases': {
      ...m,
      readPublishedRelease: async () => {
        if (lookupFails) throw Error('offline')
        return published
      }
    },
    './releaseWorld': m,
    '../multiplayer/authority': m,
    '../multiplayer/liveAuthority': m,
    '../multiplayer/persistence': m,
    '../multiplayer/types': m,
    '../multiplayer/world': m,
    '../multiplayer/simulation': m,
    '../multiplayer/transport': m,
    './worldStorage': { worldStorage: storage },
    '../config/gameConfig': {
      MULTIPLAYER_MAX_PENDING: 64,
      MULTIPLAYER_MAX_PLAYERS: 32,
      MULTIPLAYER_BATCH_S: 0.05,
      MULTIPLAYER_CHECKPOINT_S: 0.2,
      MULTIPLAYER_BACKUP_S: 60,
      MULTIPLAYER_HEARTBEAT_S: 2,
      MULTIPLAYER_TIMEOUT_S: 8
    },
    '@dcl/sdk/ecs': {
      engine: {
        addSystem: (fn) => systems.push(fn),
        *getEntitiesWith() {
          yield [1, { address: wallet }]
        }
      },
      PlayerIdentityData: {},
      Transform: { getOrNull: () => ({ position: { ...m.ORIGIN, y: m.ORIGIN.y + 1 } }) }
    },
    '../shared/messages': {
      worldRoom: {
        isReady: () => true,
        onMessage: (name, fn) => handlers.set(name, fn),
        async send(name, data) {
          outbound.push({ name, data })
        }
      }
    }
  }
  const output = ts.transpileModule(fs.readFileSync('src/server/cooperativeServer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports,
    Date: { now: () => now },
    console: { log() {}, error() {} },
    require: (name) => {
      assert(name in mocks, name)
      return mocks[name]
    }
  })
  exports.runCooperativeServer()
  const session = now.toString(36) + '-test'
  function hello() {
    handlers.get('worldClientVersion')({ payload: JSON.stringify({ release: a.id, session }) }, { from: wallet })
    handlers.get('worldHello')({ protocol: 1, session, resync: false, release: a.id }, { from: wallet })
  }
  async function step(count) {
    for (let i = 0; i < count; i++) {
      now += 100
      if (i % 10 === 0) hello()
      systems.forEach((fn) => fn(0.1))
      await new Promise(setImmediate)
    }
  }
  hello()
  await step(35)
  handlers.get('worldCommand')(
    {
      payload: JSON.stringify({
        protocol: 1,
        generation: 1,
        session,
        sequence: 1,
        action: { kind: 'consume', slot: 1 }
      })
    },
    { from: wallet }
  )
  await step(10)
  assert(outbound.some((p) => p.name === 'worldResult' && JSON.parse(p.data.payload).ok))
  assert.equal(
    (await new m.WorldRepository(storage, 'audit', m.releaseNamespace(a.id)).load()).players[wallet].slots[1].count,
    2,
    'Action is still in memory before handoff'
  )
  published = b
  await step(65)
  const ack = await storage.read(m.handoffKey(a.id, b.id))
  assert.equal(ack.kind, 'found')
  const finalA = await new m.WorldRepository(storage, 'audit', m.releaseNamespace(a.id)).load()
  assert.equal(finalA.players[wallet].slots[1].count, 1, 'Handoff must save the final accepted action')
  handlers.get('worldCommand')(
    {
      payload: JSON.stringify({
        protocol: 1,
        generation: 1,
        session,
        sequence: 2,
        action: { kind: 'consume', slot: 1 }
      })
    },
    { from: wallet }
  )
  await step(20)
  assert(!outbound.some((p) => p.name === 'worldResult' && JSON.parse(p.data.payload).sequence === 2))
  assert(outbound.some((p) => p.name === 'worldRelease' && JSON.parse(p.data.payload).phase === 'reload'))
  const transfer = await m.inheritReleaseWorld(storage, b, false)
  assert.equal(transfer.waiting, false)
  assert.equal(transfer.world.players[wallet].slots[1].count, 1)
  console.log('PASS live server drains, backs up accepted actions, fences old commands and hands off compatible state')

  const repoB = new m.WorldRepository(storage, 'new', m.releaseNamespace(b.id))
  await repoB.commit(transfer.world)
  finalA.revision++
  finalA.players[wallet].slots[1].count = 2
  await new m.WorldRepository(storage, 'late-old', m.releaseNamespace(a.id)).load().then(async (old) => {
    const lateRepo = new m.WorldRepository(storage, 'late-old', m.releaseNamespace(a.id))
    await lateRepo.load()
    await lateRepo.commit(finalA)
  })
  assert.equal(
    (await repoB.load()).players[wallet].slots[1].count,
    1,
    'Old namespace writes cannot clobber replacement'
  )
  const breaking = { ...b, id: 'breaking', sequence: 3, compatibility: 2 }
  const reset = await m.inheritReleaseWorld(storage, breaking, true)
  assert.equal(reset.world.generation, 2)
  assert.equal(Object.keys(reset.world.tiles).length, 16)
  assert.equal(Object.keys(reset.world.players).length, 0)
  assert.equal((await repoB.load()).generation, 1)
  console.log('PASS namespace fencing and explicit compatibility reset preserve historical backups')

  const skipped = { ...b, id: 'never-visited', sequence: 4 }
  const following = { ...b, id: 'following', sequence: 5, previous: skipped.id, previousDescriptor: 'bafFake' }
  const recovered = await m.inheritReleaseWorld(storage, following, true, async () => skipped)
  assert.equal(recovered.world.players[wallet].slots[1].count, 2)
  await assert.rejects(() => m.inheritReleaseWorld(storage, { ...following, previousDescriptor: undefined }, true))
  outage = true
  await assert.rejects(() => m.inheritReleaseWorld(storage, breaking, true))
  outage = false
  console.log('PASS deployments without visitors follow predecessor history; outages never initialize a fresh world')

  let requests = 0
  const read = m.releaseReader(async (url) => {
    requests++
    if (url.includes('/about'))
      return { configurations: { scenesUrn: ['urn:decentraland:entity:bafScene?baseUrl=https://evil.example'] } }
    assert(url.startsWith('https://worlds-content-server.decentraland.org/contents/'))
    if (url.endsWith('bafScene'))
      return { metadata: { scene: { base: '0,0' } }, content: [{ file: 'raft-release.json', hash: 'bafRelease' }] }
    return b
  })
  assert.equal((await read()).id, b.id)
  assert.equal((await read()).id, b.id)
  assert.equal(requests, 4, 'Immutable descriptors should be cached while the scene identity is unchanged')
  assert(m.isNewerRelease(a, b))
  assert(!m.isNewerRelease(b, a))
  assert.throws(() => m.parseRelease({ ...b, compatibility: 0 }))
  console.log('PASS publisher metadata lookup, immutable caching and monotonic version checks')
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
