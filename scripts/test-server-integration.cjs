const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks, clock = Date) {
  const exports = {}
  const filename = path.resolve(__dirname, '..', file)
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  vm.runInNewContext(js, {
    exports, console, Date: clock,
    require: (name) => {
      assert.ok(name in mocks, `Unmocked import ${name}`)
      return mocks[name]
    }
  }, { filename })
  return exports
}

async function main() {
  const handlers = new Map()
  const sent = []
  const systems = []
  let synced = true
  let now = 10000
  const room = {
    isReady: () => synced,
    onMessage: (type, handler) => handlers.set(type, handler),
    send: async (...args) => { sent.push(args) }
  }
  const connection = load('src/client/serverConnection.ts', {
    '@dcl/sdk/network': { isStateSyncronized: () => synced },
    '../shared/messages': { saveRoom: room }
  }, { now: () => now })
  connection.initServerConnection()
  assert.equal(connection.isGameServerReady(), false, 'Room sync alone is not server readiness')
  handlers.get('serverHeartbeat')({})
  assert.equal(connection.isGameServerReady(), true)
  now += 6000
  assert.equal(connection.isGameServerReady(), false, 'Expired heartbeat blocks requests')
  handlers.get('serverHeartbeat')({})
  synced = false
  assert.equal(connection.isGameServerReady(), false)
  synced = true
  assert.equal(connection.isGameServerReady(), false, 'Reconnect needs a new heartbeat')
  handlers.get('serverHeartbeat')({})
  assert.equal(connection.isGameServerReady(), true)

  let stored = false
  const writes = []
  const storage = {
    player: {
      set: async (...args) => { writes.push(args); return stored },
      get: async () => '{"version":1}',
      delete: async () => stored
    },
    set: async () => stored,
    getValues: async () => ({ data: [] })
  }
  const server = load('src/server/server.ts', {
    '@dcl/sdk/ecs': { engine: { addSystem: (system) => systems.push(system) } },
    '@dcl/sdk/server': { Storage: storage },
    '../shared/messages': { saveRoom: room }
  })
  server.runServer()
  systems[0](0)
  assert.equal(sent.at(-1)[0], 'serverHeartbeat')
  const ctx = { from: '0xplayer' }
  await handlers.get('save')({ payload: 'save-data' }, ctx)
  assert.equal(sent.at(-1)[1].ok, false, 'Failed writes must not acknowledge success')
  assert.equal(writes[0][0], ctx.from)
  assert.equal(writes[0][1], 'progress:full', 'Keep the existing save namespace')
  stored = true
  await handlers.get('save')({ payload: 'save-data' }, ctx)
  assert.equal(sent.at(-1)[1].ok, true)
  assert.equal(sent.at(-1)[2].to[0], ctx.from)
  await handlers.get('load')({}, ctx)
  assert.equal(sent.at(-1)[1].payload, '{"version":1}')
  stored = false
  await handlers.get('wipe')({}, ctx)
  assert.equal(sent.at(-1)[1].ok, false)
  await handlers.get('submitScore')({ timeS: 60, debug: false }, ctx)
  assert.equal(sent.at(-1)[1].ok, false)
  const count = writes.length
  await handlers.get('save')({ payload: 'forged' }, {})
  assert.equal(writes.length, count, 'Storage is scoped by the verified sender')

  let ready = false
  let applied = 0
  const client = load('src/client/saveClient.ts', {
    './serverConnection': { isGameServerReady: () => ready },
    '../ui/gameOver': { playAgain: () => {} },
    '../ui/notification': { showNotification: () => {} },
    '../ui/startupGate': { setSaveProbeResult: () => {} },
    '../ui/systemSession': { setSystemStatus: () => {} },
    '../shared/messages': { saveRoom: room },
    '../shared/saveSchema': {
      parseSaveBlob: JSON.parse,
      buildSaveBlob: () => ({ version: 1 }),
      applySaveBlob: () => { applied++ }
    }
  })
  client.initSaveClient()
  sent.length = 0
  client.saveClientTickSystem(0)
  await client.requestSave()
  assert.equal(sent.length, 0, 'Do not send saves or probes during cold start')
  ready = true
  client.saveClientTickSystem(0)
  assert.equal(sent.length, 1)
  await client.requestLoad()
  assert.equal(sent.length, 1, 'Manual load waits for the outstanding probe')
  const result = { found: true, payload: '{"version":1}' }
  handlers.get('loadResult')(result)
  assert.equal(applied, 0, 'Probe never overwrites live gameplay')
  assert.equal(sent.length, 2, 'Queued manual load follows the probe')
  handlers.get('loadResult')(result)
  assert.equal(applied, 1)
  handlers.get('loadResult')(result)
  assert.equal(applied, 1, 'Unsolicited or duplicate results cannot reload gameplay')
  ready = false
  client.saveClientTickSystem(0)
  ready = true
  client.saveClientTickSystem(0)
  assert.equal(sent.length, 3, 'Reconnect re-arms the save probe')
  console.log('PASS server heartbeat, cold start, reconnect, wallet-scoped persistence and failure acknowledgements')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
