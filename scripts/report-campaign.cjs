const fs = require('node:fs'), assert = require('node:assert/strict')
const code = require('esbuild').buildSync({ stdin: { contents: `export { CRAFTABLE_ITEMS } from './src/ui/craftableItems'; export { requiredChapter } from './src/progression/state';`, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text
const mod = { exports: {} }; new Function('module','exports',code)(mod,mod.exports)
const { CRAFTABLE_ITEMS: recipes, requiredChapter } = mod.exports
const byId = new Map(recipes.map(r=>[r.id,r]))
byId.set('metalPlate',{id:'metalPlate',station:'smelter',cost:[{materialId:'metal',amount:2},{materialId:'wood',amount:2/3}]})
const raw = new Set(['wood','plants','plastic','metal','coal'])
function expand(id,n=1,path=[]) {
  if(raw.has(id)) return {[id]:n}
  assert(!path.includes(id),'Dependency cycle: '+[...path,id].join(' -> '))
  const recipe=byId.get(id);assert(recipe,'Unknown ingredient: '+id)
  const out={};for(const c of recipe.cost) for(const [k,v] of Object.entries(expand(c.materialId,n*c.amount/(recipe.outputCount??1),[...path,id]))) out[k]=(out[k]??0)+v
  return out
}
for(const r of byId.values()) {
  assert(Number.isFinite(requiredChapter(r.id)),'No unlock: '+r.id)
  for(const dependency of [...r.cost.map(c=>c.materialId),...(r.station?[r.station]:[])]) {
    if(raw.has(dependency))continue
    assert(requiredChapter(dependency)<=requiredChapter(r.id),`${r.id} chapter ${requiredChapter(r.id)} needs later ${dependency}`)
  }
  expand(r.id)
}
const paths={
 opening:{hammer:1,cup:1,purifier:1,grill:1,rope:3,wood:8,plastic:6},
 workshop:{workbench:1,smelter:1,storage:1,metalPlate:1},
 zombies:{armoryBench:1,alarmBell:1,spear:1,spikeStrip:2},
 pirates:{engineeringBench:1,ballista:2,bolts:16,ammoCrate:1,sail:1},
 beasts:{researchTable:1,metalPlate:3,wire:2,harpoonTower:2,harpoons:18},
 rescue:{generator:1,antennaMast:1,rescueRadio:1,wood:6,bolts:16,harpoons:10}
}
const stages=Object.entries(paths).map(([chapter,bill])=>{const total={};for(const [id,n] of Object.entries(bill))for(const [k,v]of Object.entries(expand(id,n)))total[k]=(total[k]??0)+v;return{chapter,bill,raw:total}})
const report={note:'Raw costs before rewards; representative optional defense path, excludes extra raft tiles. Fuel includes plate production. Timings require human playtests.',stages,recipes:[...byId.values()].map(r=>({id:r.id,chapter:requiredChapter(r.id),station:r.station??'basic',batch:r.outputCount??1,raw:expand(r.id)}))}
fs.mkdirSync('docs/qa/progression',{recursive:true});fs.writeFileSync('docs/qa/progression/economy.json',JSON.stringify(report,null,2)+'\n')
console.log('PASS dependency graph: '+byId.size+' recipes; no cycles or later-chapter prerequisites')
console.table(stages.map(s=>({chapter:s.chapter,...s.raw})))

const edges = []; for (const r of byId.values()) { for (const c of r.cost) edges.push(`  ${JSON.stringify(c.materialId)} -> ${JSON.stringify(r.id)} [label="${c.amount}"];`); if(r.station) edges.push(`  ${JSON.stringify(r.station)} -> ${JSON.stringify(r.id)} [style=dashed,label="station"];`) }
fs.writeFileSync('docs/qa/progression/dependencies.dot', 'digraph campaign {\n  rankdir=LR;\n' + edges.join('\n') + '\n}\n')
