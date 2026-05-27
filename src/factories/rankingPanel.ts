import {
  ColliderLayer,
  Entity,
  GltfContainer,
  TextAlignMode,
  TextShape,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { LobbyTag } from '../components'
import { PLATFORM_SIZE_Y } from './platform'
import { LOBBY_RAFT_Y } from './sceneLevels'

const PANEL_GLB = 'assets/scene/structures/information_panel.glb'
const LOBBY_DECK_Y = LOBBY_RAFT_Y + PLATFORM_SIZE_Y
const PANEL_LIFT = 2.1
const PANEL_OFFSET_X = 1.5
const PANEL_OFFSET_Z = -3
const LOBBY_Z_OFFSET = 0.9

const TITLE_FONT_SIZE = 2.2
const ENTRY_FONT_SIZE = 1.4
const MAX_ENTRIES = 10
const ENTRY_SPACING = 0.14

let titleEntity: Entity | null = null
let entryEntities: Entity[] = []

export function buildRankingPanel(cx: number, cz: number): void {
  const shiftedCz = cz + LOBBY_Z_OFFSET
  const panelX = cx + PANEL_OFFSET_X
  const panelZ = shiftedCz + PANEL_OFFSET_Z

  const panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(panelX, LOBBY_DECK_Y + PANEL_LIFT, panelZ),
    scale: Vector3.create(2.4, 2.4, 2.4)
  })
  GltfContainer.create(panel, {
    src: PANEL_GLB,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  LobbyTag.create(panel)

  const textZ = panelZ + 0.12
  const baseY = LOBBY_DECK_Y + PANEL_LIFT

  titleEntity = engine.addEntity()
  Transform.create(titleEntity, {
    position: Vector3.create(panelX, baseY + 0.15, textZ + 0.04),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0)
  })
  TextShape.create(titleEntity, {
    text: 'LEADERBOARD',
    fontSize: TITLE_FONT_SIZE,
    textColor: Color4.create(1, 1, 1, 1),
    outlineColor: Color3.create(0.05, 0.05, 0.05),
    outlineWidth: 0.15,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  LobbyTag.create(titleEntity)

  entryEntities = []
  for (let i = 0; i < MAX_ENTRIES; i++) {
    const entity = engine.addEntity()
    const y = baseY - 0.15 - i * ENTRY_SPACING
    Transform.create(entity, {
      position: Vector3.create(panelX, y, textZ + 0.04),
      rotation: Quaternion.fromEulerDegrees(0, 180, 0)
    })
    TextShape.create(entity, {
      text: i === 0 ? 'Loading...' : '',
      fontSize: ENTRY_FONT_SIZE,
      textColor: Color4.create(0.9, 0.85, 0.7, 1),
      outlineColor: Color3.create(0.05, 0.05, 0.05),
      outlineWidth: 0.1,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER
    })
    LobbyTag.create(entity)
    entryEntities.push(entity)
  }
}

export function getRankingEntryEntities(): ReadonlyArray<Entity> {
  return entryEntities
}

export function getRankingTitleEntity(): Entity | null {
  return titleEntity
}

export function clearRankingPanelRefs(): void {
  titleEntity = null
  entryEntities = []
}
