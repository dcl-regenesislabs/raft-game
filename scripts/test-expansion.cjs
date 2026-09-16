const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript')
const mathBundle = require('esbuild').buildSync({
  entryPoints: [require.resolve('@dcl/sdk/math')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs'
}).outputFiles[0].text
const mathModule = { exports: {} }
new Function('module', 'exports', 'require', mathBundle)(mathModule, mathModule.exports, require)
const root = path.resolve(__dirname, '../src'),
  cache = new Map(),
  mocks = new Map()
const components = []
function component() {
  const data = new Map()
  const c = {
    data,
    getOrNull: (e) => data.get(e) ?? null,
    getMutableOrNull: (e) => data.get(e) ?? null,
    get: (e) => {
      assert(data.has(e), 'missing entity ' + e)
      return data.get(e)
    },
    getMutable: (e) => c.get(e),
    create: (e, v) => data.set(e, v),
    createOrReplace: (e, v) => data.set(e, v),
    deleteFrom: (e) => data.delete(e)
  }
  components.push(c)
  return c
}
const names = [
  'FloatingGarbage',
  'ExpansionState',
  'StructureHealth',
  'Platform',
  'PlatformConstruction',
  'MainPlatform',
  'StorageContents',
  'SharkAttack'
]
const comps = Object.fromEntries(names.map((n) => [n, component()]))
let next = 100,
  selected = null,
  locked = false,
  fire = false,
  won = false,
  opened = null,
  life = 0.5,
  thirst = 0.5,
  room = true,
  notifications = [],
  debris = [],
  removed = []
const pocket = new Map(),
  Transform = component(),
  GltfContainer = component()
const ecs = {
  Transform,
  GltfContainer,
  MeshRenderer: { setBox: () => {}, setPlane: () => {} },
  MeshCollider: { setBox: () => {} },
  Billboard: component(),
  BillboardMode: { BM_Y: 2 },
  MaterialTransparencyMode: { MTM_ALPHA_TEST: 1 },
  ColliderLayer: { CL_PHYSICS: 1, CL_POINTER: 2 },
  Material: { setPbrMaterial: () => {}, setBasicMaterial: () => {}, Texture: { Common: (v) => v } },
  engine: {
    RootEntity: 0,
    PlayerEntity: 1,
    CameraEntity: 2,
    addEntity: () => next++,
    removeEntity: (e) => {
      removed.push(e)
      for (const c of components) c.deleteFrom(e)
    },
    getEntitiesWith: function* (...cs) {
      for (const [e] of cs[0].data) if (cs.every((c) => c.data.has(e))) yield [e, ...cs.map((c) => c.data.get(e))]
    }
  }
}
function mock(file, value) {
  mocks.set(path.resolve(root, file), value)
}
function load(file) {
  const absolute = path.resolve(root, file)
  if (mocks.has(absolute)) return mocks.get(absolute)
  if (cache.has(absolute)) return cache.get(absolute)
  const exports = {}
  cache.set(absolute, exports)
  const js = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  vm.runInNewContext(
    js,
    {
      exports,
      console,
      Date,
      Math,
      require: (name) => {
        if (name === '@dcl/sdk/ecs') return ecs
        if (name === '@dcl/sdk/math') return mathModule.exports
        if (!name.startsWith('.')) throw Error('Unmocked ' + name)
        return load(path.resolve(path.dirname(absolute), name) + '.ts')
      }
    },
    { filename: absolute }
  )
  return exports
}
mock('systems/nativeEquipment.ts', {equipCraftedItem:()=>false})
mock('progression/checkpoint.ts', {captureCheckpoint:()=>{}})
mock('components.ts', comps)
mock('config/gameConfig.ts', { DEBUG_MODE: true, TUTORIAL_ENABLED: true })
mock('systems/lookAtTarget.ts', { getLookAtGarbageEntity: () => null })
mock('factories/garbageBank.ts', { bankGarbageKind: () => {} })
mock('factories/floatingGarbage.ts', { destroyFloatingGarbage: () => {}, createFloatingGarbage: (p) => debris.push(p) })
mock('factories/platform.ts', {
  GRID_ORIGIN: { x: 0, y: 0, z: 0 },
  destroyPlatformEntity: (e) => ecs.engine.removeEntity(e)
})
const inventory = {
  getCollectedCount: (id) => pocket.get(id) ?? 0,
  subtractCollected: (id, n) => {
    const take = Math.min(n, pocket.get(id) ?? 0)
    pocket.set(id, (pocket.get(id) ?? 0) - take)
    return take
  },
  addCollected: (id, n) => {
    if (!room) return 0
    pocket.set(id, (pocket.get(id) ?? 0) + n)
    return n
  },
  getSelectedSlot: () => 0,
  transmuteContainerSlot: (_, id) => {
    selected = id
    return true
  },
  isSelectionPointerLockoutActive: () => false,
  canReceiveCraft: () => room
}
mock('ui/inventoryState.ts', inventory)
mock('ui/items.ts', { getInventorySlot: () => (selected ? { id: selected } : null) })
mock('ui/notification.ts', { showNotification: (s) => notifications.push(s) })
mock('ui/itemReceivedNotification.ts', { notifyItemReceived: () => {} })
mock('ui/statsBars.ts', {
  getStat: (id) => (id === 'life' ? life : thirst),
  adjustStat: (_, n) => (life += n),
  restoreStat: (id, n) => {
    if (id === 'life') life = Math.min(1, life + n)
    else thirst = Math.min(1, thirst + n)
  }
})
mock('ui/craftToggle.ts', {
  setCraftOpen: (open, e) => {
    opened = e
    context.setCraftStation(e ?? null)
  }
})
mock('ui/storageToggle.ts', { openStorageMenu: (e) => (opened = e) })
mock('ui/inventoryToggle.ts', { isInventoryActionLocked: () => locked })
mock('ui/startupGate.ts', { isStartupGateActive: () => false })
mock('ui/gameOver.ts', { isGameOver: () => false })
mock('ui/winScreen.ts', { isWinActive: () => won, triggerWin: () => (won = true) })
mock('systems/toolFire.ts', { toolFireJustPressed: () => fire, isToolFirePressed: () => fire })
mock('ui/cursorLock.ts', { isPointerLocked: () => true })
mock('systems/sharkAttack.ts', { tryHitShark: () => {} })
mock('audio/sfx.ts', { playSfx: () => {} })
mock('ui/tutorialState.ts', { recordTutorialAction: () => {} })
mock('ui/storageSession.ts', {
  getCombinedCount: inventory.getCollectedCount,
  subtractFromAll: inventory.subtractCollected
})
const context = load('ui/craftContext.ts'),
  runtime = load('expansion/runtime.ts'),
  rules = load('expansion/rules.ts'),
  power = load('expansion/power.ts'),
  paths = load('expansion/path.ts'),
  catalog = load('expansion/catalog.ts'),
  craft = load('ui/craftSession.ts'),
  recipes = load('ui/craftableItems.ts')
const point = (x = 0, z = 0) => ({ x, y: 0, z })
function reset() {
  for (const c of components) c.data.clear()
  pocket.clear()
  selected = null
  fire = locked = won = false
  room = true
  opened = null
  life = thirst = 0.5
  notifications = []
  debris = []
  removed = []
  context.setCraftStation(null)
  Transform.create(1, { position: point() })
  Transform.create(2, { position: point(), rotation: { x: 0, y: 0, z: 0, w: 1 } })
  runtime.resetExpansion()
  load('progression/state.ts').resetProgress('sandbox')
}
function device(kind, x = 0, z = 0, extra = {}) {
  const e = next++,
    child = next++
  Transform.create(e, { position: point(x, z) })
  Transform.create(child, { position: point() })
  comps.Platform.create(e, { gridX: x / 3, gridZ: z / 3 })
  comps.PlatformConstruction.create(e, { kind, child, yawDeg: 0, aux: 0 })
  comps.ExpansionState.create(e, {
    health: 100,
    maxHealth: 100,
    fuel: 0,
    stock: 0,
    ammo: 0,
    progress: 0,
    active: false,
    installed: false,
    ...extra
  })
  return e
}
let passed = 0
function test(name, fn) {
  reset()
  fn()
  passed++
  console.log('PASS ' + name)
}
test('All recipes craft exclusively at their own workplace, never via a global unlock', () => {
  for (const recipe of recipes.CRAFTABLE_ITEMS) {
    reset()
    for (const c of recipe.cost) pocket.set(c.materialId, 100)
    if (recipe.station) {
      const e = device(recipe.station, 0, 0, { installed: true })
      assert.equal(craft.startCraft(recipe.id), false, recipe.id + ' basic')
      context.setCraftStation(e)
    }
    assert.equal(craft.startCraft(recipe.id), true, recipe.id)
    assert((pocket.get(recipe.id) ?? 0) > 0, recipe.id)
  }
})
test('Moving away or destroying a table invalidates crafting immediately', () => {
  const e = device('workbench')
  context.setCraftStation(e)
  pocket.set('metal', 10)
  assert(craft.canStartCraft('nails'))
  Transform.getMutable(1).position.x = 6
  assert(!craft.canStartCraft('nails'))
  Transform.getMutable(1).position.x = 0
  comps.PlatformConstruction.deleteFrom(e)
  assert(!craft.canStartCraft('nails'))
})
test('A different nearby worktable cannot authorize the selected table recipes', () => {
  const e = device('armoryBench')
  device('workbench')
  context.setCraftStation(e)
  pocket.set('metal', 10)
  assert(!craft.canStartCraft('nails'))
  assert(!craft.canStartCraft('hook'))
})
test('Station interaction opens only that station context and requires proximity', () => {
  for (const kind of ['workbench', 'armoryBench', 'engineeringBench']) {
    const e = device(kind)
    assert(runtime.interactExpansion(e, false))
    assert.equal(opened, e)
    assert.equal(context.getCraftContextKind(), kind)
  }
  const far = device('workbench', 20)
  assert.equal(runtime.interactExpansion(far, false), false)
})
test('Research payment is required once for the table, then opens its own menu', () => {
  const e = device('researchTable')
  runtime.interactExpansion(e, false)
  assert.equal(opened, null)
  pocket.set('metalPlate', 3)
  pocket.set('wire', 2)
  runtime.interactExpansion(e, false)
  assert(comps.ExpansionState.get(e).installed)
  runtime.interactExpansion(e, false)
  assert.equal(opened, e)
  assert.equal(pocket.get('wire'), 0)
})
test('Smelter queues paid batches, pauses without fuel, retains outputs when pack full', () => {
  const e = device('smelter')
  pocket.set('metal', 4)
  pocket.set('wood', 1)
  runtime.interactExpansion(e, false)
  runtime.interactExpansion(e, false)
  assert.equal(pocket.get('metal'), 0)
  runtime.interactExpansion(e, true)
  runtime.debugAdvanceExpansion(30)
  const s = comps.ExpansionState.get(e)
  assert.equal(s.stock, 1)
  assert.equal(s.fuel, 0)
  assert.equal(s.queued, 1)
  assert.equal(s.progress, 10)
  room = false
  runtime.interactExpansion(e, false)
  assert.equal(s.stock, 1)
  room = true
  runtime.interactExpansion(e, false)
  assert.equal(pocket.get('metalPlate'), 1)
  assert.equal(s.stock, 0)
})
test('Improved grill cooks three portions only after fuel is supplied', () => {
  const e = device('improvedGrill')
  pocket.set('potato', 3)
  runtime.interactExpansion(e, false)
  runtime.debugAdvanceExpansion(30)
  assert.equal(comps.ExpansionState.get(e).stock, 0)
  pocket.set('wood', 1)
  runtime.interactExpansion(e, true)
  runtime.debugAdvanceExpansion(30)
  runtime.interactExpansion(e, false)
  assert.equal(pocket.get('roasted_potato'), 3)
})
test('Crop requires a seed and fresh cup, then yields exactly three potatoes', () => {
  const e = device('cropBed')
  pocket.set('potato', 1)
  runtime.interactExpansion(e, false)
  runtime.interactExpansion(e, false)
  assert(!comps.ExpansionState.get(e).active)
  selected = 'freshWater'
  runtime.interactExpansion(e, false)
  assert.equal(selected, 'cup')
  runtime.debugAdvanceExpansion(60)
  runtime.interactExpansion(e, false)
  assert.equal(pocket.get('potato'), 3)
})
test('Water tank preserves cups and stops at capacity', () => {
  const e = device('waterTank', 0, 0, { stock: 7 })
  selected = 'freshWater'
  runtime.interactExpansion(e, true)
  assert.equal(selected, 'cup')
  selected = 'freshWater'
  runtime.interactExpansion(e, true)
  assert.equal(selected, 'freshWater')
  assert.equal(comps.ExpansionState.get(e).stock, 8)
  selected = 'cup'
  runtime.interactExpansion(e, false)
  assert.equal(selected, 'freshWater')
  assert.equal(comps.ExpansionState.get(e).stock, 7)
})
test('Rain collection pauses outside rain and cannot overflow storage', () => {
  const s = { fuel: 0, stock: 0, progress: 0, active: false, installed: false, ammo: 0 }
  rules.advanceProduction('rainCollector', s, 60, false)
  assert.equal(s.stock, 0)
  rules.advanceProduction('rainCollector', s, 60, true)
  assert.equal(s.stock, 4)
  rules.advanceProduction('rainCollector', s, 60, true)
  assert.equal(s.stock, 4)
})
test('Tower loading caps at twenty and secondary action rotates its arc', () => {
  const e = device('ballista')
  pocket.set('bolts', 30)
  runtime.interactExpansion(e, false)
  assert.equal(pocket.get('bolts'), 10)
  assert.equal(comps.ExpansionState.get(e).ammo, 20)
  runtime.interactExpansion(e, true)
  assert.equal(comps.PlatformConstruction.get(e).yawDeg, 45)
  assert(rules.isInArc(0, 10, 0, 24))
  assert(!rules.isInArc(0, -10, 0, 24))
  assert(!rules.isInArc(0, 25, 0, 24))
})
test('Towers resupply from nearby storage and leave distant storage untouched', () => {
  const e = device('ballista'),
    far = device('ammoCrate', 9)
  comps.StorageContents.create(far, { slots: [{ id: 'bolts', count: 5 }] })
  runtime.debugAdvanceExpansion(1)
  assert.equal(comps.ExpansionState.get(e).ammo, 0)
  Transform.getMutable(far).position.x = 3
  runtime.debugAdvanceExpansion(1)
  assert.equal(comps.ExpansionState.get(e).ammo, 5)
  assert.equal(comps.StorageContents.get(far).slots[0].count, 0)
})
test('Power relay bridges distance; ordinary consumers do not bridge networks', () => {
  const nodes = [
    { id: 1, kind: 'generator', x: 0, z: 0, fuel: 10, stock: 0 },
    { id: 2, kind: 'powerRelay', x: 6, z: 0, fuel: 0, stock: 0 },
    { id: 3, kind: 'rescueRadio', x: 12, z: 0, fuel: 0, stock: 0 }
  ]
  assert.equal(power.powerSources(nodes, 3).length, 1)
  nodes[1].kind = 'antennaMast'
  assert.equal(power.powerSources(nodes, 3).length, 0)
})
test('Autowiring reconnects from placement alone and disconnects removed or distant relays', () => {
  const nodes = [
    { id: 1, kind: 'generator', x: 0, z: 0, fuel: 20, stock: 0 },
    { id: 2, kind: 'rescueRadio', x: power.AUTO_WIRE_RANGE_M, z: 0, fuel: 0, stock: 0 }
  ]
  assert.equal(power.powerSources(nodes, 2).length, 1, 'range boundary connects automatically')
  nodes[1].x += 0.01
  assert.equal(power.powerSources(nodes, 2).length, 0, 'outside range has no lingering link')
  nodes.push({ id: 3, kind: 'powerRelay', x: 4, z: 0, fuel: 0, stock: 0 })
  assert.equal(power.powerSources(nodes, 2).length, 1, 'placing a relay connects without an action')
  nodes.pop()
  assert.equal(power.powerSources(nodes, 2).length, 0, 'removing a relay breaks the connection')
  nodes[1].x = 3
  assert.equal(power.powerSources(nodes, 2).length, 1, 'moving the consumer reconnects automatically')
  nodes[0].fuel = 0
  assert.equal(power.powerSources(nodes, 2).length, 0, 'empty generator supplies no power')
})
test('Batteries pay only unmet power and cannot double-spend across consumers', () => {
  const nodes = [
    { id: 1, kind: 'generator', x: 0, z: 0, fuel: 0.25, stock: 0 },
    { id: 2, kind: 'batteryBank', x: 1, z: 0, fuel: 0, stock: 0.5 },
    { id: 3, kind: 'rescueRadio', x: 2, z: 0, fuel: 0, stock: 0 },
    { id: 4, kind: 'batteryBank', x: 100, z: 0, fuel: 0, stock: 100 }
  ]
  assert.equal(power.supplyPower(nodes, 3, 1), 0.75)
  assert.equal(nodes[1].stock, 0)
  assert.equal(nodes[3].stock, 100)
  assert.equal(power.supplyPower(nodes, 3, 1), 0.25)
})
test('Battery charges through relay and generator supply does not discharge it', () => {
  device('generator', 0, 0, { fuel: 30 })
  device('powerRelay', 6)
  const battery = device('batteryBank', 12)
  device('antennaMast', 12)
  const radio = device('rescueRadio', 12, 0, { active: true, installed: true })
  runtime.debugAdvanceExpansion(10)
  assert.equal(comps.ExpansionState.get(battery).stock, 20)
  assert.equal(comps.ExpansionState.get(radio).progress, 10)
})
test('Radio pauses without power or antenna and resumes toward victory', () => {
  const radio = device('rescueRadio', 0, 0, { installed: true, active: true })
  runtime.debugAdvanceExpansion(10)
  assert.equal(comps.ExpansionState.get(radio).progress, 0)
  device('batteryBank', 3, 0, { stock: 120 })
  runtime.debugAdvanceExpansion(10)
  assert.equal(comps.ExpansionState.get(radio).progress, 0)
  device('antennaMast', 0, 3)
  runtime.debugAdvanceExpansion(60)
  assert.equal(comps.ExpansionState.get(radio).progress, 60)
  runtime.debugAdvanceExpansion(60)
  assert.equal(won, false, 'broadcast alone must not win')
  load('progression/state.ts').recordProgress('finaleCleared')
  runtime.debugAdvanceExpansion(1)
  assert(won)
})
test('Radio installation consumes a core and starts a announced defensive raid', () => {
  const radio = device('rescueRadio')
  pocket.set('transmitterCore', 1)
  runtime.interactExpansion(radio, false)
  assert.equal(pocket.get('transmitterCore'), 0)
  device('generator', 3, 0, { fuel: 30 })
  device('antennaMast', 0, 3)
  runtime.interactExpansion(radio, false)
  assert(comps.ExpansionState.get(radio).active)
  assert.equal(runtime.startRaid(), false)
})
test('Closed barriers divert boarders; an unavoidable barrier can be attacked', () => {
  const cells = [
    { id: 1, x: 0, z: 0, blocked: false },
    { id: 2, x: 1, z: 0, blocked: true },
    { id: 3, x: 2, z: 0, blocked: false },
    { id: 4, x: 0, z: 1, blocked: false },
    { id: 5, x: 1, z: 1, blocked: false },
    { id: 6, x: 2, z: 1, blocked: false }
  ]
  assert.equal(paths.nextDeckStep(cells, 1, 3), 4)
  assert.equal(paths.nextDeckStep(cells.slice(0, 3), 1, 3), 2)
  assert.equal(paths.nextDeckStep([cells[0], cells[2]], 1, 3), null)
})
test('Repair consumes a kit only for damage and panels suppress tool actions', () => {
  const e = device('wall', 0, 0, { health: 25, maxHealth: 100 })
  selected = 'repairKit'
  pocket.set('repairKit', 3)
  fire = true
  locked = true
  runtime.expansionSystem(0.25)
  assert.equal(comps.ExpansionState.get(e).health, 25)
  locked = false
  runtime.expansionSystem(0.25)
  assert.equal(comps.ExpansionState.get(e).health, 75)
  assert.equal(pocket.get('repairKit'), 2)
  runtime.expansionSystem(0.25)
  assert.equal(comps.ExpansionState.get(e).health, 100)
  runtime.expansionSystem(0.25)
  assert.equal(pocket.get('repairKit'), 1)
})
test('Bandage heals gradually and incoming damage interrupts recovery', () => {
  selected = 'bandage'
  pocket.set('bandage', 1)
  fire = true
  runtime.expansionSystem(0.25)
  fire = false
  runtime.expansionSystem(1)
  assert(life > 0.5)
  life -= 0.1
  const injured = life
  runtime.expansionSystem(1)
  assert.equal(life, injured)
  const result = rules.applyArmor(0.2, 0.05)
  assert(Math.abs(result.damage - 0.15) < 1e-9)
  assert.equal(result.armor, 0)
})
test('Sail and engine produce selected salvage only while operating', () => {
  const sail = device('sail')
  runtime.debugAdvanceExpansion(30)
  assert.equal(debris.length, 0)
  runtime.interactExpansion(sail, false)
  runtime.debugAdvanceExpansion(15)
  assert.equal(debris.length, 1)
  const wheel = device('steeringWheel')
  runtime.interactExpansion(wheel, false)
  runtime.debugAdvanceExpansion(15)
  assert.equal(debris[1].kind, 'metal')
})
test('Restart removes live raiders and clears raid and healing state', () => {
  device('wall')
  assert(runtime.startRaid())
  runtime.debugAdvanceExpansion(31)
  assert(runtime.getExpansionStatus().includes('enemies'))
  runtime.resetExpansion()
  assert.equal(runtime.getExpansionStatus(), null)
  assert(removed.length >= 2)
  assert(runtime.startRaid())
})
test('Sprite roots own cleanup, retain support identity and keep stairs physically walkable', () => {
  const sprites = load('expansion/sprites.ts')
  const root = ecs.engine.addEntity()
  Transform.create(root, { position: point() })
  sprites.attachPrototypeSprite(root, 'stairs')
  assert.equal(sprites.getSpriteKind(root), 'stairs')
  const children = [...Transform.data].filter(([, t]) => t.parent === root)
  assert.equal(children.length, 9, 'one sprite plus eight step colliders')
  const steps = children.map(([, t]) => t).filter(t => t.scale.z === 0.32)
  assert.equal(steps.length, 8)
  assert(Math.abs(steps[7].scale.y - 2.24) < 1e-9)
  sprites.removePrototypeEntity(root)
  assert.equal(sprites.getSpriteKind(root), undefined)
  for (const [e] of children) assert.equal(Transform.getOrNull(e), null)
  assert.equal(Transform.getOrNull(root), null)
})
test('Every expansion item has transparent source art, a world sprite and a matching icon', () => {
  for (const item of [...catalog.EXPANSION_ITEMS, { id: 'zombie' }]) {
    for (const folder of ['images/concepts/expansion', 'images/scene/expansion']) {
      const sprite = fs.readFileSync(path.resolve(root, '..', folder, item.id + '.png'))
      assert.equal(sprite[25], 6, item.id)
      if (folder.includes('/scene/')) assert.equal(sprite.readUInt32BE(16), 512, item.id)
    }
    const png = fs.readFileSync(path.resolve(root, '..', catalog.expansionIcon(item)))
    assert.equal(png[25], 6, item.id)
    assert.equal(png.readUInt32BE(16), 128, item.id)
  }
})

const progress = load('progression/state.ts')
function campaignChapter3() {
  progress.resetProgress('campaign')
  for (const action of ['expand','drink','cookedMeal','plate']) progress.recordProgress(action)
  progress.tickProgress(75)
}
function shootApproachingRaid() {
  selected = 'bow'; pocket.set('arrows', 100); fire = true
  for (let t = 0; t < 20; t++) {
    const enemies = [...GltfContainer.data].filter(([,v]) => v.src.endsWith('/boat.glb') || v.src.endsWith('/shark.glb'))
    if (!enemies.length) break
    const target = Transform.get(enemies[0][0]).position
    Transform.getMutable(2).position = { x: target.x, y: target.y, z: target.z - 2 }
    Transform.getMutable(2).rotation = {x:0,y:0,z:0,w:1}
    runtime.expansionSystem(1)
  }
  fire = false
}
test('Campaign craft authorization cannot bypass milestones using an existing station', () => {
  progress.resetProgress('campaign')
  const station = device('workbench'); context.setCraftStation(station)
  pocket.set('metal', 20); pocket.set('wood', 20)
  assert.equal(craft.getCraftBlockReason('smelter'), 'REACH NEXT MILESTONE')
  assert(!craft.startCraft('smelter')); assert.equal(pocket.get('metal'),20)
  for (const action of ['expand','drink','cookedMeal']) progress.recordProgress(action)
  assert(craft.startCraft('smelter'))
})
test('Queue cannot consume a sixth batch', () => {
  const e=device('smelter'); pocket.set('metal',20)
  for(let i=0;i<8;i++)runtime.interactExpansion(e,false)
  assert.equal(comps.ExpansionState.get(e).queued,5);assert.equal(pocket.get('metal'),10)
})
test('Real combat advances three story raids once, retains full-pack core, permits loss recovery', () => {
  campaignChapter3(); const bell=device('alarmBell');
  for(let i=0;i<3;i++){
    room=false; assert(runtime.startRaid()); assert(!runtime.startRaid()); runtime.debugAdvanceExpansion(30)
    shootApproachingRaid(); assert.equal(progress.storyWins(),i+1)
    progress.tickProgress(75)
  }
  assert.equal(progress.pendingRewards().transmitterCore,1)
  room=true;runtime.interactExpansion(bell,true)
  assert.equal(pocket.get('transmitterCore'),1)
  runtime.interactExpansion(bell,true);assert.equal(pocket.get('transmitterCore'),1)
  pocket.set('transmitterCore',0);runtime.interactExpansion(bell,true);assert.equal(pocket.get('transmitterCore'),1)
  const radio=device('rescueRadio');runtime.interactExpansion(radio,false)
  runtime.interactExpansion(bell,true);assert.equal(pocket.get('transmitterCore'),0,'installed core must prevent another claim')
})
test('Finite finale clears every reinforcement before an already-finished broadcast wins', () => {
  campaignChapter3();for(let i=0;i<3;i++)progress.completeStoryRaid()
  const radio=device('rescueRadio',0,0,{installed:true,progress:120})
  device('generator',3,0,{fuel:120}); device('antennaMast',0,3)
  runtime.interactExpansion(radio,false)
  assert(comps.ExpansionState.get(radio).active)
  for(let group=0;group<3;group++){
    assert(!won);runtime.debugAdvanceExpansion(group===0?30:15);shootApproachingRaid()
    if(group<2)assert(!won)
  }
  assert(won);assert(progress.hasProgress('finaleCleared'));assert.equal(progress.storyWins(),3)
})
console.log(passed + ' expansion tests passed')
