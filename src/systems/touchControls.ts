import { expansionActions } from '../expansion/runtime'
import { getMainActionIcon } from '../ui/mainActionIcons'
import { HANDS_ICON } from '../ui/theme'
import { BUILD_ICON, ERASE_ICON, ROTATE_CW_ICON, ROTATE_CCW_ICON } from '../ui/buildControlIcons'
import { NATIVE_SLOT_ACTIONS } from './nativeEquipment'
import { getInventorySlot, getCatalogItem } from '../ui/items'
import { getCookableById } from '../ui/cookableItems'
import { getLookAtGarbageKind } from './lookAtTarget'
import { isFishingBiting } from './fishingRod'
import { isCrafting } from '../ui/craftSession'
import { Entity, InputAction, TouchScreenControls, engine } from '@dcl/sdk/ecs'

import {
  ActiveCook,
  ChefNpc,
  CookStatus,
  FloatingIsland,
  IslandChest,
  PlatformConstruction,
  PurifierState
} from '../components'
import { CHEST_INTERACT_MAX_DISTANCE } from '../factories/islandChest'
import { getHeldFoodId, getHeldItemKind } from '../factories/heldItem'
import { isCraftOpen } from '../ui/craftToggle'
import { isCookOpen } from '../ui/cookToggle'
import { isGameOver } from '../ui/gameOver'
import { getSelectedSlot } from '../ui/inventoryState'
import { isEquipmentPickerOpen, isInventoryOpen } from '../ui/inventoryToggle'
import { isStartupGateActive } from '../ui/startupGate'
import { isStorageOpen } from '../ui/storageToggle'
import { isSystemMenuOpen } from '../ui/systemSession'
import { isWinActive } from '../ui/winScreen'
import { getConstructionPlacementMode } from './constructionPlacement'
import { isFishingLineActive } from './fishingRod'
import { getProximityConstruction, getLookAtGrillPlatform, getLookAtPointerHit, getLookAtTarget } from './lookAtTarget'
import { getRaftBuilderMode } from './raftBuilder'
import { USE_NATIVE_POINTER } from './toolFire'

// Drives the native mobile on-screen gamepad (TouchScreenControls on the
// RootEntity, honored by touch clients — a no-op on desktop). Declutter
// policy:
//   - Hide 1/2/3/4: equipment selection lives in the labeled dropdown.
//   - E / F only show while the matching interaction would actually
//     fire, mirroring each interact system's own conditions (see
//     computeDesired below).
//   - POINTER always shows the equipped item (or idle Hands) as the main action.
//   - Jump, the joystick and the crosshair stay (knobs below).
//
// NOTE: import `TouchScreenControls` only via '@dcl/sdk/ecs'. A stale
// @dcl/ecs 7.23.1 without the component may linger at the node_modules
// top level via @dcl/asset-packs' peer range.
//
// The component's convenience helpers (hideAll / hide / ...) merge into
// the current value and offer no per-button un-hide, so this module
// composes the full desired state and createOrReplace()s it — writing
// only on change to avoid per-frame CRDT churn.

const KEEP_JUMP = true
const KEEP_JOYSTICK = true
const KEEP_CROSSHAIR = true
// Keep equipped-item action central on every tool; jump remains secondary.
const MAIN_ACTION = InputAction.IA_POINTER

type DesiredButtons = {
  e: boolean
  f: boolean
  pointer: boolean
}

export type ControlAction = { visible: boolean; icon?: string; label: string }
export type MobileControlState = {
  pointer: ControlAction
  e: ControlAction
  f: ControlAction
  shortcuts: ControlAction[]
}
let lastWritten = ''

export function resolveMobileControls(): MobileControlState {
  const desired = computeDesired()
  const item = getInventorySlot(getSelectedSlot())
  const target = getLookAtTarget()
  let eIcon = getCatalogItem(target === 'water' ? 'cup' : (target ?? ''))?.texture
  let eLabel = 'Interact'
  if (target === 'water') eLabel = 'Fill cup'
  if (target === 'garbage') {
    const kind = getLookAtGarbageKind()
    eIcon = getCatalogItem(kind === 'barrel' ? 'wood' : (kind ?? 'wood'))?.texture
    eLabel = 'Collect'
  }
  if (target === 'storage') eLabel = 'Open storage'
  if (target === 'purifier') {
    eLabel = 'Add salt water'
    eIcon = getCatalogItem('saltWater')?.texture
    const hit = getLookAtPointerHit()
    for (const [platform, pc] of engine.getEntitiesWith(PlatformConstruction)) {
      if (pc.child !== hit?.entity || pc.kind !== 'purifier') continue
      if ((PurifierState.getOrNull(platform)?.freshAmount ?? 0) > 0) {
        eLabel = 'Drink water'
        eIcon = getCatalogItem('freshWater')?.texture
      }
    }
  }
  if (target === 'grill') {
    eLabel = 'Cook'
    const platform = getLookAtGrillPlatform()
    const cook = platform === null ? null : ActiveCook.getOrNull(platform)
    if (cook?.status === CookStatus.Ready) {
      eIcon = getCookableById(cook.recipeId)?.texture
      eLabel = 'Collect meal'
    } else if (cook?.status === CookStatus.Burned) {
      eIcon = getCatalogItem('coal')?.texture
      eLabel = 'Collect coal'
    }
  }
  const labels: Record<string, string> = {
    hook: 'Cast hook',
    fishingRod: 'Cast line',
    hammer: 'Build',
    spear: 'Attack',
    anchor: 'Throw anchor',
    repairKit: 'Repair',
    bandage: 'Bandage',
    bow: 'Shoot arrow',
    boardingShield: 'Block',
    scrapArmor: 'Wear armor',
    salvageAxe: 'Salvage'
  }
  const pointerLabel = !item
    ? 'Hands'
    : isEmptyCupHeld()
      ? target === 'water'
        ? 'Fill cup'
        : 'Aim at water'
      : isFishingLineActive()
        ? isFishingBiting()
          ? 'CATCH!'
          : 'Retract'
        : item?.id === 'saltWater'
          ? 'Drink salt water'
          : item?.id === 'freshWater'
            ? 'Drink water'
            : getRaftBuilderMode() === 'destroying'
              ? 'Destroy tile'
              : (labels[item?.id ?? ''] ?? labels[item?.heldKind ?? ''] ?? (item?.consumable ? 'Eat' : 'Place'))
  const nearby = getProximityConstruction()
  const extra = nearby ? expansionActions(nearby.platform) : null
  if (extra) {
    eIcon = extra.icon
    eLabel = extra.primary
  }
  const builder = getRaftBuilderMode()
  const rotating = builder === 'placing' || getConstructionPlacementMode() !== 'idle'
  const modeIcon = builder === 'destroying' ? ERASE_ICON : BUILD_ICON
  return {
    pointer: {
      visible: desired.pointer,
      icon: getMainActionIcon(builder !== 'idle' ? modeIcon : (item?.texture ?? HANDS_ICON)),
      label: pointerLabel
    },
    e: {
      visible: desired.e || (!!extra && !worldControlsHidden()),
      icon: rotating ? ROTATE_CCW_ICON : eIcon,
      label: rotating ? 'Rotate left' : eLabel
    },
    f: {
      visible: desired.f || (!!extra?.secondary && !worldControlsHidden()),
      icon: rotating ? ROTATE_CW_ICON : (extra?.secondaryIcon ?? getCatalogItem('wood')?.texture),
      label: rotating ? 'Rotate right' : (extra?.secondary ?? 'Add wood')
    },
    shortcuts: NATIVE_SLOT_ACTIONS.map((_, index) => ({
      visible: index === 0 && builder !== 'idle' && !worldControlsHidden(),
      icon: builder === 'destroying' ? BUILD_ICON : ERASE_ICON,
      label: builder === 'destroying' ? 'Switch to build' : 'Switch to erase'
    }))
  }
}

// One-time baseline write: everything contextual hidden. Called from
// main() on every platform — desktop clients ignore the component, and
// writing unconditionally keeps the gamepad clean from the first frame
// on touch clients even before the per-frame system (mobile-only) runs.
export function initTouchControls(): void {
  lastWritten = ''
  touchControlsSystem(0)
}

export function touchControlsSystem(_dt: number): void {
  const state = resolveMobileControls()
  const menu =
    isGameOver() ||
    isWinActive() ||
    isCrafting() ||
    (isInventoryOpen() && !isEquipmentPickerOpen()) ||
    isCraftOpen() ||
    isCookOpen() ||
    isStorageOpen() ||
    isSystemMenuOpen()
  const proximity =
    getProximityConstruction() !== null && getRaftBuilderMode() === 'idle' && getConstructionPlacementMode() === 'idle'
  const visual = (action: ControlAction) => ({ visible: action.visible, icon: action.icon })
  const signature = JSON.stringify({
    pointer: visual(state.pointer),
    e: visual(state.e),
    f: visual(state.f),
    shortcuts: state.shortcuts.map(visual),
    menu,
    proximity
  })
  if (lastWritten === signature) return
  lastWritten = signature
  const button = (inputAction: InputAction, action: ControlAction) => ({
    inputAction,
    hide: !action.visible,
    ...(action.icon ? { icon: { tex: { $case: 'texture' as const, texture: { src: action.icon } } } } : {})
  })
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    touchInputs: [
      ...NATIVE_SLOT_ACTIONS.map((action, index) => button(action, state.shortcuts[index])),
      button(InputAction.IA_POINTER, state.pointer),
      button(InputAction.IA_PRIMARY, proximity ? { ...state.e, visible: false } : state.e),
      button(InputAction.IA_SECONDARY, proximity ? { ...state.f, visible: false } : state.f),
      { inputAction: InputAction.IA_JUMP, hide: menu || !KEEP_JUMP }
    ],
    mainAction: MAIN_ACTION,
    hideJoystick: menu || !KEEP_JOYSTICK,
    hideCrosshair: menu || !KEEP_CROSSHAIR
  })
}

function worldControlsHidden(): boolean {
  return (
    isCrafting() ||
    isStartupGateActive() ||
    isGameOver() ||
    isWinActive() ||
    (isInventoryOpen() && !isEquipmentPickerOpen()) ||
    isCraftOpen() ||
    isCookOpen() ||
    isStorageOpen() ||
    isSystemMenuOpen()
  )
}

function computeDesired(): DesiredButtons {
  if (worldControlsHidden()) return { e: false, f: false, pointer: false }

  // Placement previews use native E/F rotation icons; POINTER commits.
  const placementActive = getRaftBuilderMode() !== 'idle' || getConstructionPlacementMode() !== 'idle'
  if (placementActive) {
    const rotating = getRaftBuilderMode() === 'placing' || getConstructionPlacementMode() !== 'idle'
    return { e: rotating, f: rotating, pointer: USE_NATIVE_POINTER }
  }

  return {
    e: computePrimaryAvailable(),
    f: computeSecondaryAvailable(),
    pointer: computePointerAvailable()
  }
}

// E mirrors, case by case, the conditions under which the entity-targeted
// IA_PRIMARY handlers actually do something (see constructionInteract,
// cupFill, garbageGrab, chefDialog / boatChefDirector, islandChest).
function computePrimaryAvailable(): boolean {
  const target = getLookAtTarget()
  if (target === 'garbage' || target === 'storage' || target === 'purifier') {
    return true
  }
  if (target === 'grill') return isGrillActionable()
  if (target === 'water') return false // Empty cup uses the main POINTER button.
  const hit = getLookAtPointerHit()
  if (hit === null) return false
  return isChefClickbox(hit.entity) || isOpenableChest(hit.entity, hit.length)
}

// F only fuels purifiers, and only while the fire is out — the same
// state that shows the "Add wood" hover entry (see purifierProcess).
function computeSecondaryAvailable(): boolean {
  if (getLookAtTarget() !== 'purifier') return false
  const hit = getLookAtPointerHit()
  if (hit === null) return false
  for (const [platform, pc] of engine.getEntitiesWith(PlatformConstruction)) {
    if (pc.child !== hit.entity) continue
    if (pc.kind !== 'purifier') return false
    const state = PurifierState.getOrNull(platform)
    return state !== null && state.fireSec <= 0
  }
  return false
}

// Keep the main button present for every equipped item, including idle Hands.
// Gameplay handlers validate the held item and target before doing anything.
function computePointerAvailable(): boolean {
  return USE_NATIVE_POINTER
}

function isEmptyCupHeld(): boolean {
  return getHeldItemKind() === 'cup' && getHeldFoodId() === 'cup'
}

// Grill E opens the cook menu / grabs the output — anything but a
// cook-in-progress (matches constructionInteract's grill routing).
function isGrillActionable(): boolean {
  const platform = getLookAtGrillPlatform()
  if (platform === null) return true
  const cook = ActiveCook.getOrNull(platform)
  if (cook === null) return true
  return cook.status !== CookStatus.Cooking
}

// Every chef (lobby greeter, boat visitor) advances dialog on an
// entity-targeted E press on its clickbox; the boat-chef WAITING click
// goes through the same entity. Its PointerEvents reach (8 m) equals
// the look-at ray's own max distance, so no extra range check.
function isChefClickbox(entity: Entity): boolean {
  for (const [, chef] of engine.getEntitiesWith(ChefNpc)) {
    if (chef.clickEntity === entity) return true
  }
  return false
}

// Chest E only lands while the parent island is active and the chest
// is still closed (mirrors islandChestSystem's gates), within the
// prompt's own reach — tighter than the look-at ray's 8 m.
function isOpenableChest(entity: Entity, hitLength: number): boolean {
  const chest = IslandChest.getOrNull(entity)
  if (chest === null || chest.opened) return false
  if (hitLength > CHEST_INTERACT_MAX_DISTANCE) return false
  const island = FloatingIsland.getOrNull(chest.island)
  return island !== null && island.active
}
