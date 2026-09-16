const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('node:assert/strict')
// Source-level tests: rendering, ECS storage and external services are mocked.
const root=path.resolve(__dirname,'..'), ts=require(root+'/node_modules/typescript')
const cache=new Map(), mocks=new Map(), results=[]
const key=p=>path.resolve(root,'src',p)
const mock=(p,v)=>mocks.set(key(p),v)
function load(p){
 const filename=path.isAbsolute(p)?p:key(p)
 if(mocks.has(filename))return mocks.get(filename)
 if(cache.has(filename))return cache.get(filename)
 const exports={};cache.set(filename,exports)
 const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 vm.runInNewContext(js,{exports,console,Date,Math,Set,Map,require:name=>{
  if(name==='@dcl/sdk/ecs')return ecs
  if(name==='@dcl/sdk/platform')return {isMobile:()=>true}
  if(name==='@dcl/sdk/math')return require(root+'/node_modules/@dcl/sdk/math')
  if(!name.startsWith('.'))throw Error('Unmocked '+name)
  return load(path.resolve(path.dirname(filename),name)+'.ts')
 }},{filename});return exports
}
function component(){const data=new Map();return {data,getOrNull:e=>data.get(e)??null,getMutable:e=>{if(!data.has(e))throw Error('missing entity');return data.get(e)},get:e=>data.get(e),getMutableOrNull:e=>data.get(e)??null,create:(e,v)=>data.set(e,v),deleteFrom:e=>data.delete(e)}}
let fireHeld=false, fireDown=false, fireUp=false
const PurifierState=component(),PlatformConstruction=component();const ecs={InputAction:{IA_POINTER:0},PointerEventType:{PET_DOWN:0,PET_UP:1},inputSystem:{isPressed:()=>fireHeld,isTriggered:(_,type)=>type===1?fireUp:fireDown},engine:{RootEntity:0,removeEntity:()=>{},getEntitiesWith:function*(...cs){for(const [e]of cs[0].data)if(cs.every(c=>c.data.has(e)))yield[e,...cs.map(c=>c.data.get(e))]}}}
let dead=false, lobby=false, low=0
mock('ui/gameOver.ts',{isGameOver:()=>dead,triggerGameOver:()=>{dead=true}})
mock('ui/winScreen.ts',{isWinActive:()=>false})
mock('ui/craftContext.ts', { recipeMatchesContext: () => true })
mock('expansion/runtime.ts',{hasCraftStation:()=>true,resetExpansion:()=>{}})
mock('factories/heldItem.ts',{setHeldItem:()=>{},setHeldFood:()=>{},setHeldCup:()=>{},setHeldViewmodelHidden:()=>{}})
mock('ui/inventoryToggle.ts',{isInventoryOpen:()=>false,setInventoryOpen:()=>{}})
for (const [file,fn] of [['fishingRod','cancelFishingForEquipmentChange'],['hookThrower','cancelHookCharge'],['anchorThrower','cancelAnchorCharge'],['constructionPlacement','cancelConstructionPreview'],['raftBuilder','cancelRaftPreview']]) mock('systems/'+file+'.ts',{[fn]:()=>{}})
mock('ui/actionButton.ts',{actionButtonJustPressed:()=>false,isActionButtonPressed:()=>false})
mock('ui/notification.ts',{showNotification:()=>{}})
mock('ui/itemReceivedNotification.ts',{notifyItemReceived:()=>{}})
mock('audio/sfx.ts',{playSfx:()=>{}})
const inv=load('ui/inventoryState.ts'), items=load('ui/items.ts'), tutorial=load('ui/tutorialState.ts'),stats=load('ui/statsBars.ts')
mock('ui/storageSession.ts',{getCombinedCount:inv.getCollectedCount,subtractFromAll:inv.subtractCollected})
const craft=load('ui/craftSession.ts'), recipes=load('ui/craftableItems.ts'),bank=load('factories/garbageBank.ts')
function test(name,f){try{f();results.push({name,status:'PASS'})}catch(e){results.push({name,status:'FAIL',error:e.message})}}
function reset(){items.resetInventoryLayout();inv.resetInventoryState();tutorial.restartTutorial();for(const s of ['life','hunger','thirst'])stats.setStat(s,1)}
function slot(id){for(let i=0;i<items.INVENTORY_TOTAL_SLOTS;i++)if(items.getInventorySlot(i)?.id===id)return i;return -1}
reset()
test('Normal starter loadout contains only the hook',()=>{assert.equal(items.getInventorySlot(0).id,'hook');assert.equal(items.serializeInventoryLayout().filter(Boolean).length,1)})
test('Debris collection deposits resources and advances tutorial',()=>{bank.bankGarbageKind('plants');assert.equal(inv.getCollectedCount('plants'),1);assert(tutorial.hasTutorialAction('collect'))})
test('Insufficient materials do not craft or advance tutorial',()=>{assert.equal(craft.startCraft('rope'),false);assert.equal(inv.getCollectedCount('plants'),1);assert.equal(tutorial.hasTutorialAction('rope'),false)})
test('Rope recipe deducts two plants and advances tutorial',()=>{bank.bankGarbageKind('plants');assert(craft.startCraft('rope'));assert.equal(inv.getCollectedCount('plants'),0);assert.equal(inv.getCollectedCount('rope'),1);assert(tutorial.hasTutorialAction('rope'))})
test('Hammer recipe spends materials and creates equippable tool',()=>{inv.addCollected('wood',2);assert(craft.startCraft('hammer'));assert.equal(inv.getCollectedCount('wood'),0);assert.equal(inv.getCollectedCount('rope'),0);assert(slot('hammer')>=0);assert(tutorial.hasTutorialAction('hammer'))})
test('Guide hide/reopen retains earlier progress',()=>{tutorial.dismissTutorial();assert.equal(tutorial.isTutorialEnabled(),false);tutorial.showTutorial();assert(tutorial.hasTutorialAction('hammer'))})
test('Full backpack cannot spend materials on a lost craft output',()=>{
 reset(); inv.addCollected('plants',4);
 while(items.serializeInventoryLayout().filter(Boolean).length<30) inv.addCollected('hammer',1);
 assert.equal(craft.startCraft('rope'),false); assert.equal(inv.getCollectedCount('plants'),4);
 assert.equal(inv.addCollected('metal',1),0); assert.equal(inv.getCollectedCount('metal'),0);
 reset()
})
test('Craft may use the slot freed by its last material',()=>{
 reset(); inv.addCollected('plants',2);
 while(items.serializeInventoryLayout().filter(Boolean).length<30) inv.addCollected('hammer',1);
 assert.equal(craft.startCraft('rope'),true); assert.equal(inv.getCollectedCount('rope'),1); assert.ok(slot('rope')>=0);
 reset()
})
test('Every craft recipe resolves an inventory output and material definitions',()=>{for(const r of recipes.CRAFTABLE_ITEMS){assert(items.getCatalogItem(r.id),r.id);for(const c of r.cost)assert(items.getCatalogItem(c.materialId),c.materialId)}})
test('Crafting cup, filling, drinking and retaining empty cup',()=>{inv.addCollected('wood',1);inv.addCollected('plastic',1);assert(craft.startCraft('cup'));const i=slot('cup');assert(i>=0);assert(inv.transmuteContainerSlot(i,'saltWater'));assert(tutorial.hasTutorialAction('saltWater'));assert(inv.transmuteContainerSlot(i,'freshWater'));assert(tutorial.hasTutorialAction('freshWater'));stats.setStat('thirst',0.5);assert(inv.drinkContainerSlot(i,'freshWater'));assert.equal(stats.getStat('thirst'),0.75);assert.equal(items.getInventorySlot(i).id,'cup');assert(tutorial.hasTutorialAction('drink'))})
test('Salt water reduces thirst and does not complete drink objective',()=>{tutorial.restartTutorial();const i=slot('cup');inv.transmuteContainerSlot(i,'saltWater');stats.setStat('thirst',0.5);assert(inv.drinkContainerSlot(i,'saltWater'));assert.equal(stats.getStat('thirst'),0.25);assert.equal(tutorial.hasTutorialAction('drink'),false)})
test('Eating cooked food restores hunger and advances tutorial',()=>{inv.addCollected('grilled_sardines',1);stats.setStat('hunger',0.5);assert(inv.consumeFoodById('grilled_sardines'));assert.equal(stats.getStat('hunger'),0.62);assert(tutorial.hasTutorialAction('eat'));assert.equal(inv.consumeFoodById('grilled_sardines'),false)})
test('Fresh tutorial reset clears completed objectives',()=>{tutorial.restartTutorial();for(const a of ['collect','rope','hammer','saltWater','freshWater','drink','eat'])assert.equal(tutorial.hasTutorialAction(a),false)})
test('Bonus hunger survives the next survival drain tick',()=>{stats.setStat('hunger',1);stats.restoreStat('hunger',0,0.2);stats.adjustStat('hunger',-0.001);assert(Math.abs(stats.getStat('hunger')-1.199)<1e-9,'bonus reserve was discarded: '+stats.getStat('hunger'))})
mock('components.ts',{PurifierState,PlatformConstruction})
mock('factories/construction.ts',{setPurifierHoverPrompt:()=>{}})
mock('factories/cookingSprites.ts',{createFlameSprite:()=>999})
const purifier=load('systems/purifierProcess.ts')
function fillState(fireSec){PurifierState.create(1,{fireSec,saltAmount:1,freshAmount:0,flameSprite:0});PlatformConstruction.create(1,{child:2});return PurifierState.getMutable(1)}
test('Purifier converts water while fueled and stops when empty',()=>{const s=fillState(30);purifier.purifierProcessSystem(15);assert.equal(s.saltAmount,0);assert.equal(s.freshAmount,1);assert.equal(s.fireSec,15)})
test('Purifier does not convert water without fuel',()=>{const s=fillState(0);purifier.purifierProcessSystem(15);assert.equal(s.freshAmount,0)})
test('Purifier lag spike cannot convert more than remaining fuel permits',()=>{const s=fillState(0.1);purifier.purifierProcessSystem(1);assert(s.freshAmount<=0.1/15+1e-9,'converted '+s.freshAmount+' with only 0.1 seconds fuel')})

const cookRecipes=load('ui/cookableItems.ts'), cells=load('ui/cookSlots.ts')
test('All cooking recipes match regardless of ingredient order and have valid outputs',()=>{for(const r of cookRecipes.COOKABLE_ITEMS){assert(items.getCatalogItem(r.id),r.id);assert.equal(cookRecipes.matchCookRecipe(r.ingredients.map(x=>x.itemId).reverse()).id,r.id)}})
test('Cooking rejects an unrecognized ingredient combination',()=>{assert.equal(cookRecipes.matchCookRecipe(['metal','plastic']),null)})
const ActiveCook=component();mocks.get(key('components.ts')).ActiveCook=ActiveCook;mocks.get(key('components.ts')).CookStatus={Cooking:0,Ready:1,Burned:2}
mocks.get(key('factories/construction.ts')).setConstructionPointerPrompt=()=>{}
mocks.get(key('factories/cookingSprites.ts')).createIngredientSprites=()=>[]
mock('ui/cookToggle.ts',{closeCookMenu:()=>{}})
const cooking=load('ui/cookSession.ts')
test('Cooking menu preview does not spend ingredients',()=>{reset();cells.clearCookSlots();inv.addCollected('sardines',2);inv.addCollected('wood',1);assert(cells.pickIngredient('sardines'));assert(cells.placeInInputCell(0));assert.equal(inv.getCollectedCount('sardines'),2);assert.equal(cells.getMatchingRecipe().id,'grilled_sardines')})
test('Cooking requires fuel and a valid grill',()=>{cooking.setActiveCookGrill(10);PlatformConstruction.create(10,{child:11,yawDeg:0});assert.equal(cooking.canStartCook(),false);assert(cells.pickIngredient('wood'));assert(cells.placeInFuelCell());assert(cooking.canStartCook())})
test('Starting cooking consumes exact recipe quantities and prevents double cooking',()=>{const r=cells.getMatchingRecipe();assert(cooking.startCook());assert.equal(inv.getCollectedCount('wood'),0);assert.equal(inv.getCollectedCount('sardines'),2-r.ingredients[0].amount);assert(ActiveCook.getOrNull(10));assert.equal(cooking.startCook(),false)})

mock('ui/startupGate.ts',{isStartupGateActive:()=>lobby})
mock('systems/eventScheduler.ts',{notifyHungerCrossedLow:()=>{low++}})
const survival=load('systems/survivalDrain.ts')
test('Survival freezes during lobby and death',()=>{stats.setStat('hunger',0.5);lobby=true;survival.survivalDrainSystem(10);assert.equal(stats.getStat('hunger'),0.5);lobby=false;dead=true;survival.survivalDrainSystem(10);assert.equal(stats.getStat('hunger'),0.5);dead=false})
test('Normal survival drains vitals and triggers game over at zero life',()=>{stats.setStat('hunger',0);stats.setStat('thirst',0);stats.setStat('life',0.001);survival.survivalDrainSystem(1);assert(dead);assert.equal(stats.getStat('life'),0)})
test('Materials and equipment share all 30 inventory slots',()=>{
 reset();inv.addCollected('wood',2);inv.addCollected('hammer',1)
 assert.equal(slot('wood'),1);assert.equal(slot('hammer'),2)
 for(let i=3;i<30;i++)inv.addCollected('hammer',1)
 assert.equal(items.serializeInventoryLayout().filter(Boolean).length,30)
 assert.equal(items.ensureCollectibleSlot('cup'),-1)
 items.clearInventorySlot(29);inv.addCollected('cup',1)
 assert.equal(slot('cup'),29);assert.equal(items.serializeInventoryLayout().length,30)
})
test('Equipment picker includes slot 29 and excludes materials',()=>{
 inv.selectSlot(29);assert.equal(inv.getSelectedSlot(),29)
 assert(inv.getEquippableSlots().includes(29));assert(!inv.getEquippableSlots().includes(1))
 inv.hydrateSelectedSlot(28);assert.equal(inv.serializeSelectedSlot(),28)
})
test('Reordering a tool preserves equipped identity and durability',()=>{
 reset();inv.consumeSlotDurability(0);const durability=items.getSlotDurability(0)
 const drag=load('ui/inventoryDrag.ts');drag.pressSlot(0);drag.pressSlot(29)
 assert.equal(inv.getSelectedSlot(),29);assert.equal(items.getInventorySlot(29).id,'hook')
 assert.equal(items.getSlotDurability(29),durability);assert.equal(items.getInventorySlot(0),null)
})
test('Hands unequips without consuming a backpack slot and can re-equip',()=>{
 reset(); const before=JSON.stringify(items.serializeInventoryLayout()); const durability=items.getSlotDurability(0)
 inv.selectSlot(inv.HANDS_SLOT)
 assert.equal(inv.getSelectedSlot(),-1);assert.equal(inv.getSlotKind(-1),null);assert.equal(inv.getSlotHasAction(-1),false)
 assert.equal(JSON.stringify(items.serializeInventoryLayout()),before)
 assert.equal(inv.getBottomBarSelectedLabel(),'Hands')
 inv.hydrateSelectedSlot(-1);assert.equal(inv.serializeSelectedSlot(),-1)
 inv.selectSlot(0);assert.equal(inv.getSelectedSlot(),0);assert.equal(items.getSlotDurability(0),durability)
})

test('Only eating cooked food completes the campaign meal milestone',()=>{
 reset();const progress=load('progression/state.ts');progress.resetProgress('campaign')
 inv.addCollected('potato',1);inv.consumeFoodById('potato');assert(!progress.hasProgress('cookedMeal'))
 inv.addCollected('roasted_potato',1);inv.consumeFoodById('roasted_potato');assert(progress.hasProgress('cookedMeal'))
 tutorial.dismissTutorial();assert(progress.hasProgress('cookedMeal'));progress.resetProgress('sandbox')
})
test('Ammo batches check the entire output cap before spending',()=>{
 reset();const cap=items.getCatalogItem('arrows').maxStackSize
 inv.addCollected('arrows',cap-3);inv.addCollected('wood',10);inv.addCollected('metal',10)
 assert(!craft.startCraft('arrows'));assert.equal(inv.getCollectedCount('wood'),10)
 inv.subtractCollected('arrows',1);assert(craft.startCraft('arrows'));assert.equal(inv.getCollectedCount('arrows'),cap)
})
test('Crafting equipment immediately equips it; resources and ammo keep that selection',()=>{
 reset();inv.addCollected('wood',20);inv.addCollected('plants',10);inv.addCollected('metal',10);assert(craft.startCraft('rope'));assert(craft.startCraft('hammer'));assert.equal(items.getInventorySlot(inv.getSelectedSlot()).id,'hammer');
 assert(craft.startCraft('rope'));assert.equal(items.getInventorySlot(inv.getSelectedSlot()).id,'hammer');assert(craft.startCraft('arrows'));assert.equal(items.getInventorySlot(inv.getSelectedSlot()).id,'hammer');
 inv.addCollected('plastic',4);assert(craft.startCraft('cup'));assert.equal(items.getInventorySlot(inv.getSelectedSlot()).id,'cup');
})
test('Consuming the final placed item cannot pass its press to the fallback hook',()=>{
 reset();const gate=load('ui/mobileControlsState.ts'),fire=load('systems/toolFire.ts');
 inv.addCollected('purifier',1);inv.selectSlot(slot('purifier'));fireHeld=fireDown=fireUp=false;gate.mobileUiInputSystem(1);
 fireHeld=fireDown=true;assert(fire.toolFireJustPressed());inv.subtractCollected('purifier',1);assert.equal(items.getInventorySlot(inv.getSelectedSlot()).id,'hook');assert(!fire.toolFireJustPressed(),'same-frame placement press leaked');
 fireDown=false;gate.mobileUiInputSystem(2);assert(gate.isEquipmentInputBlocked(),'held press must remain blocked beyond cooldown');
 fireHeld=false;fireUp=true;gate.mobileUiInputSystem(.01);fireUp=false;fireHeld=fireDown=true;assert(fire.toolFireJustPressed());fireHeld=fireDown=false;gate.mobileUiInputSystem(1);
})
for(const r of results)console.log(r.status+' '+r.name+(r.error?' — '+r.error:''))

process.exitCode=results.some(result=>result.status==='FAIL')?1:0
