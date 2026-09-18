const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
let nearby = null, builder = 'idle', placement = 'idle', pressed = false, bite = false
const state = { pointer: { visible: true, icon: 'hook.png', label: 'Cast' }, e: { visible: true, icon: 'e.png' }, f: { visible: true, icon: 'f.png' }, shortcuts: [{ visible: false, icon: 'erase.png' }] }
const actions = { IA_POINTER: 0, IA_PRIMARY: 1, IA_SECONDARY: 2, IA_ACTION_3: 3, IA_ACTION_6: 6, IA_JUMP: 7 }
const createElement = (type, props, ...children) => typeof type === 'function' ? type(props) : ({ type, props: props || {}, children: children.flat().filter(Boolean) })
const mocks = {
  '@dcl/sdk/react-ecs': { default: { createElement }, UiEntity: 'entity', Label: 'label' },
  '@dcl/sdk/ecs': { InputAction: actions, inputSystem: { isPressed: () => pressed } },
  '@dcl/sdk/math': { Color4: { create: (...v) => v } },
  '../../systems/touchControls': { resolveMobileControls: () => state },
  '../../systems/lookAtTarget': { getProximityConstruction: () => nearby },
  '../../systems/raftBuilder': { getRaftBuilderMode: () => builder },
  '../../systems/constructionPlacement': { getConstructionPlacementMode: () => placement },
  '../../systems/fishingRod': { isFishingBiting: () => bite, getFishingBiteIntensity: () => 1 },
  '../mobileLayout': { getMobileLayout: () => ({ right: 20, bottom: 12 }) },
  '../mobileToolInput': { MOBILE_TOOL_ACTION: 6 },
  '../theme': { ACTION_BUTTON_TEXTURE: 'rest.png', ACTION_BUTTON_TEXTURE_PRESSED: 'pressed.png' }
}
const feedback = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/ui/touchButtonFeedback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: feedback, require: () => ({ InputAction: actions, PointerEventType: { PET_UP: 1 }, inputSystem: { isPressed: () => pressed, isTriggered: () => false } }) })
mocks['../touchButtonFeedback'] = feedback
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/ui/components/MobileActionControls.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'ReactEcs.createElement' }
}).outputText, { exports: exportsObject, require: name => { assert(name in mocks, name); return mocks[name] } })
const render = exportsObject.MobileActionControls
const bindings = tree => tree.children.filter(n => n.props.uiInputBinding)
const bound = tree => bindings(tree).map(n => n.props.uiInputBinding.actions[0])
let tree = render()
assert.deepEqual(bound(tree), [6, 7, 1, 2])
assert.equal(tree.props.uiTransform.position.right, 40)
assert.equal(tree.props.uiTransform.position.bottom, 36)
const jumpPosition = JSON.stringify(bindings(tree).find(n => n.props.uiInputBinding.actions[0] === 7).props.uiTransform.position)
nearby = { platform: 1 }; assert.deepEqual(bound(render()), [6, 7])
builder = 'placing'; state.shortcuts[0].visible = true
assert.deepEqual(bound(render()), [6, 7, 3, 1, 2])
assert.equal(JSON.stringify(bindings(render()).find(n => n.props.uiInputBinding.actions[0] === 7).props.uiTransform.position), jumpPosition)
state.pointer.icon = 'eraser.png'
assert.equal(bindings(render())[0].children[0].props.uiBackground.texture.src, 'eraser.png')
const hitArea = JSON.stringify(bindings(render())[0].props.uiTransform)
pressed = true;
assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/rest.png', 'unrelated UI/global pointer does not highlight main action')
bindings(render())[0].props.onMouseDown()
assert.equal(JSON.stringify(bindings(render())[0].props.uiTransform), hitArea)
 assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/pressed.png')
bindings(render())[0].props.onMouseLeave()
assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/rest.png')
bindings(render())[0].props.onMouseDown()
bindings(render())[0].props.onMouseUp()
assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/rest.png')
bindings(render())[0].props.onMouseDown()
feedback.clearTouchFeedback()
assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/rest.png')
pressed = false; bite = true; assert.equal(bindings(render())[0].props.uiBackground.texture.src, 'images/hud/controls/pressed.png')
state.pointer.visible = false; assert.equal(render(), null)
console.log('PASS custom input bindings, native jump binding, safe insets, fixed jump position, proximity deduplication, hammer controls, equipment icon, pressed/bite feedback and hidden-state removal')

// Exercise the actual picker layout at short, full-height and overflowing sizes.
let toolCount = 2, safeHeight = 720
Object.assign(mocks, {
  '../../systems/nativeEquipment': { equipInventorySlot: () => {} },
  '../inventoryState': { HANDS_SLOT: -1, getEquippableSlots: () => Array.from({length: toolCount}, (_, i) => i), getSelectedSlot: () => 0, isSlotSelectable: () => true },
  '../items': { getInventorySlot: () => ({texture: 'tool.png'}), getItemDisplayName: () => 'Tool' },
  '../mobileControlsState': { beginUiTouch: () => {} },
  '../mobileLayout': { getMobileLayout: () => ({height: safeHeight}) },
  '../panel': { Panel: 'panel' },
  '../theme': { HANDS_ICON: 'hands.png' },
  '../visualTheme': {},
  './MenuList': { MenuList: 'list' }
})
const picker = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/ui/components/ToolPicker.tsx', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, jsxFactory: 'ReactEcs.createElement' }
}).outputText, { exports: picker, require: name => { assert(name in mocks, name); return mocks[name] } })
const panel = () => picker.ToolPicker().children[0]
assert.equal(panel().props.uiTransform.height, 3 * 54 + 16)
toolCount = 8
assert.equal(panel().props.uiTransform.height, 9 * 54 + 16, 'nine entries fit without the old cap')
assert.equal(panel().children[0].props.height, 9 * 54)
toolCount = 30
assert.equal(panel().props.uiTransform.height, 580)
assert.equal(panel().children[0].props.height, 564)
safeHeight = 520
assert.equal(panel().props.uiTransform.height, 380)
console.log('PASS tool picker fits contents, expands beyond old cap and respects shorter safe areas')

