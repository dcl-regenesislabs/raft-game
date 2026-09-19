import { engine, Transform, InputAction, PointerEventType, inputSystem } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { FloatingIsland, IslandChest, ChefNpc } from '../components'
import { getMultiplayerSnapshot, isMultiplayer, sendWorldAction } from './multiplayerState'
import { getSelectedSlot, getSlotItem, isSelectionPointerLockoutActive } from '../ui/inventoryState'
import { isInventoryActionLocked } from '../ui/inventoryToggle'
import { isPointerLocked } from '../ui/cursorLock'
import { toolFireJustPressed, isToolFirePressed } from '../systems/toolFire'
import { getLookAtGarbageEntity } from '../systems/lookAtTarget'
import { consumeWorldClick } from '../ui/worldClickGate'
import { worldEntityId } from './worldEntities'
import { ORIGIN, distance, tileObjectId } from '../multiplayer/world'
import { isGameOver } from '../ui/gameOver'
import { multiplayerReady } from './multiplayerState'

let shieldElapsed = 0
export function multiplayerInputSystem(dt: number): void {
  if (
    !isMultiplayer() ||
    !multiplayerReady() ||
    isGameOver() ||
    isInventoryActionLocked() ||
    isSelectionPointerLockoutActive()
  )
    return
  const snapshot = getMultiplayerSnapshot()
  if (!snapshot) return
  for (const [entity, chest] of engine.getEntitiesWith(IslandChest)) {
    if (
      FloatingIsland.getOrNull(chest.island)?.active &&
      inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN, entity)
    ) {
      sendWorldAction({ kind: 'islandLoot' })
      consumeWorldClick()
      return
    }
  }
  for (const [, chef] of engine.getEntitiesWith(ChefNpc)) {
    if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN, chef.clickEntity)) {
      sendWorldAction({ kind: 'chefGift' })
      consumeWorldClick()
      return
    }
  }
  const slot = getSelectedSlot(),
    item = getSlotItem(slot)
  const cam = Transform.getOrNull(engine.CameraEntity)
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!item || !cam || !player) return
  shieldElapsed -= dt
  if (item.id === 'boardingShield' && isToolFirePressed() && shieldElapsed <= 0) {
    shieldElapsed = 1
    sendWorldAction({ kind: 'useTool', slot, target: '', direction: Vector3.rotate(Vector3.Forward(), cam.rotation) })
    return
  }
  if (!isPointerLocked() || !toolFireJustPressed()) return
  if (item.id === 'anchor') {
    sendWorldAction({ kind: 'anchor' })
    consumeWorldClick()
    return
  }
  if (['bandage', 'scrapArmor', 'repairKit'].includes(item.id)) {
    const target = Object.values(snapshot.world.tiles)
      .filter((t) => (t.device ? t.device.health < t.device.maxHealth : t.health < 100))
      .sort(
        (a, b) =>
          Math.hypot(a.x * 3 + ORIGIN.x - player.position.x, a.z * 3 + ORIGIN.z - player.position.z) -
          Math.hypot(b.x * 3 + ORIGIN.x - player.position.x, b.z * 3 + ORIGIN.z - player.position.z)
      )[0]
    sendWorldAction({
      kind: 'useTool',
      slot,
      target: target ? tileObjectId(target) : '',
      direction: { x: 0, y: 0, z: 0 }
    })
    consumeWorldClick()
    return
  }
  if (!['spear', 'bow', 'salvageAxe'].includes(item.id)) return
  if (item.id === 'salvageAxe') {
    const debris = getLookAtGarbageEntity()
    if (debris !== null) {
      sendWorldAction({ kind: 'collect', target: worldEntityId(debris), slot, hook: false })
      consumeWorldClick()
      return
    }
  }
  const forward = Vector3.rotate(Vector3.Forward(), cam.rotation)
  const target = Object.values(snapshot.world.enemies)
    .filter((e) => {
      const offset = Vector3.subtract(e.position, cam.position)
      return (
        distance(e.position, player.position) <= (item.id === 'bow' ? 28 : 4) &&
        Vector3.dot(Vector3.normalize(offset), forward) > 0.93
      )
    })
    .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))[0]
  if (target) {
    sendWorldAction({ kind: 'attack', slot, target: target.id })
    consumeWorldClick()
  }
}
