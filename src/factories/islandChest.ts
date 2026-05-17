import {
  Animator,
  ColliderLayer,
  Entity,
  GltfContainer,
  PointerEventType,
  PointerEvents,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { IslandChest } from '../components'

const CHEST_SRC = 'assets/scene/chest.glb'
const CHEST_SCALE = Vector3.create(1.0, 1.0, 1.0)
// Y above the root entity where the chest sits (island surface)
const CHEST_Y = 0.5

export function createIslandChest(rootEntity: Entity): Entity {
  const entity = engine.addEntity()

  Transform.create(entity, {
    parent: rootEntity,
    position: Vector3.create(0, CHEST_Y, 0),
    scale: CHEST_SCALE
  })

  GltfContainer.create(entity, {
    src: CHEST_SRC,
    visibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })

  Animator.create(entity, {
    states: [
      { clip: 'open', playing: false, loop: false },
      { clip: 'close', playing: false, loop: false }
    ]
  })

  PointerEvents.create(entity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: 0,
          hoverText: 'Open Chest',
          maxDistance: 6
        }
      }
    ]
  })

  IslandChest.create(entity, {
    opened: false,
    island: rootEntity
  })

  return entity
}

export function playChestOpenAnimation(entity: Entity): void {
  Animator.playSingleAnimation(entity, 'open', false)
}
