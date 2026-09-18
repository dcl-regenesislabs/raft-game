import { expansionActions } from '../expansion/runtime'
import { getMainActionIcon } from '../ui/mainActionIcons'
import { HANDS_ICON } from '../ui/theme'
import { BUILD_ICON, ERASE_ICON, ROTATE_CW_ICON, ROTATE_CCW_ICON } from '../ui/buildControlIcons'
import { NATIVE_SLOT_ACTIONS } from './nativeEquipment'
import { getInventorySlot, getCatalogItem } from '../ui/items'
import { getCookableById } from '../ui/cookableItems'
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

// Native movement and crosshair remain client-owned. All action buttons,
// including jump, are scene UI entities bound to real InputActions.
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
    eIcon = HANDS_ICON
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
  const grabbing = target === 'garbage' && getRaftBuilderMode() === 'idle' && getConstructionPlacementMode() === 'idle'
  const pointerLabel = grabbing ? 'Collect' : !item
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
      icon: getMainActionIcon(grabbing ? HANDS_ICON : builder !== 'idle' ? modeIcon : (item?.texture ?? HANDS_ICON)),
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
  const menu = worldControlsHidden() || isEquipmentPickerOpen()
  // Explorer also uses touch-input glyphs in its native hover tooltip.
  const grabIcon = !menu && getLookAtTarget() === 'garbage' ? HANDS_ICON : undefined
  const signature = JSON.stringify([menu, grabIcon])
  if (lastWritten === signature) return
  lastWritten = signature
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    touchInputs: [
      ...NATIVE_SLOT_ACTIONS,
      InputAction.IA_POINTER, InputAction.IA_PRIMARY,
      InputAction.IA_SECONDARY, InputAction.IA_JUMP
    ].map(inputAction => ({
      inputAction,
      hide: true,
      icon: inputAction === InputAction.IA_PRIMARY && grabIcon
        ? { tex: { $case: 'texture' as const, texture: { src: grabIcon } } }
        : undefined
    })),
    mainAction: InputAction.IA_POINTER,
    hideJoystick: menu,
    hideCrosshair: menu
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

  // Placement previews use custom E/F rotation icons; POINTER commits.
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
