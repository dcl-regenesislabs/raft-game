const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
function load(file, mocks = {}) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(root, file)], bundle: true, write: false,
    platform: 'node', format: 'cjs', external: Object.keys(mocks)
  })
  const module = { exports: {} }
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, console })
  return module.exports
}
const i18n = load('src/i18n/index.ts')
const { messages } = load('src/i18n/catalog.ts')
const { t, setLanguagePreference, setDetectedLocale, getLanguage, normalizeLanguage } = i18n
const keys = new Set()
const placeholders = text => [...text.matchAll(/\{\d+\}/g)].map(m => m[0]).sort().join(',')
for (const [en, es, pt] of messages) {
  assert.ok(en && es && pt, 'Every message needs both translations')
  assert.ok(!keys.has(en), `Duplicate key: ${en}`)
  keys.add(en)
  assert.equal(placeholders(es), placeholders(en), `Spanish placeholders: ${en}`)
  assert.equal(placeholders(pt), placeholders(en), `Portuguese placeholders: ${en}`)
  for (const [lang, translation] of [['es', es], ['pt', pt]]) {
    setLanguagePreference(lang)
    assert.equal(t(en), translation, `Catalog rendering (${lang}): ${en}`)
  }
  setLanguagePreference('en')
  assert.equal(t(en), en)
}
assert.equal(normalizeLanguage(' es-AR '), 'es')
assert.equal(normalizeLanguage('pt_BR'), 'pt')
assert.equal(normalizeLanguage('PT-PT'), 'pt')
for (const value of [null, undefined, 1, {}, '', 'fr', 'english']) assert.equal(normalizeLanguage(value), 'en')
setDetectedLocale('es-MX')
setLanguagePreference('default')
assert.equal(t('SETTINGS'), 'AJUSTES')
setDetectedLocale('pt-BR')
assert.equal(t('SETTINGS'), 'CONFIGURAÇÕES')
setLanguagePreference('es')
setDetectedLocale('en-US')
assert.equal(getLanguage(), 'es', 'Explicit preference wins over Explorer changes')
setLanguagePreference('default')
assert.equal(getLanguage(), 'en', 'DEFAULT restores the most recent detected language')
setLanguagePreference('pt')
assert.equal(t('Load arrows (3/20)'), 'Carregar flechas (3/20)')
assert.equal(t('Need 2 Metal Plate'), 'Precisa de 2 Chapa de metal')
assert.equal(t('Need 2 metalPlate'), 'Precisa de 2 Chapa de metal')
assert.equal(t('shark_meat'), 'carne de tubarão')
assert.equal(t('RAID 2 · 3 enemies remaining'), 'INVASÃO 2 · 3 inimigos restantes')
assert.equal(t('Metal Hook broke!'), 'Gancho de metal quebrou!')
assert.equal(t('Wood ×5 · Backpack'), 'Madeira ×5 · Mochila')
assert.equal(t('#1  0x123456  00:35'), '#1  0x123456  00:35')
assert.equal(t('Unrecognized server diagnostic'), 'Unrecognized server diagnostic')
assert.equal(t('Drink purified water 45%'), 'Beber água purificada 45%')
setLanguagePreference('es')
assert.equal(t('Your hook starts equipped. Aim at debris, hold left-click, then release to cast. Use the bottom bar to change tools. Press E to grab nearby supplies.'),
  'Empiezas con el gancho equipado. Apunta a los restos, mantén pulsado el clic izquierdo y suelta para lanzar. Usa la barra inferior para cambiar herramientas. Pulsa E para recoger suministros cercanos.')

// Audit content catalogs and literal UI text so new copy cannot silently skip translation.
const foldedKeys = new Set([...keys].map(key => key.toLowerCase()))
function messageOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span, i) => `{${i}}` + span.literal.text).join('')
  return null
}
function covered(node, filename) {
  const text = messageOf(node)
  if (!text || !/[a-zA-Z]{2}/.test(text)) return
  assert.ok(foldedKeys.has(text.toLowerCase()), `Missing catalog entry in ${filename}: ${text}`)
}
const contentFiles = ['src/ui/craftableItems.ts', 'src/ui/cookableItems.ts', 'src/ui/craftCategories.ts', 'src/expansion/catalog.ts', 'src/ui/components/Tutorial.tsx']
for (const filename of contentFiles) {
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), 'utf8'), ts.ScriptTarget.Latest, true)
  function walk(node) {
    if (ts.isPropertyAssignment(node) && ['name', 'description', 'title', 'text', 'label'].includes(node.name.getText(source))) covered(node.initializer, filename)
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'item') {
      covered(node.arguments[1], filename)
      covered(node.arguments[4], filename)
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
}
for (const filename of fs.readdirSync(path.join(root, 'src/ui/components')).filter(name => name.endsWith('.tsx') && name !== 'LanguageSettings.tsx')) {
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, 'src/ui/components', filename), 'utf8'), ts.ScriptTarget.Latest, true)
  function walk(node) {
    if (ts.isJsxAttribute(node) && ['label', 'value'].includes(node.name.text) && node.initializer) covered(node.initializer, filename)
    if (ts.isCallExpression(node) && node.expression.getText(source) === 't') covered(node.arguments[0], filename)
    ts.forEachChild(node, walk)
  }
  walk(source)
}
const chefSource = ts.createSourceFile('chefDialog.ts', fs.readFileSync(path.join(root, 'src/systems/chefDialog.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
function checkDialogue(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(chefSource).endsWith('_DIALOG_LINES')) {
    function lines(n) {
      if (ts.isStringLiteral(n) && n.text.trim()) {
        covered(n, 'chefDialog.ts')
        for (const lang of ['es', 'pt']) {
          setLanguagePreference(lang)
          assert.ok(t(n.text).length <= 32, `Dialogue overflow (${lang}): ${t(n.text)}`)
        }
      }
      ts.forEachChild(n, lines)
    }
    lines(node.initializer)
  }
  ts.forEachChild(node, checkDialogue)
}
checkDialogue(chefSource)

// The actual selector consumes touch input and switches an already-open view.
let touches = 0
const react = {
  createElement: (type, props, ...children) => ({ type, props, children: children.flat(Infinity) })
}
const { LanguageSettings } = load('src/ui/components/LanguageSettings.tsx', {
  '../../i18n/index': i18n,
  '../mobileControlsState': { beginUiTouch: () => { touches++ } },
  '../visualTheme': { UI_ACCENT: 'selected', UI_CELL: 'normal', UI_INK: 'ink', UI_MUTED: 'muted' },
  '@dcl/sdk/react-ecs': { __esModule: true, default: react, Label: 'Label', UiEntity: 'UiEntity' }
})
setLanguagePreference('default')
setDetectedLocale('en')
let selector = LanguageSettings()
assert.equal(selector.children[0].props.value, 'LANGUAGE')
const choices = selector.children[1].children
assert.equal(choices.length, 4)
assert.equal(choices.map(choice => choice.props.key).join(','), 'default,en,es,pt')
choices[2].props.onMouseDown()
choices[2].props.onMouseUp()
assert.equal(touches, 1)
assert.equal(getLanguage(), 'es')
selector = LanguageSettings()
assert.equal(selector.children[0].props.value, 'IDIOMA')
assert.equal(selector.children[1].children[2].props.uiBackground.color, 'selected')
choices[3].props.onMouseUp()
assert.equal(t('SETTINGS'), 'CONFIGURAÇÕES')
choices[1].props.onMouseUp()
assert.equal(t('SETTINGS'), 'SETTINGS')
setDetectedLocale('pt-BR')
choices[0].props.onMouseUp()
assert.equal(t('SETTINGS'), 'CONFIGURAÇÕES')

async function testRuntime() {
  const text = new Map([[1, { text: 'SETTINGS' }], [2, { text: '#1  0x123  00:35' }]])
  const pointers = new Map([[3, { pointerEvents: [{ eventInfo: { hoverText: 'Load arrows (3/20)' } }] }]])
  const TextShape = { getMutable: id => text.get(id) }
  const PointerEvents = { getMutable: id => pointers.get(id) }
  const tasks = []
  let locale = 'es-AR', fail = false, registered = 0, polls = 0
  const runtime = load('src/i18n/runtime.ts', {
    './index': i18n,
    '@dcl/sdk/ecs': {
      TextShape, PointerEvents,
      engine: {
        getEntitiesWith: component => (component === TextShape ? text : pointers).entries(),
        addSystem: (system, priority) => { registered++; assert.ok(priority < 0, 'Localization follows gameplay writers') }
      },
      executeTask: task => tasks.push(task())
    },
    '~system/Runtime': { getExplorerInformation: async () => {
      polls++
      if (fail) throw Error('Old Explorer')
      return { configurations: { locale } }
    } }
  })
  setLanguagePreference('default')
  runtime.initLanguage()
  runtime.initLanguage()
  await Promise.all(tasks.splice(0))
  runtime.languageSystem(0)
  assert.equal(registered, 1)
  assert.equal(polls, 1)
  assert.equal(text.get(1).text, 'AJUSTES')
  assert.equal(pointers.get(3).pointerEvents[0].eventInfo.hoverText, 'Cargar flechas (3/20)')
  setLanguagePreference('pt')
  runtime.languageSystem(0)
  assert.equal(text.get(1).text, 'CONFIGURAÇÕES', 'Existing world labels switch without recreation')
  text.get(1).text = 'Load arrows (4/20)'
  runtime.languageSystem(0)
  assert.equal(text.get(1).text, 'Carregar flechas (4/20)', 'Gameplay rewrites are translated')
  locale = 'en-US'
  runtime.languageSystem(2)
  await Promise.all(tasks.splice(0))
  assert.equal(getLanguage(), 'pt')
  setLanguagePreference('default')
  runtime.languageSystem(0)
  assert.equal(text.get(1).text, 'Load arrows (4/20)', 'English restores original world text')
  fail = true
  runtime.languageSystem(2)
  await Promise.all(tasks.splice(0))
  assert.equal(getLanguage(), 'en')
  text.delete(1)
  pointers.delete(3)
  runtime.languageSystem(0)
  text.set(1, { text: 'GRILL' })
  setLanguagePreference('es')
  runtime.languageSystem(0)
  assert.equal(text.get(1).text, 'PARRILLA', 'Destroyed entities do not retain old messages')
  assert.equal(text.get(2).text, '#1  0x123  00:35', 'Rankings stay intact')
}
testRuntime().then(() => console.log(`PASS language detection, overrides, live world text, coverage and ${messages.length} bilingual messages`)).catch(error => { console.error(error); process.exitCode = 1 })
