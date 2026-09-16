const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
const code = require('esbuild').buildSync({stdin:{contents:`export * from './src/progression/state'; export * from './src/progression/config'; export { advanceProduction } from './src/expansion/rules'`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text
const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);const p=mod.exports
let passed=0
function test(name,fn){p.resetProgress('campaign');fn();passed++;console.log('PASS '+name)}
const home=()=>['expand','drink','cookedMeal'].forEach(p.recordProgress)
test('Milestones accept out-of-order events and tutorial-independent progress',()=>{p.recordProgress('cookedMeal');p.recordProgress('drink');assert.equal(p.chapter(),1);p.recordProgress('expand');assert.equal(p.chapter(),2);assert(p.recipeUnlocked('workbench'));assert(!p.recipeUnlocked('armoryBench'))})
test('The recipe spine opens the counter before each threat',()=>{home();p.recordProgress('plate');assert(p.recipeUnlocked('bow'));assert(!p.recipeUnlocked('ballista'));p.completeStoryRaid();assert(p.recipeUnlocked('ballista'));assert(!p.recipeUnlocked('harpoonTower'));p.completeStoryRaid();assert(p.recipeUnlocked('harpoonTower'));assert(p.raidGate(true));p.completeStoryRaid();assert.equal(p.raidGate(true),null);assert(!p.recipeUnlocked('transmitterCore'),'core must be claimable, not craftable')})
test('Ambient attacks defer through intro, recovery and finale',()=>{assert(!p.ambientAllowed());home();p.recordProgress('plate');assert(!p.ambientAllowed());p.tickProgress(75);assert(p.ambientAllowed());assert.equal(p.raidGate(),null);p.recordProgress('finaleStarted');assert(!p.ambientAllowed())})
test('Rewards retain unclaimed capacity and cannot be claimed twice',()=>{p.queueReward('wood',12);let received=0;p.claimRewards((_,n)=>{received+=5;return 5});assert.equal(p.pendingRewards().wood,7);p.claimRewards((_,n)=>{received+=n;return n});p.claimRewards(()=>{throw Error('duplicate reward')});assert.equal(received,12)})
test('Campaign serialization is deep and preserves unlocks/rewards',()=>{home();p.queueReward('wood',8);const snapshot=p.serializeProgress();snapshot.pending.wood=3;assert.equal(p.pendingRewards().wood,8);p.resetProgress('campaign');p.hydrateProgress(snapshot);assert.equal(p.chapter(),2);assert.equal(p.pendingRewards().wood,3);snapshot.events.length=0;assert.equal(p.chapter(),2)})
test('Malformed progression cannot poison clocks or rewards',()=>{const good=p.serializeProgress();for(const bad of [{...good,seconds:NaN},{...good,pending:{wood:-1}},{...good,mode:'oops'},{...good,events:[{}]}])p.hydrateProgress(bad);assert.deepEqual(p.serializeProgress(),good)})
test('Seeded salvage and geometry randomness repeat exactly',()=>{p.resetProgress('progression-test');const a=Array.from({length:30},()=>[p.nextSalvage(),p.campaignRandom()]);p.resetProgress('progression-test');assert.deepEqual(Array.from({length:30},()=>[p.nextSalvage(),p.campaignRandom()]),a);for(const id of ['wood','metal','plants','plastic','barrel'])assert(a.slice(0,10).some(x=>x[0]===id))})
test('Production respects queue count, total fuel and remainder',()=>{const s={progress:0,stock:0,fuel:90,queued:5,active:true,installed:false};p.advanceProduction('smelter',s,60,false);p.advanceProduction('smelter',s,60,false);assert.equal(s.stock,4);assert.equal(s.queued,1);assert.equal(s.progress,10);assert.equal(s.fuel,0);s.fuel=30;p.advanceProduction('smelter',s,100,false);assert.equal(s.stock,5);assert.equal(s.fuel,20);assert.equal(s.active,false)})
test('Chapter checkpoint restores, never merges, and can be retried repeatedly',()=>{
 let world={inventory:{wood:5},raft:[{health:50}],progression:p.serializeProgress()}
 const out={};const js=ts.transpileModule(fs.readFileSync('src/progression/checkpoint.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 vm.runInNewContext(js,{exports:out,require:name=>name.includes('saveSchema')?{buildSaveBlob:()=>world,applySaveBlob:b=>{world=b}}:name.includes('platform')?{GRID_ORIGIN:{x:1,y:4,z:1}}:{isSandbox:()=>false,serializeProgress:p.serializeProgress,metric:p.metric}})
 out.captureCheckpoint();world.inventory.wood=99;world.raft[0].health=0;assert(out.restoreCheckpoint());assert.equal(world.inventory.wood,5);assert.equal(world.raft[0].health,50);world.inventory.wood=0;out.restoreCheckpoint();assert.equal(world.inventory.wood,5);out.clearCheckpoint();assert(!out.restoreCheckpoint())
})
test('Tutorial reveals recipes by successful actions and keeps recovery supplies available',()=>{
 assert(p.recipeUnlocked('rope')); assert(p.recipeUnlocked('hook')); assert(!p.recipeUnlocked('hammer')); assert(!p.recipeUnlocked('purifier'));
 p.recordProgress('collect'); assert.equal(p.guidedRecipe(),null); p.recordProgress('inventory'); assert.equal(p.guidedRecipe(),'rope'); p.recordProgress('rope'); assert(p.recipeUnlocked('hammer')); assert.equal(p.guidedRecipe(),'hammer');
 p.recordProgress('hammer'); p.recordProgress('expand'); assert(p.recipeUnlocked('purifier')); assert(p.recipeUnlocked('cup')); assert(!p.recipeUnlocked('grill'));
 p.recordProgress('purifier'); assert.equal(p.guidedRecipe(),'cup'); p.recordProgress('crafted:cup'); assert.equal(p.guidedRecipe(),null);
 p.recordProgress('saltWater');p.recordProgress('drink'); assert(p.recipeUnlocked('grill'));
})
test('Skipping unlocks investigation recipes, persists through restore, and preserves story gates',()=>{
 p.skipInvestigation(); for(const id of ['hammer','workbench','ballista','rescueRadio']) assert(p.recipeUnlocked(id),id);
 assert(!p.recipeUnlocked('bandage'));assert(!p.recipeUnlocked('repairKit'));assert(!p.recipeUnlocked('transmitterCore'));assert(!p.recipeUnlocked('unknown'));
 assert.equal(p.guidedRecipe(),null);assert(p.raidGate(true)); const snapshot=p.serializeProgress();p.resetProgress('campaign');assert(!p.recipeUnlocked('rescueRadio'));p.hydrateProgress(snapshot);assert(p.recipeUnlocked('rescueRadio'));
})
test('Starting with tutorial disabled unlocks all normal recipes immediately',()=>{
 const out={};const js=ts.transpileModule(fs.readFileSync('src/progression/state.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(js,{exports:out,require:name=>name.includes('gameConfig')?{DEBUG_MODE:false,TUTORIAL_ENABLED:false}:p});
 assert(out.investigationBypassed());assert(out.recipeUnlocked('rescueRadio'));assert(!out.recipeUnlocked('transmitterCore'));assert.equal(out.guidedRecipe(),null);
})
test('Skip and reopen consume UI touches, keep unlocks, and restore the skipped guide state',()=>{
 let touches=0;const out={};const js=ts.transpileModule(fs.readFileSync('src/ui/tutorialState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(js,{exports:out,require:name=>name.includes('gameConfig')?{TUTORIAL_ENABLED:true}:name.includes('mobileControlsState')?{beginUiTouch:()=>touches++}:p});
 out.dismissTutorial();assert.equal(touches,1);assert(!out.isTutorialEnabled());assert(p.recipeUnlocked('rescueRadio'));
 out.showTutorial();assert.equal(touches,2);assert(out.isTutorialEnabled());assert(p.recipeUnlocked('rescueRadio'));
 out.hydrateTutorial([]);assert(!out.isTutorialEnabled());p.resetProgress('campaign');out.restartTutorial();assert(out.isTutorialEnabled());assert(!p.recipeUnlocked('rescueRadio'));
 out.finishTutorial();assert(!out.isTutorialEnabled());assert(!p.recipeUnlocked('rescueRadio'),'finishing guidance must retain investigation');
})
test('Craft opening pulse settles, remains finite, and restarts on a new opening',()=>{
 const out={};let station=null,touches=0;const js=ts.transpileModule(fs.readFileSync('src/ui/craftToggle.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(js,{exports:out,require:name=>name.includes('craftContext')?{setCraftStation:s=>station=s,getCraftStation:()=>station,isCraftStationAvailable:()=>true}:name.includes('mobileControlsState')?{beginUiTouch:()=>touches++}:name.includes('craftableItems')?{CRAFTABLE_ITEMS:[]}:name.includes('storageToggle')?{isStorageOpen:()=>false}:{setInventoryOpen:()=>{},setCookOpen:()=>{},setSystemMenuOpen:()=>{},playSfx:()=>{}}});
 out.setCraftOpen(true);assert.equal(out.craftGuidePulse(),1);const revision=out.craftOpenRevision();out.craftToggleResetSystem(2);assert.equal(out.craftGuidePulse(),0);
 out.setCraftOpen(false);out.setCraftOpen(true);assert.equal(out.craftGuidePulse(),1);assert.equal(out.craftOpenRevision(),revision+1);assert.equal(touches,3);
})
console.log(`${passed} progression tests passed`)
