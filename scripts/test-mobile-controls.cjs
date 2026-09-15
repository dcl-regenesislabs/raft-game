const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), root = path.resolve(__dirname, '../src'), cache = new Map(), mocks = new Map()
let mobile = true, pressed = false, down = false, keyDown = null, cancelled = 0, selected = 0, target = null, line = false, biting = false, panel = false, writes = []
let builderMode = 'idle', constructionMode = 'idle'
let canvas = { width: 2712, height: 1220, interactableArea: { left: 220, right: 220, top: 60, bottom: 120 } }
const component = () => { const data = new Map(); return { data, getOrNull: e => data.get(e) ?? null } }
const components = Object.fromEntries(['ActiveCook', 'ChefNpc', 'FloatingIsland', 'IslandChest', 'PlatformConstruction', 'PurifierState'].map(k => [k, component()]))
components.CookStatus = { Cooking: 1, Ready: 2, Burned: 3 }
const ecs = {
 InputAction: { IA_POINTER: 0, IA_PRIMARY: 1, IA_SECONDARY: 2, IA_ACTION_3: 3, IA_ACTION_4: 4, IA_ACTION_5: 5, IA_ACTION_6: 6, IA_JUMP: 7 }, PointerEventType: { PET_DOWN: 0 },
 inputSystem: { isPressed: () => pressed, isTriggered: action => keyDown === null ? down : action === keyDown },
 UiCanvasInformation: { getOrNull: () => canvas }, TouchScreenControls: { createOrReplace: (_, value) => writes.push(value) },
 engine: { RootEntity: 0, getEntitiesWith: function*(c) { for (const [e, v] of c.data) yield [e, v] } }
}
function mock(file, value) { mocks.set(path.resolve(root, file), value) }
function load(file) {
 const absolute = path.resolve(root, file)
 if (mocks.has(absolute)) return mocks.get(absolute)
 if (cache.has(absolute)) return cache.get(absolute)
 const exports = {}; cache.set(absolute, exports)
 const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
 vm.runInNewContext(code, { exports, console, Date, Math, require: name => {
   if (name === '@dcl/sdk/ecs') return ecs
   if (name === '@dcl/sdk/platform') return { isMobile: () => mobile }
   return load(path.resolve(path.dirname(absolute), name) + '.ts')
 } }, { filename: absolute })
 return exports
}
const items = [{ id: 'hook', heldKind: 'hook', texture: 'hook.png', hasAction: true, selectable: true }, { id: 'cup', heldKind: 'cup', texture: 'cup.png', hasAction: true, selectable: true }]
mock('components.ts', components)
mock('ui/theme.ts', { HANDS_ICON: 'images/hud/hands.png' })
mock('factories/islandChest.ts', { CHEST_INTERACT_MAX_DISTANCE: 4 })
mock('factories/heldItem.ts', { getHeldFoodId: () => items[selected]?.id, getHeldItemKind: () => items[selected]?.heldKind })
mock('ui/items.ts', { getInventorySlot: i => items[i] ?? null, getCatalogItem: id => ({ texture: id + '.png' }) })
mock('ui/inventoryState.ts', { getSelectedSlot: () => selected, selectSlot: i => { if (!panel) selected = i }, isSlotSelectable: i => !!items[i]?.selectable, getSlotHasAction: i => !!items[i]?.hasAction })
mock('ui/actionButton.ts', { actionButtonJustPressed: () => false, isActionButtonPressed: () => false })
mock('ui/cookableItems.ts', { getCookableById: () => ({ texture: 'meal.png' }) })
for (const [file, fn] of [['craftToggle','isCraftOpen'],['cookToggle','isCookOpen'],['inventoryToggle','isInventoryOpen'],['gameOver','isGameOver'],['startupGate','isStartupGateActive'],['storageToggle','isStorageOpen'],['systemSession','isSystemMenuOpen'],['winScreen','isWinActive'],['craftSession','isCrafting']]) mock('ui/' + file + '.ts', { [fn]: () => panel })
mock('systems/constructionPlacement.ts', { getConstructionPlacementMode: () => constructionMode, cancelConstructionPreview: () => cancelled++ })
mock('systems/raftBuilder.ts', { getRaftBuilderMode: () => builderMode, cancelRaftPreview: () => cancelled++ })
mock('systems/fishingRod.ts', { isFishingLineActive: () => line, isFishingBiting: () => biting, cancelFishingForEquipmentChange: () => { cancelled++; line = false } })
mock('systems/lookAtTarget.ts', { getProximityConstruction: () => ['grill','purifier','storage'].includes(target) ? { platform: 20, child: 10, kind: target } : null, getLookAtTarget: () => target, getLookAtPointerHit: () => target ? { entity: 10, length: 2 } : null, getLookAtGrillPlatform: () => 20, getLookAtGarbageKind: () => 'plants' })
mock('systems/hookThrower.ts', { cancelHookCharge: () => cancelled++ })
mock('systems/anchorThrower.ts', { cancelAnchorCharge: () => cancelled++ })
mock('ui/inventoryToggle.ts', { isEquipmentPickerOpen: () => false, isInventoryOpen: () => panel, setInventoryOpen: value => { panel = value }, isInventoryActionLocked: () => panel || gate.isMobileUiInputBlocked() })
const gate = load('ui/mobileControlsState.ts'), fire = load('systems/toolFire.ts'), controls = load('systems/touchControls.ts'), layout = load('ui/mobileLayout.ts')
let count = 0
function test(name, fn) { fn(); count++; console.log('PASS ' + name) }
test('UI touch blocks fire until release, including a long held touch', () => {
 pressed = down = true; gate.beginUiTouch(); down = false; gate.mobileUiInputSystem(1)
 assert.equal(fire.toolFireJustPressed(), false)
 pressed = down = false; gate.mobileUiInputSystem(0.01)
 pressed = down = true; assert.equal(fire.toolFireJustPressed(), true)
 pressed = down = false
})
test('A fresh native press recovers from stale pressed state after UI dismissal', () => {
 pressed = true; down = true; gate.beginUiTouch()
 assert.equal(fire.toolFireJustPressed(), false)
 down = false; gate.mobileUiInputSystem(1)
 assert.equal(fire.toolFireJustPressed(), false)
 down = true; assert.equal(fire.toolFireJustPressed(), true)
 pressed = down = false; gate.mobileUiInputSystem(1)
})
test('Equipped item updates native icon even when visibility stays true', () => {
 controls.touchControlsSystem(0); const first = writes.length
 items[0] = { id: 'spear', heldKind: 'spear', texture: 'spear.png', hasAction: true, selectable: true }
 controls.touchControlsSystem(0); assert.equal(writes.length, first + 1)
 assert.equal(writes.at(-1).touchInputs.find(b => b.inputAction === 0).icon.tex.texture.src, 'spear.png')
 controls.touchControlsSystem(0); assert.equal(writes.length, first + 1)
})
test('Empty cup uses the main action without a duplicate fill button', () => {
 selected = 1; target = 'water'; const state = controls.resolveMobileControls()
 assert.equal(state.e.visible, false); assert.equal(state.pointer.label, 'Fill cup'); assert.equal(state.pointer.visible, true)
})
test('Purifier retains simultaneous interaction and fuel controls', () => {
 target = 'purifier'; components.PlatformConstruction.data.set(20, { child: 10, kind: 'purifier' }); components.PurifierState.data.set(20, { fireSec: 0, freshAmount: 1 })
 const state = controls.resolveMobileControls(); assert(state.e.visible && state.f.visible); assert.equal(state.e.label, 'Drink water'); assert.equal(state.f.icon, 'wood.png')
})
test('Ready meal icon changes without changing the grill interaction visibility', () => {
 target = 'grill'; controls.touchControlsSystem(0); const before = writes.length
 components.ActiveCook.data.set(20, { status: 2, recipeId: 'meal' }); controls.touchControlsSystem(0)
 assert.equal(writes.length, before + 1); assert.equal(controls.resolveMobileControls().e.icon, 'meal.png')
})
test('Fishing exposes catch/retract on the single native pointer action', () => {
 selected = 0; target = null; line = true; biting = true
 assert.equal(controls.resolveMobileControls().pointer.label, 'CATCH!')
 biting = false; assert.equal(controls.resolveMobileControls().pointer.label, 'Retract'); line = false
})
test('Cook and salt-water actions use catalog artwork', () => {
 target = 'grill'; components.ActiveCook.data.clear()
 assert.equal(controls.resolveMobileControls().e.icon, 'grill.png')
 target = 'purifier'; components.PurifierState.data.set(20, { freshAmount: 0, fireSec: 0 })
 assert.equal(controls.resolveMobileControls().e.icon, 'saltWater.png')
 assert.equal(controls.resolveMobileControls().f.icon, 'wood.png')
 target = null
})
test('Menus hide all native world actions', () => {
 panel = true; const state = controls.resolveMobileControls(); assert([state.pointer, state.e, state.f, ...state.shortcuts].every(a => !a.visible)); panel = false
})
test('Virtual safe area preserves physical insets at different resolutions', () => {
 for (const scale of [0.5, 1, 2]) {
  canvas = { width: 1600 * scale, height: 720 * scale, interactableArea: { left: 100 * scale, right: 100 * scale, top: 20 * scale, bottom: 40 * scale } }
  const value = layout.getMobileLayout(); assert.equal(value.width, 1400); assert.equal(value.height, 660); assert.equal(value.left, 100)
 }
})
test('Equipment selection cancels every pending world action', () => {
 selected = 0; panel = false; pressed = down = false
 const equipment = load('systems/nativeEquipment.ts')
 const before = cancelled
 equipment.equipInventorySlot(1)
 assert.equal(selected, 1); assert.equal(cancelled - before, 5)
 gate.mobileUiInputSystem(1)
})
test('Tool picker closes inventory before selecting and rejects empty slots', () => {
 mobile = true; panel = true; selected = 0; pressed = down = false
 const equipment = load('systems/nativeEquipment.ts')
 assert.equal(equipment.equipInventorySlot(1), true)
 assert.equal(panel, false); assert.equal(selected, 1)
 assert.equal(gate.isMobileUiInputBlocked(), true)
 panel = true
 assert.equal(equipment.equipInventorySlot(4), false)
 assert.equal(panel, true); assert.equal(selected, 1)
 panel = false; gate.mobileUiInputSystem(1)
})
test('Release guard does not hide native action buttons and equip shortcuts stay hidden', () => {
 mobile = true; panel = false; selected = 0; pressed = down = false
 const before = controls.resolveMobileControls()
 gate.beginUiTouch()
 const after = controls.resolveMobileControls()
 assert.equal(before.pointer.visible, true); assert.equal(after.pointer.visible, true)
 assert(after.shortcuts.every(action => !action.visible))
 gate.mobileUiInputSystem(1)
})
test('Mobile UI gate leaves desktop fire bindings unaffected', () => {
 mobile = false; gate.beginUiTouch(); pressed = down = true; assert.equal(fire.toolFireJustPressed(), true)
})
test('Custom proximity actions hide duplicate native E/F buttons', () => {
 panel = false; target = 'purifier'; controls.touchControlsSystem(0)
 const native = writes[writes.length - 1].touchInputs
 assert(native.find(x => x.inputAction === ecs.InputAction.IA_PRIMARY).hide)
 assert(native.find(x => x.inputAction === ecs.InputAction.IA_SECONDARY).hide)
})
let openedCook = 0, fueled = 0
mock('ui/cookGrab.ts', { grabCookOutput: () => {} })
mock('ui/cookToggle.ts', { isCookOpen: () => panel, openCookMenu: () => openedCook++ })
mock('ui/storageToggle.ts', { isStorageOpen: () => panel, openStorageMenu: () => {} })
mock('ui/notification.ts', { showNotification: () => {} })
mock('ui/statsBars.ts', { restoreStat: () => {} })
mock('ui/tutorialState.ts', { recordTutorialAction: () => {} })
mock('ui/worldClickGate.ts', { consumeWorldClick: () => {} })
mock('systems/purifierProcess.ts', { addFuelToPurifier: () => { fueled++; return true } })
Object.assign(mocks.get(path.resolve(root, 'ui/inventoryState.ts')), { getCollectedCount: () => 1, subtractCollected: () => {} })
const interact = load('systems/constructionInteract.ts')
test('Custom proximity button rejects stale targets and menus, routes separate actions', () => {
 mobile = true; panel = false; target = 'grill'; components.PlatformConstruction.data.set(20, { child: 10, kind: 'grill' }); components.ActiveCook.data.clear()
 interact.pressProximityAction(21, false); assert.equal(openedCook, 0)
 panel = true; interact.pressProximityAction(20, false); assert.equal(openedCook, 0)
 panel = false; interact.pressProximityAction(20, false); assert.equal(openedCook, 1)
 target = 'purifier'; components.PlatformConstruction.data.set(20, { child: 10, kind: 'purifier' }); components.PurifierState.data.set(20, { freshAmount: 0, fireSec: 0 })
 interact.pressProximityAction(20, true); assert.equal(fueled, 1); assert.equal(openedCook, 1)
 components.PurifierState.data.set(20, { freshAmount: 0, fireSec: 5 })
 interact.pressProximityAction(20, true); assert.equal(fueled, 1)
 target = null; interact.pressProximityAction(20, true); assert.equal(fueled, 1)
})

test('Hammer native controls rotate and publish selected mode icon changes', () => {
 panel = false; target = 'purifier'; builderMode = 'placing'
 let state = controls.resolveMobileControls()
 assert(state.e.visible && state.f.visible && state.shortcuts[0].visible)
 assert.equal(state.e.icon, 'images/hud/rotate-counterclockwise.png')
 assert.equal(state.f.icon, 'images/hud/rotate-clockwise.png')
 assert.equal(state.pointer.icon, 'images/hud/main-action/hud-items-hammer.png')
 assert.equal(state.shortcuts[0].icon, 'images/hud/eraser.png')
 assert.equal(state.shortcuts[1].icon, 'images/hud/eraser.png')
 controls.touchControlsSystem(0)
 assert.equal(writes.at(-1).touchInputs.find(x => x.inputAction === 1).hide, false)
 const before = writes.length
 builderMode = 'destroying'; controls.touchControlsSystem(0)
 assert.equal(writes.length, before + 1)
 state = controls.resolveMobileControls()
 assert(!state.e.visible && !state.f.visible)
 assert.equal(state.shortcuts[0].icon, 'images/hud/items/hammer.png')
 assert.equal(state.shortcuts[1].visible, false)
 assert.equal(state.pointer.icon, 'images/hud/main-action/hud-eraser.png')
 assert(state.shortcuts[0].visible && !state.shortcuts[1].visible)
 assert.equal(writes.at(-1).mainAction, ecs.InputAction.IA_POINTER)
 panel = true
 assert(controls.resolveMobileControls().shortcuts.every(x => !x.visible))
 panel = false; builderMode = 'idle'; target = null
})
test('Building rejects stale proximity actions and structure placement retains rotation', () => {
 target = 'grill'; builderMode = 'placing'; const before = openedCook
 interact.pressProximityAction(20, false); assert.equal(openedCook, before)
 builderMode = 'idle'; constructionMode = 'placing'
 const state = controls.resolveMobileControls()
 assert(state.e.visible && state.f.visible)
 assert(state.shortcuts.every(x => !x.visible))
 interact.pressProximityAction(20, false); assert.equal(openedCook, before)
 constructionMode = 'idle'; target = null
})

test('All tools keep POINTER main and jump secondary; Hands is inert', () => {
 mobile = true; panel = false; target = null; builderMode = 'idle'
 const original = items[0]
 for (const kind of ['hook', 'spear', 'fishingRod', 'cup', 'anchor']) {
   selected = 0; items[0] = { id: kind, heldKind: kind, texture: kind + '.png', hasAction: true }
   controls.touchControlsSystem(0)
   assert.equal(writes.at(-1).mainAction, ecs.InputAction.IA_POINTER)
   assert.equal(writes.at(-1).touchInputs.find(x => x.inputAction === ecs.InputAction.IA_JUMP).hide, false)
   assert.equal(controls.resolveMobileControls().pointer.icon, kind + '.png')
 }
 selected = -1; controls.touchControlsSystem(0)
 assert.equal(controls.resolveMobileControls().pointer.icon, 'images/hud/main-action/hud-hands.png')
 assert.equal(controls.resolveMobileControls().pointer.visible, true)
 pressed = down = true
 assert.equal(fire.toolFireJustPressed(), false); assert.equal(fire.isToolFirePressed(), false)
 pressed = down = false; selected = 0; items[0] = original
})
console.log(`${count} mobile control tests passed`)


