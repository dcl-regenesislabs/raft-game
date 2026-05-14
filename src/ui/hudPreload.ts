// Pre-warms the renderer's asset cache for every HUD/UI texture used
// by the scene, so opening the inventory / craft / cook panels for the
// first time doesn't trigger visible pop-in.
//
// Strategy: list every texture path on a single AssetLoad component
// at scene boot. The runtime fetches each in the background while the
// startup gate is up; by the time the player presses WORLD the cache
// is warm. The component is left in place for the rest of the session
// so the renderer keeps the assets resident.

import { AssetLoad, engine } from '@dcl/sdk/ecs'

const HUD_PRELOAD_ASSETS: readonly string[] = [
  // Splash
  'images/raft_game_logo.png',

  // HUD chrome
  'images/hud/backpack.png',
  'images/hud/bottom-bar.png',
  'images/hud/button.png',
  'images/hud/close_button.png',
  'images/hud/cook_layout.png',
  'images/hud/inventory.png',
  'images/hud/panel_v2.png',
  'images/hud/red_button.png',
  'images/hud/saw.png',
  'images/hud/selected-button.png',

  // HUD icons
  'images/hud/icons/bar_container.png',
  'images/hud/icons/hungry.png',
  'images/hud/icons/hungry_sweep.png',
  'images/hud/icons/life.png',
  'images/hud/icons/life_sweep.png',
  'images/hud/icons/settings.png',
  'images/hud/icons/thirst.png',
  'images/hud/icons/thirsty_sweep.png',

  // Inventory items
  'images/hud/items/cup.png',
  'images/hud/items/fishing-rod.png',
  'images/hud/items/fresh-water.png',
  'images/hud/items/grill.png',
  'images/hud/items/hammer.png',
  'images/hud/items/hook.png',
  'images/hud/items/knife.png',
  'images/hud/items/metal.png',
  'images/hud/items/plants.png',
  'images/hud/items/plastic.png',
  'images/hud/items/rope.png',
  'images/hud/items/salt-water.png',
  'images/hud/items/spear.png',
  'images/hud/items/storage.png',
  'images/hud/items/water-purifier.png',
  'images/hud/items/wood.png',

  // Cooking ingredients & dishes
  'images/cooking/boiled_mussels.png',
  'images/cooking/charred_squid.png',
  'images/cooking/clam_broth.png',
  'images/cooking/clams.png',
  'images/cooking/coal.png',
  'images/cooking/crab.png',
  'images/cooking/crab_with_potato.png',
  'images/cooking/crab_with_sea_salt.png',
  'images/cooking/fettuccine.png',
  'images/cooking/fettuccine_crab_potato.png',
  'images/cooking/fettuccine_pomodoro.png',
  'images/cooking/fettuccine_sea_food.png',
  'images/cooking/fettuccine_squid.png',
  'images/cooking/fettuccine_with_shark.png',
  'images/cooking/garlic.png',
  'images/cooking/garlic_squid.png',
  'images/cooking/grilled_sardines.png',
  'images/cooking/grilled_shark_meat.png',
  'images/cooking/mussels.png',
  'images/cooking/mussels_and_clams.png',
  'images/cooking/mussels_pomodoro.png',
  'images/cooking/olive_oil.png',
  'images/cooking/potato.png',
  'images/cooking/roasted_potato.png',
  'images/cooking/salted_sardines.png',
  'images/cooking/sardines.png',
  'images/cooking/sardines_in_oil.png',
  'images/cooking/sardines_pomodoro.png',
  'images/cooking/sea_salt.png',
  'images/cooking/seafood_stew.png',
  'images/cooking/seaweed.png',
  'images/cooking/shark_meat.png',
  'images/cooking/shark_steak.png',
  'images/cooking/shark_with_potato.png',
  'images/cooking/shark_with_tomato.png',
  'images/cooking/spaghetti.png',
  'images/cooking/spaghetti_alle_vongole.png',
  'images/cooking/spaghetti_mussels.png',
  'images/cooking/spaghetti_shark_pomodoro.png',
  'images/cooking/spaghetti_squid_seaweed.png',
  'images/cooking/spaghetti_with_sardines.png',
  'images/cooking/squid.png',
  'images/cooking/squid_with_seaweed.png',
  'images/cooking/squid_with_tomato.png',
  'images/cooking/tomatoes.png',

  // Tier-4 hero plates render as GLBs (not flat sprites) both above
  // the grill and in the player's hand. Preload them so the first
  // tier-4 cook doesn't pop in.
  'assets/scene/items/spaghetti_shark_pomodoro.glb',
  'assets/scene/items/fettuccine_sea_food.glb'
]

export function preloadHudAssets(): void {
  const entity = engine.addEntity()
  AssetLoad.create(entity, { assets: [...HUD_PRELOAD_ASSETS] })
}
