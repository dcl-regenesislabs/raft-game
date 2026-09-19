const assert = require('node:assert/strict')
const esbuild = require('esbuild')
const bundle = esbuild.buildSync({
  stdin: {
    contents: `export * from './src/multiplayer/prediction'; export * from './src/multiplayer/liveAuthority'; export * from './src/multiplayer/motion'; export * from './src/multiplayer/world'; export * from './src/multiplayer/types'; export * from './src/multiplayer/authority'; export * from './src/multiplayer/inventory';`,
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
async function main() {
  const address = '0x' + '1'.repeat(40)
  const w = m.freshWorld()
  const player = (w.players[address] = m.freshPlayer(address))
  player.sessions.test = { sequence: 0, ok: true, error: '' }
  for (const [id, n] of Object.entries({ hammer: 1, wood: 4, plastic: 4, rope: 2 })) m.give(player.slots, id, n)
  const base = { world: m.publicWorld(w), player: m.clone(player), session: 'test' }
  const request = {
    protocol: 1,
    generation: 1,
    session: 'test',
    sequence: 1,
    action: { kind: 'build', x: 2, z: 0, slot: 2 }
  }
  const predicted = m.predictSnapshot(base, [request])
  assert(predicted.world.tiles['2,0'])
  assert(!base.world.tiles['2,0'])
  assert.equal(m.count(base.player.slots, 'wood'), 4)
  assert.equal(m.count(predicted.player.slots, 'wood'), 2)
  const winner = m.executeRequest(w, address, request).world
  const lost = { ...base, world: m.publicWorld(winner) }
  const reconciled = m.predictSnapshot(lost, [])
  assert(reconciled.world.tiles['2,0'])
  assert.equal(
    m.count(reconciled.player.slots, 'wood'),
    4,
    'Losing prediction refunds costs while preserving winner geometry'
  )
  console.log('PASS instant prediction, isolated inventory and collision reconciliation')

  const writes = []
  let release,
    fail = false
  const repository = {
    async commit(world) {
      writes.push(m.clone(world))
      if (release === undefined)
        await new Promise((resolve) => {
          release = resolve
        })
      if (fail) throw Error('offline')
    }
  }
  const live = new m.LiveAuthority(w, repository)
  live.stage(winner)
  const backup = live.checkpoint()
  const next = m.clone(live.state)
  next.players[address].hunger = 0.7
  live.stage(next)
  assert.equal(live.state.players[address].hunger, 0.7, 'A hung backup must not block live changes')
  release()
  await backup
  assert.notEqual(writes[0].players[address].hunger, 0.7)
  fail = true
  await assert.rejects(() => live.checkpoint())
  const uncertain = writes.at(-1)
  const later = m.clone(live.state)
  later.players[address].thirst = 0.4
  live.stage(later)
  fail = false
  await live.checkpoint()
  assert.deepEqual(writes.at(-1), uncertain, 'Uncertain backup must retry the same identity')
  await live.checkpoint()
  assert.equal(writes.at(-1).players[address].thirst, 0.4)
  console.log('PASS asynchronous immutable backups, in-flight gameplay and uncertain-write retry')

  function motion(fps) {
    let pos = { x: 0, y: 0, z: 0 }
    const sample = { position: { ...pos }, velocity: { x: 1, y: 0, z: 0 }, age: 0 }
    for (let i = 0; i < fps; i++) pos = m.advanceMotion(pos, sample, 1 / fps)
    return pos.x
  }
  assert(Math.abs(motion(30) - motion(120)) < 0.002)
  assert(motion(60) <= 0.501 && motion(60) > 0.49, 'Movement must freeze after bounded extrapolation on packet loss')
  const p = m.advanceMotion(
    { x: 0, y: 0, z: 0 },
    { position: { x: 1, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, age: 0 },
    1 / 60
  )
  assert(p.x > 0 && p.x < 1, 'Small corrections must blend, not teleport')
  console.log('PASS continuous motion, bounded extrapolation and frame-rate independent correction')
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
