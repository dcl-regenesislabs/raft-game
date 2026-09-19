const assert = require('node:assert/strict')
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript')
const root = path.resolve(__dirname, '../src')
let mobile = true,
  touches = 0,
  equipped = null,
  completed = new Set(),
  area = { top: 24, left: 110, right: 90, bottom: 36, width: 1000, height: 600 }
const mocks = new Map(),
  cache = new Map()
const mock = (name, value) => mocks.set(path.resolve(root, name), value)
const react = {
  createElement: (type, props, ...children) =>
    typeof type === 'function'
      ? type({ ...props, children: children.length === 1 ? children[0] : children })
      : { type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }
}
function load(file) {
  const absolute = path.resolve(root, file)
  if (mocks.has(absolute)) return mocks.get(absolute)
  if (cache.has(absolute)) return cache.get(absolute)
  const exports = {}
  cache.set(absolute, exports)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      jsxFactory: 'ReactEcs.createElement'
    }
  }).outputText
  vm.runInNewContext(
    code,
    {
      exports,
      console,
      require: (name) => {
        if (name === '@dcl/sdk/react-ecs') return { default: react, ...react, UiEntity: 'UiEntity', Label: 'Label' }
        if (name === '@dcl/sdk/platform') return { isMobile: () => mobile }
        if (name === '@dcl/sdk/math')
          return { Color4: { create: (r, g, b, a) => ({ r, g, b, a }), White: () => ({ r: 1, g: 1, b: 1, a: 1 }) } }
        const base = path.resolve(path.dirname(absolute), name)
        return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts'))
      }
    },
    { filename: absolute }
  )
  return exports
}
let craftContext = null
mock('ui/craftContext.ts', { getCraftContextKind: () => craftContext })
let deviceArea = null
mock('ui/mobileLayout.ts', { getMobileLayout: (hardwareOnly) => hardwareOnly && deviceArea ? deviceArea : area })
mock('ui/mobileControlsState.ts', { beginUiTouch: () => touches++ })
mock('ui/theme.ts', { HANDS_ICON: 'hands.png', CLOSE_BUTTON_SIZE: 48 })
mock('ui/tutorialState.ts', {
  isTutorialExpanded: () => true,
  isTutorialEnabled: () => true,
  hasTutorialAction: (action) => completed.has(action),
  dismissTutorial: () => {},
  finishTutorial: () => {},
  showTutorial: () => {}
})
mock('systems/nativeEquipment.ts', {
  equipInventorySlot: (slot) => {
    equipped = slot
  }
})
mock('ui/items.ts', {
  getInventorySlot: (slot) => (slot < 0 ? null : { name: 'Fishing rod', texture: 'rod.png' }),
  getItemDisplayName: (item) => item.name
})
mock('ui/inventoryState.ts', {
  HANDS_SLOT: -1,
  getSelectedSlot: () => 2,
  isSlotSelectable: () => true,
  getEquippableSlots: () => Array.from({ length: 25 }, (_, i) => i)
})
function nodes(tree) {
  return tree ? [tree, ...(tree.children || tree.props?.children || []).flat(Infinity).flatMap(nodes)] : []
}
function all(tree) {
  const out = []
  const walk = (n) => {
    if (!n) return
    if (Array.isArray(n)) return n.forEach(walk)
    out.push(n)
    walk(n.children)
  }
  walk(tree)
  return out
}
let count = 0
function test(name, fn) {
  fn()
  count++
  console.log('PASS ' + name)
}
const { OutcomeScreen } = load('ui/components/OutcomeScreen.tsx')
test('Ending ignores taps during fade, then gates input before continuing', () => {
  let fired = 0
  const props = {
    title: 'YOU WON',
    message: 'Done',
    backdrop: 1,
    fade: 0.4,
    primary: { label: 'CONTINUE', action: () => fired++ }
  }
  let button = all(OutcomeScreen(props)).find((n) => n.props.onMouseUp && n.props.uiTransform.height === 52)
  button.props.onMouseUp()
  assert.equal(fired, 0)
  button = all(OutcomeScreen({ ...props, fade: 1 })).find((n) => n.props.onMouseUp && n.props.uiTransform.height === 52)
  const before = touches
  button.props.onMouseUp()
  assert.equal(fired, 1)
  assert.equal(touches, before + 1)
})
test('Outcome fits a narrow safe area and keeps primary/secondary touch targets', () => {
  area = { ...area, width: 400, height: 420 }
  const tree = all(
    OutcomeScreen({
      title: 'YOU WON',
      message: 'Done',
      fade: 1,
      backdrop: 1,
      primary: { label: 'CONTINUE', action: () => {} },
      secondary: { label: 'LOBBY', action: () => {} }
    })
  )
  assert.ok(tree.some((n) => n.props.uiTransform?.width === 368 && n.props.uiTransform.maxHeight === 388))
  assert.equal(tree.filter((n) => n.props.onMouseUp && n.props.uiTransform.height >= 48).length, 2)
})
test('Outcome centers in device insets independently of asymmetric Explorer controls', () => {
  deviceArea = { top: 10, left: 24, right: 24, bottom: 18, width: 1500, height: 680 }
  const tree = all(OutcomeScreen({
    title: 'GAME OVER', message: 'Try again', fade: 1, backdrop: 1,
    primary: { label: 'RETRY', action: () => {} }
  }))
  const frame = tree.find((n) => n.props.uiTransform?.position?.left === 24)
  assert.ok(frame)
  assert.equal(frame.props.uiTransform.position.right, 24)
  assert.equal(frame.props.uiTransform.position.top, 10)
  assert.equal(frame.props.uiTransform.position.bottom, 18)
  assert.ok(tree.some((n) => n.props.uiTransform?.width === 520 && n.props.uiTransform.maxHeight === 648))
  deviceArea = null
})
const { ToolPicker } = load('ui/components/ToolPicker.tsx')
test('All twenty-five equipment slots plus Hands are reachable through touch pages', () => {
  const visited = new Set()
  for (let page = 0; page < 31; page++) {
    const tree = all(ToolPicker()),
      buttons = tree.filter((n) => n.props.onMouseUp)
    const rows = buttons.filter((n) => n.props.uiTransform.height === 50)
    assert.ok(rows.every((n) => n.props.uiTransform.flexShrink === 0))
    for (const row of rows) {
      row.props.onMouseUp()
      visited.add(equipped)
    }
    const next = buttons.at(-1)
    next.props.onMouseUp()
  }
  assert.equal(visited.size, 26)
  assert.ok(visited.has(-1) && visited.has(24))
})
const { getMenuPage } = load('ui/components/MenuList.tsx')
test('Pages clamp after inventory shrinks and reserve footer space', () => {
  assert.equal(getMenuPage(31, 300, 54, 99).page, 7)
  assert.equal(getMenuPage(2, 300, 54, 7).page, 0)
  for (const h of [220, 300, 428]) {
    const p = getMenuPage(31, h, 54, 0)
    assert.ok(p.pageSize * 54 + 56 <= h)
  }
})
const { Tutorial } = load('ui/components/Tutorial.tsx')
test('Every guide step fits concise copy and water steps name the correct action', () => {
  const steps = [
    'collect',
    'inventory',
    'rope',
    'hammer',
    'expand',
    'purifier',
    'saltWater',
    'freshWater',
    'drink',
    'grill',
    'eat'
  ]
  for (const step of steps) {
    const tree = all(Tutorial()),
      texts = tree.filter((n) => n.type === 'Label').map((n) => n.props.value)
    const body = texts[2]
    assert.ok(body.length <= 330, step + ' guide copy too long')
    if (step === 'drink') {
      assert.match(body, /large cup button/)
      assert.doesNotMatch(body, /hammer|Build\/Erase/)
    }
    if (step === 'saltWater') assert.match(body, /large cup button/)
    assert.ok(tree.some((n) => n.props.onMouseUp && n.props.uiTransform.height >= 48))
    completed.add(step)
  }
})
test('Desktop guide uses keyboard water instructions', () => {
  mobile = false
  completed = new Set(['collect', 'inventory', 'rope', 'hammer', 'expand', 'purifier'])
  assert.ok(all(Tutorial()).some((n) => n.props.value?.includes('press E to fill')))
})
test('Desktop lists retain all entries and wheel scrolling', () => {
  mobile = false
  const tree = all(ToolPicker())
  assert.equal(tree.filter((n) => n.props.onMouseUp && n.props.uiTransform.height === 50).length, 26)
  assert.ok(tree.some((n) => n.props.uiTransform?.overflow === 'scroll'))
})
let dismissed = 0,
  protectedClicks = 0
mock('ui/inventoryToggle.ts', { protectPanelDismissal: () => protectedClicks++, setInventoryOpen: () => dismissed++ })
mock('ui/craftToggle.ts', { setCraftOpen: () => dismissed++ })
mock('ui/cookToggle.ts', { setCookOpen: () => dismissed++ })
mock('ui/storageToggle.ts', { closeStorageMenu: () => dismissed++ })
mock('ui/systemSession.ts', { setSystemMenuOpen: () => dismissed++ })
const { PanelBackdrop } = load('ui/components/PanelBackdrop.tsx')
test('Outside release closes every menu and protects the next world action', () => {
  const backdrop = PanelBackdrop({ transparent: true })
  backdrop.props.onMouseDown()
  assert.equal(dismissed, 0)
  backdrop.props.onMouseUp()
  assert.equal(dismissed, 5)
  assert.equal(protectedClicks, 1)
  assert.equal(backdrop.props.uiBackground.color.a, 0)
})
test('Panel interior consumes input without dismissing menus', () => {
  const { Panel } = load('ui/panel.tsx')
  const panel = Panel({})
  panel.props.onMouseDown()
  panel.props.onMouseUp()
  assert.equal(dismissed, 5)
})

const { CRAFTABLE_ITEMS } = load('ui/craftableItems.ts')
const { getCraftCategories, getContextCraftRecipes, filterCraftRecipes, resolveCraftSelection } = load('ui/craftCategories.ts')
test('Craft categories cover every implemented recipe and include expansion groups', () => {
  load('progression/state.ts').resetProgress('sandbox')
  const categories = getCraftCategories(CRAFTABLE_ITEMS).map((c) => c.id)
  assert.ok(CRAFTABLE_ITEMS.length >= 50)
  assert.ok(CRAFTABLE_ITEMS.every((item) => categories.includes(item.category)))
  assert(!categories.includes('all'))
  assert(!CRAFTABLE_ITEMS.some(item => ['bandage','repairKit'].includes(item.id)))
  assert.ok(categories.includes('defenses') && categories.includes('power-radio'))
  assert.ok(filterCraftRecipes('tools').length >= 3)
  assert.equal(getContextCraftRecipes().length, CRAFTABLE_ITEMS.filter(item => !item.station).length)
})
test('Filtered selection remains valid after materials are spent', () => {
  const tools = filterCraftRecipes('tools')
  assert.equal(resolveCraftSelection(tools, 'hammer'), 'hammer')
  assert.equal(resolveCraftSelection(tools, 'rope'), 'hook')
  assert.equal(resolveCraftSelection([], 'hook'), null)
})
let craftRevision = 0
let craftSelected = 'rope',
  craftOpen = true,
  available = true
mock('ui/craftToggle.ts', {
  isCraftOpen: () => craftOpen,
  craftOpenRevision: () => craftRevision,
  craftGuidePulse: () => 0,
  getSelectedCraftableId: () => craftSelected,
  selectCraftable: (id) => {
    craftSelected = id
  },
  setCraftOpen: (value) => {
    craftOpen = value
  }
})
mock('ui/craftSession.ts', { canStartCraft: () => available, getCraftBlockReason: () => available ? null : 'NEED ITEMS', startCraft: () => {} })
mock('ui/pressPulse.ts', { createPressPulse: () => ({ getScale: () => 1, press: () => {} }) })
mock('ui/storageSession.ts', { getCombinedCount: () => 0 })
mock('ui/items.ts', { getMaterialDef: () => null })
mocks.delete(path.resolve(root, 'ui/theme.ts'))
cache.delete(path.resolve(root, 'ui/components/CraftMenu.tsx'))
const { CraftDoubleMenu } = load('ui/components/CraftMenu.tsx')
function pressText(tree, text) {
  const button = all(tree)
    .filter((n) => n.props.onMouseUp && all(n).some((child) => child.props.value === text))
    .at(-1)
  assert.ok(button, 'button missing: ' + text)
  button.props.onMouseUp()
}
test('Mobile shows category icons beside recipes and details with one-tap switching', () => {
  mobile = true
  area = { ...area, width: 1000, height: 650 }
  let tree = CraftDoubleMenu()
  const icon = 'images/hud/categories/tools.png'
  const button = all(tree)
    .filter((n) => n.props.onMouseUp && all(n).some((c) => c.props.uiBackground?.texture?.src === icon))
    .at(-1)
  assert.ok(button)
  assert.equal(button.props.uiTransform.height, 56)
  button.props.onMouseUp()
  tree = CraftDoubleMenu()
  assert.equal(craftSelected, 'hook')
  assert.ok(all(tree).some((n) => n.props.value === 'Tools'))
  assert.ok(!all(tree).some((n) => n.props.value?.includes('Back to recipes')))
  assert.ok(
    !all(tree).some(
      (n) => n.props.onMouseUp && n.props.uiTransform.height === 50 && all(n).some((c) => c.props.value === 'ROPE')
    )
  )
})
test('Craft keeps unavailable recipes visible and has no availability filter', () => {
  available = false
  const tree = CraftDoubleMenu()
  assert.equal(craftSelected, 'hook')
  assert.ok(!all(tree).some((n) => n.props.value?.includes('Can craft')))
  assert.ok(all(tree).some((n) => n.props.value === 'NEED ITEMS'))
})
test('Craft action lives in a fixed footer outside the scrolling details', () => {
  available = true
  const tree = CraftDoubleMenu()
  const scroll = all(tree).find((n) => n.props.uiTransform?.overflow === 'scroll')
  assert.ok(scroll)
  assert.ok(!all(scroll).some((n) => n.props.value === 'CRAFT'))
  const footer = all(tree).find(
    (n) => n.props.uiTransform?.justifyContent === 'space-between' && all(n).some((c) => c.props.value === 'MAKES 1')
  )
  assert.ok(footer)
  assert.equal(footer.props.uiTransform.flexShrink, 0)
  assert.ok(all(footer).some((n) => n.props.value === 'CRAFT'))
})

test('Compact category pagination reserves room for full-size stacked controls', () => {
  const page = getMenuPage(10, 400, 64, 99, 112)
  assert.equal(page.pageSize, 4)
  assert.equal(page.pageCount, 3)
  assert.equal(page.page, 2)
  assert.ok(page.pageSize * 64 + 112 <= 400)
})
test('Every category has an existing transparent texture asset', () => {
  const { CRAFT_CATEGORY_ICONS } = load('ui/craftCategories.ts')
  assert.equal(CRAFT_CATEGORY_ICONS.length, 10)
  for (const icon of CRAFT_CATEGORY_ICONS) {
    const png = fs.readFileSync(path.resolve(root, '..', icon))
    assert.equal(png.readUInt32BE(16), 128)
    assert.equal(png.readUInt32BE(20), 128)
    assert.equal(png[25], 6, 'RGBA PNG')
  }
})
test('Basic crafting hides every specialized recipe and entire advanced categories', () => {
  craftContext = null
  const recipes = getContextCraftRecipes()
  assert(recipes.every(item => !item.station))
  const categories = getCraftCategories().map(c => c.id)
  for (const id of ['navigation','power-radio','defenses','building']) assert(!categories.includes(id), id)
})
test('Every worktable lists only its recipes and resets stale category selection', () => {
  for (const station of ['workbench','armoryBench','engineeringBench','researchTable']) {
    craftContext = station
    const recipes = getContextCraftRecipes()
    assert(recipes.length > 0)
    assert(recipes.every(item => item.station === station))
    const tree = CraftDoubleMenu()
    assert(recipes.some(item => item.id === craftSelected))
    const visibleIcons = all(tree).map(n => n.props.uiBackground?.texture?.src).filter(Boolean)
    for (const category of getCraftCategories()) {
      assert(recipes.some(item => item.category === category.id) || category.id === 'investigation')
    }
    assert(!visibleIcons.includes('images/hud/items/hook.png'))
  }
  craftContext = null
})
test('Guided crafting selects the marked recipe on open and follows tutorial unlocks', () => {
 const p=load('progression/state.ts');p.resetProgress('campaign');craftContext=null;
 p.recordProgress('collect');p.recordProgress('inventory');craftRevision++;
 let tree=CraftDoubleMenu();assert.equal(craftSelected,'rope');assert(all(tree).filter(n=>n.props.value==='◆').length>=2);
 assert(all(tree).some(n=>n.props.value==='◆  NEXT OBJECTIVE'));
 p.recordProgress('rope');craftRevision++;tree=CraftDoubleMenu();assert.equal(craftSelected,'hammer');
 assert(!all(tree).some(n=>n.props.value==='FISHING ROD'));
 p.skipInvestigation();craftRevision++;tree=CraftDoubleMenu();assert(!all(tree).some(n=>n.props.value==='◆  NEXT OBJECTIVE'));
 assert(getCraftCategories().some(c=>c.id==='stations'));
 p.resetProgress('sandbox');
})
test('Investigation goals and recipe rewards paginate inside the existing craft panel', () => {
 craftContext=null;craftRevision++;let tree=CraftDoubleMenu();
 const button=all(tree).filter(n=>n.props.onMouseUp&&all(n).some(c=>c.props.uiBackground?.texture?.src==='images/hud/categories/investigation.png')).at(-1);
 button.props.onMouseUp();tree=CraftDoubleMenu();assert(all(tree).some(n=>n.props.value==='Investigation'));assert(all(tree).some(n=>n.props.value==='ALL RECIPES UNLOCKED'));
 assert(all(tree).some(n=>n.props.value==='Basic crafting'));assert(!all(tree).some(n=>n.props.value==='CRAFT'));
})
console.log(count + ' UI review tests passed')
