import {
  Billboard,
  BillboardMode,
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  PointerEventType,
  PointerEvents,
  TextAlignMode,
  TextShape,
  TextureFilterMode,
  TextureWrapMode,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import {
  LobbyButton,
  LobbyButtonHover,
  LobbyTag,
  LobbyTeleport,
  PortalPulse,
  PortalUvSwirl
} from '../components'
import { SceneMode } from '../runtime/sceneMode'
import {
  GRID_ORIGIN,
  PLATFORM_SIZE_Y,
  RAFT_SIZE,
  createPlatform
} from './platform'
import {
  LOBBY_RAFT_Y,
  LOBBY_SEABED_Y,
  LOBBY_WATER_Y
} from './sceneLevels'
import { createSeabed } from './seabed'
import { createWaterFloorV2 } from './water2'

// In-world title screen rendered before any game entity exists. The
// player walks across a raft island and either:
//   - clicks one of the three buttons on the central information panel
//     (NEW WORLD / LOAD WORLD / NEW WORLD - DEBUG) → fires the gate's
//     exit fade and runs the matching bootstrap.
//   - in DEMO mode only, walks into / clicks the single cross-realm
//     portal → triggers `changeRealm({ realm: 'raft.dcl.eth' })` so
//     the explorer prompts the user to jump to the FULL game.
//
// Every entity created here carries a `LobbyTag` so `teardownLobby`
// can sweep them away in one pass when the player commits to entering
// the game world.

const ISLAND_HALF = 3
const BRIDGE_REACH = 10
const CELL = RAFT_SIZE
const LOBBY_DECK_Y = LOBBY_RAFT_Y + PLATFORM_SIZE_Y

// Cell-grid X index the south bridge is aligned to. With the irregular
// south row spanning gx = -3..1 (gx=2 corner removed), the geometric
// midpoint is gx=-1 — putting the bridge cells on the same X line as
// the island's middle south cell so the connection reads as a single
// flush plank-walk rather than half-a-cell offset.
const BRIDGE_GX = -1

// Irregularity to lift the main deck off the boring 6×6 square. The base
// ranges over gx,gz ∈ [-3..2]; we punch out two diagonal corners and
// graft two small "tabs" jutting north of the rectangle so the silhouette
// reads as a hand-built scavenger raft rather than a perfect grid.
const ISLAND_REMOVE: ReadonlySet<string> = new Set(['-3,2', '2,-3'])
const ISLAND_TABS: ReadonlyArray<readonly [number, number]> = [
  [-2, 3],
  [1, 3]
]

// East/west decoration wings — each two cells deep along Z, attached to
// the island's middle row. Single source of truth so the wall builder
// can treat them as part of the connected cell set.
const WING_CELLS: ReadonlyArray<readonly [number, number]> = [
  [-ISLAND_HALF - 1, -1],
  [-ISLAND_HALF - 1, 0],
  [ISLAND_HALF, -1],
  [ISLAND_HALF, 0]
]

function mainIslandCells(): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let gx = -ISLAND_HALF; gx < ISLAND_HALF; gx++) {
    for (let gz = -ISLAND_HALF; gz < ISLAND_HALF; gz++) {
      if (ISLAND_REMOVE.has(`${gx},${gz}`)) continue
      cells.push([gx, gz])
    }
  }
  return cells
}

// 30 m is dramatic overkill for jump physics, but the walls are
// invisible colliders so the height has no visual cost — and shorter
// values (2 m, 4 m) kept getting cleared in playtest, so we just put
// the ceiling out of reach entirely.
const WALL_HEIGHT = 30
const WALL_THICKNESS = 0.4
const WALL_CENTER_Y = LOBBY_DECK_Y + WALL_HEIGHT / 2

// Distance at which the cross-realm portal trigger fires on player
// walk-in. Smaller than the visual ring so the player has to step into
// the centre, not graze the edge.
export const PORTAL_TRIGGER_RADIUS_M = 1.5
export const PORTAL_TRIGGER_RADIUS_SQ = PORTAL_TRIGGER_RADIUS_M * PORTAL_TRIGGER_RADIUS_M

const WELCOME_GLB = 'assets/scene/structures/welcome.glb'
const PORTAL_GLB = 'assets/scene/structures/portal_ring.glb'
const PANEL_GLB = 'assets/scene/structures/information_panel.glb'
const PORTAL_TEXTURE = 'assets/scene/structures/portal_texture_square.png'
const BUTTON_TEXTURE = 'images/hud/red_button.png'

// Decoration GLBs reused from the survival-game pack.
const BARREL_GLB = 'assets/scene/items/barrel.glb'
const WOOD_GLB = 'assets/scene/items/wood.glb'
// Pre-baked grayscale copy of red_button.png — swapped in when a button
// is in its inert state (LOAD World pre-probe / no-save). Keeps the
// chipped-corner alpha intact so the button silhouette doesn't shift
// when it disables.
const BUTTON_TEXTURE_DISABLED = 'images/hud/gray_button.png'

// Per-prop vertical lift above the deck. The GLBs in this pack pivot at
// their model centre rather than the model base, so anchoring at
// LOBBY_DECK_Y alone leaves the bottom half clipping through the raft.
const WELCOME_SCALE = 3
// Centre-pivot GLB lifted by half its scaled height so the base lands
// on the deck — original 1.7 lift at scale 2 becomes 2.55 at scale 3.
const WELCOME_LIFT = 2.55
const PANEL_LIFT = 2.1
const PORTAL_LIFT = 1.5
// barrel.glb is centre-pivot too (~1.91 m tall, half-height ~0.95).
// Lift = half-height * scale so the barrel base lands on the deck
// instead of sinking through it.
const BARREL_LIFT_FULL = 0.8    // scale 1.0
const BARREL_LIFT_CAMPFIRE = 0.7  // scale 0.9
const BARREL_LIFT_BUCKET = 0.4  // scale 0.55
// Cross-realm destination for the demo's teleport portal. Hard-coded
// rather than read from config because the demo's whole purpose is to
// drive players to the FULL world.
export const FULL_GAME_REALM = 'raft.dcl.eth'

export type LobbyButtonKind = 'NEW' | 'LOAD' | 'DEBUG'

export function createLobby(parcelGrid: number, mode: SceneMode): void {
  const cx = GRID_ORIGIN.x
  const cz = GRID_ORIGIN.z

  const seabed = createSeabed(parcelGrid, LOBBY_SEABED_Y)
  LobbyTag.create(seabed)

  const water = createWaterFloorV2(parcelGrid, LOBBY_WATER_Y)
  LobbyTag.create(water)

  buildIslandRafts(cx, cz)
  buildSideWingRafts(cx, cz)
  if (mode === 'demo') {
    buildSouthBridge(cx, cz)
  }
  buildBlockerWalls(cx, cz, mode, parcelGrid)
  buildDecor(cx, cz)
  buildActionPanel(cx, cz)
  if (mode === 'demo') {
    spawnTeleportPortal(cx + 4.5, cz + 6)
  }
  buildCampfireZone(cx - 10.5, cz, mode)
  buildFishingCorner(cx + 10.5, cz, mode)
  buildPerimeterProps(cx, cz)
}

// World-space position the player teleports to on lobby entry: the
// SOUTH end of the only bridge into the central island. Lifted into a
// helper so `runtime/sceneFlow.ts` can drop the avatar here on the BACK
// TO LOBBY path without re-deriving the bridge geometry. Demo-only —
// FULL mode has no bridge and uses the parcel-centre spawn instead.
const BRIDGE_REACH_M = BRIDGE_REACH * CELL
const ISLAND_HALF_M = ISLAND_HALF * CELL
// Half-cell south of the bridge's southernmost row so the marker sits
// in the centre of that cell rather than at the seam between two
// cells. The bridge runs from gz = -ISLAND_HALF-1 down to
// gz = -ISLAND_HALF-BRIDGE_REACH; the centre of the southernmost cell
// is `cz - ISLAND_HALF_M - BRIDGE_REACH_M + CELL/2`.
const BRIDGE_TAIL_OFFSET = ISLAND_HALF_M + BRIDGE_REACH_M - CELL / 2
export function getLobbyArrivalPosition(cx: number, cz: number): { x: number; z: number } {
  return { x: cellCentre(cx, BRIDGE_GX), z: cz - BRIDGE_TAIL_OFFSET }
}

export function teardownLobby(): void {
  const doomed: Entity[] = []
  for (const [entity] of engine.getEntitiesWith(LobbyTag)) {
    doomed.push(entity)
  }
  for (const entity of doomed) {
    engine.removeEntity(entity)
  }
}

function cellCentre(originAxis: number, gridIndex: number): number {
  return originAxis + (gridIndex + 0.5) * CELL
}

function buildIslandRafts(cx: number, cz: number): void {
  const cells: Array<[number, number]> = [
    ...mainIslandCells(),
    ...ISLAND_TABS.map(([gx, gz]) => [gx, gz] as [number, number])
  ]
  for (const [gx, gz] of cells) {
    const raft = createPlatform(
      Vector3.create(cellCentre(cx, gx), LOBBY_RAFT_Y, cellCentre(cz, gz)),
      { gridX: gx, gridZ: gz, yOverride: LOBBY_RAFT_Y }
    )
    LobbyTag.create(raft)
  }
}

// Single south-facing bridge connecting the central island to the
// scene's southern parcel border. Demo-mode only — players spawn at
// the bridge's southern tip and walk north under the welcome arch onto
// the island. One cell wide (3 m), aligned to the cell-grid X line at
// `BRIDGE_GX` so it shares an X edge with the island's middle south
// cell — the connection looks like a flush plank-walk instead of half
// a cell offset.
function buildSouthBridge(cx: number, cz: number): void {
  for (let span = ISLAND_HALF; span < ISLAND_HALF + BRIDGE_REACH; span++) {
    tagged(createPlatform(
      Vector3.create(cellCentre(cx, BRIDGE_GX), LOBBY_RAFT_Y, cellCentre(cz, -span - 1)),
      { gridX: BRIDGE_GX, gridZ: -span - 1, yOverride: LOBBY_RAFT_Y }
    ))
  }
}

function tagged(entity: Entity): Entity {
  LobbyTag.create(entity)
  return entity
}

// Cell-edge-driven wall builder: walks every cell in the connected
// island+wings set and spawns an invisible wall on each of its four
// edges that doesn't have a neighbouring cell. The wall geometry
// follows the irregular outline automatically — adding/removing cells
// in `mainIslandCells` / `ISLAND_TABS` / `WING_CELLS` keeps the
// fall-prevention boundary in sync without hand-editing wall lists.
//
// The bridge connection is the only exception: the bridge is centred
// on `cx` (between the gx=-1 and gx=0 grid lines) and is one cell wide,
// so it overlaps the south face of TWO island cells by 1.5 m each. We
// detect that overlap and emit two short segments around the gap
// instead of a full-cell wall.
function buildBlockerWalls(
  cx: number,
  cz: number,
  mode: SceneMode,
  parcelGrid: number
): void {
  void parcelGrid
  const cells: Array<[number, number]> = [
    ...mainIslandCells(),
    ...ISLAND_TABS.map(([gx, gz]) => [gx, gz] as [number, number]),
    ...WING_CELLS.map(([gx, gz]) => [gx, gz] as [number, number])
  ]
  const cellSet = new Set(cells.map(([gx, gz]) => `${gx},${gz}`))
  const isCell = (gx: number, gz: number): boolean => cellSet.has(`${gx},${gz}`)

  const halfCell = CELL / 2
  const bridgeOpen = mode === 'demo'
  const bridgeCx = cellCentre(cx, BRIDGE_GX)
  const bridgeMinX = bridgeCx - halfCell
  const bridgeMaxX = bridgeCx + halfCell

  for (const [gx, gz] of cells) {
    const x = cellCentre(cx, gx)
    const z = cellCentre(cz, gz)
    if (!isCell(gx, gz + 1)) {
      spawnWall(x, z + halfCell, CELL, WALL_THICKNESS)
    }
    if (!isCell(gx + 1, gz)) {
      spawnWall(x + halfCell, z, WALL_THICKNESS, CELL)
    }
    if (!isCell(gx - 1, gz)) {
      spawnWall(x - halfCell, z, WALL_THICKNESS, CELL)
    }
    if (!isCell(gx, gz - 1)) {
      // South face — split around the bridge gap if this cell sits on
      // the island's south edge AND the bridge intersects its X range.
      const cellMinX = x - halfCell
      const cellMaxX = x + halfCell
      const overlapMin = Math.max(cellMinX, bridgeMinX)
      const overlapMax = Math.min(cellMaxX, bridgeMaxX)
      const overlaps = bridgeOpen && gz === -ISLAND_HALF && overlapMin < overlapMax
      if (!overlaps) {
        spawnWall(x, z - halfCell, CELL, WALL_THICKNESS)
        continue
      }
      if (cellMinX < overlapMin) {
        const segLen = overlapMin - cellMinX
        const segCx = (cellMinX + overlapMin) / 2
        spawnWall(segCx, z - halfCell, segLen, WALL_THICKNESS)
      }
      if (cellMaxX > overlapMax) {
        const segLen = cellMaxX - overlapMax
        const segCx = (overlapMax + cellMaxX) / 2
        spawnWall(segCx, z - halfCell, segLen, WALL_THICKNESS)
      }
    }
  }

  if (!bridgeOpen) return

  // Bridge sides + far end so the player can't fall off the walkway.
  const bridgeReachM = BRIDGE_REACH * CELL
  const bridgeMidOffset = ISLAND_HALF * CELL + bridgeReachM / 2
  spawnWall(bridgeCx + halfCell, cz - bridgeMidOffset, WALL_THICKNESS, bridgeReachM)
  spawnWall(bridgeCx - halfCell, cz - bridgeMidOffset, WALL_THICKNESS, bridgeReachM)
  spawnWall(bridgeCx, cz - ISLAND_HALF * CELL - bridgeReachM, CELL, WALL_THICKNESS)
}

function spawnWall(
  worldX: number,
  worldZ: number,
  sizeX: number,
  sizeZ: number
): void {
  const wall = engine.addEntity()
  Transform.create(wall, {
    position: Vector3.create(worldX, WALL_CENTER_Y, worldZ),
    scale: Vector3.create(sizeX, WALL_HEIGHT, sizeZ)
  })
  MeshCollider.setBox(wall, [ColliderLayer.CL_PHYSICS])
  LobbyTag.create(wall)
}

// Welcome arch sits at the south threshold of the island — the spot
// where the bridge meets the deck. Rotated 180° around Y so the
// "WELCOME" face reads toward the bridge (-Z), greeting the player as
// they walk north onto the island.
function buildDecor(cx: number, cz: number): void {
  const archX = cellCentre(cx, BRIDGE_GX)
  const archZ = cz - ISLAND_HALF * CELL + 0.65
  const welcome = engine.addEntity()
  Transform.create(welcome, {
    position: Vector3.create(archX, LOBBY_DECK_Y + WELCOME_LIFT, archZ),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(WELCOME_SCALE, WELCOME_SCALE, WELCOME_SCALE)
  })
  GltfContainer.create(welcome, {
    src: WELCOME_GLB,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  LobbyTag.create(welcome)
}

// Default + small button presets. NEW and LOAD use BIG; DEBUG uses
// SMALL so it can sit in a corner without dominating the panel layout.
// Widths are intentionally a bit wider than the texture's natural
// 2.34:1 aspect so the labels have room to breathe. fontSize is in
// DCL TextShape units (default = 10) — these values are tuned so the
// label sits comfortably inside the plate without bleeding past it.
const BIG_BUTTON: ButtonShape = { width: 1.8, height: 0.6, fontSize: 2.7 }
const SMALL_BUTTON: ButtonShape = { width: 0.78, height: 0.27, fontSize: 1.125 }

// Click-plate padding factors. The click target is intentionally
// bigger than the visible plate so steep aim angles still register —
// X is gentle (so neighbouring buttons don't fight for clicks); Y is
// more generous because the visible plate is wide-but-short and
// grazing rays often shave above/below the visible art.
const HIT_PAD_X = 1.15
const HIT_PAD_Y = 1.25
// Thickness of the click box along the panel-facing axis. The camera
// ray hits the front face regardless of how thick the box is, so we
// keep this just slightly off-zero — enough to give the collider some
// substance, thin enough that the debug overlay reads as a flat
// rectangle instead of a 1 m slab.
const HIT_DEPTH = 0.05

// Information kiosk. NEW WORLD + LOAD WORLD are stacked big in the
// centre; DEBUG is a small ghost button tucked in the bottom-right
// corner so it doesn't compete for attention. Placed at the back-LEFT
// of the lobby island per the hub-concept layout — info kiosk on one
// side, the cross-realm portal on the other, both facing south so the
// player at spawn can read both signs at once.
const PANEL_OFFSET_X = -1.5
const PANEL_OFFSET_Z = 3
function buildActionPanel(cx: number, cz: number): void {
  const panelX = cx + PANEL_OFFSET_X
  const panelZ = cz + PANEL_OFFSET_Z
  const panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(panelX, LOBBY_DECK_Y + PANEL_LIFT, panelZ),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.create(2.4, 2.4, 2.4)
  })
  GltfContainer.create(panel, {
    src: PANEL_GLB,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  LobbyTag.create(panel)

  // Z is offset toward the player so the button surface sits just in
  // front of the panel mesh (avoids z-fighting). Scaled with the panel
  // (0.08 m at scale 1.6 → 0.12 m at scale 2.4) so the plates still
  // read as printed onto the panel's "screen" face instead of floating.
  const buttonZ = panelZ - 0.12
  const baseY = LOBBY_DECK_Y + PANEL_LIFT
  spawnButton('NEW', 'NEW WORLD', panelX, baseY - 0.075, buttonZ, BIG_BUTTON)
  spawnButton('LOAD', 'LOAD WORLD', panelX, baseY - 0.825, buttonZ, BIG_BUTTON)
  spawnButton('DEBUG', 'DEBUG', panelX, baseY - 1.28, buttonZ, SMALL_BUTTON)
}

interface ButtonShape {
  width: number
  height: number
  fontSize: number
}

function spawnButton(
  kind: LobbyButtonKind,
  label: string,
  worldX: number,
  worldY: number,
  worldZ: number,
  shape: ButtonShape
): void {
  // CLICK plate: an invisible, oversized box collider that holds the
  // pointer events. We expand horizontally by HIT_PAD_X and vertically
  // by HIT_PAD_Y so steep aim angles still land on the right button —
  // the visible plate stays the requested `shape` size on a child
  // entity. The X pad is gentle so adjacent buttons don't fight for
  // clicks; the Y pad is more generous because the visible plate is
  // wide-but-short and grazing rays often shave above/below it.
  const clickW = shape.width * HIT_PAD_X
  const clickH = shape.height * HIT_PAD_Y
  const button = engine.addEntity()
  Transform.create(button, {
    position: Vector3.create(worldX, worldY, worldZ),
    scale: Vector3.create(clickW, clickH, HIT_DEPTH)
  })
  MeshCollider.setBox(button, [ColliderLayer.CL_POINTER])
  PointerEvents.create(button, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: label,
          maxDistance: 8
        }
      },
      // Hover events drive the zoom-in feedback in
      // systems/lobbyButtonHover.ts. The hoverText repetition is
      // intentional — it matches the click event so the cursor reads
      // the same label whether you're aiming or clicking.
      {
        eventType: PointerEventType.PET_HOVER_ENTER,
        eventInfo: { button: InputAction.IA_POINTER, hoverText: label, maxDistance: 8 }
      },
      {
        eventType: PointerEventType.PET_HOVER_LEAVE,
        eventInfo: { button: InputAction.IA_POINTER, hoverText: label, maxDistance: 8 }
      }
    ]
  })
  LobbyButton.create(button, { kind })
  LobbyTag.create(button)

  // VISIBLE plate (child of the click plate): textured plane sized
  // back DOWN to the requested visual `shape`. Local scale is the
  // reciprocal of the parent's pad so the world dimensions land at
  // exactly (shape.width, shape.height). When the parent zooms via
  // the hover lerp, the visual inherits the zoom automatically.
  const visual = engine.addEntity()
  Transform.create(visual, {
    parent: button,
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(1 / HIT_PAD_X, 1 / HIT_PAD_Y, 1)
  })
  MeshRenderer.setPlane(visual)
  // LOAD plate starts disabled — the save probe hasn't reported yet,
  // so we render it gray until lobbyPortalSystem flips it once probe
  // results land.
  applyLobbyButtonMaterial(visual, kind !== 'LOAD')
  LobbyTag.create(visual)

  // Floating label sat ~0.04 m south of the plane (toward the player)
  // so the glyphs render clearly in front of the button without
  // z-fighting. Lifted a touch above the plate centre so the glyph
  // baseline sits visually centred (TextShape anchors at glyph centre
  // but capital strokes hang below — the +0.02 nudge cancels that).
  // TextShape's default front face already points -Z, so no rotation
  // is needed for the player approaching from the south.
  const text = engine.addEntity()
  Transform.create(text, {
    position: Vector3.create(worldX, worldY + 0.02, worldZ - 0.04)
  })
  TextShape.create(text, {
    text: label,
    fontSize: shape.fontSize,
    textColor: Color4.create(1, 1, 1, 1),
    outlineColor: Color3.create(0.05, 0.05, 0.05),
    outlineWidth: 0.15,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  LobbyTag.create(text)

  // Seed the hover state at rest; lobbyButtonHoverSystem owns updates.
  // baseWidth / baseHeight describe the click plate (the entity that
  // actually scales) — the visual + text inherit / mirror that zoom.
  LobbyButtonHover.create(button, {
    visualEntity: visual,
    textEntity: text,
    visualLocalX: 1 / HIT_PAD_X,
    visualLocalY: 1 / HIT_PAD_Y,
    targetMul: 1,
    currentMul: 1
  })
}

// Re-applied to the LOAD button when the save-probe state flips so it
// reads as gray/dim until a save is confirmed available. Uses the
// unlit basic material so the button shows the texture 1:1 — no scene
// shadows darkening it, no emissive bloom either. The texture itself
// swaps between the red + gray variants so the disabled state reads as
// a true neutral gray (a `diffuseColor` multiplier on the red texture
// can only darken it toward maroon, never desaturate it).
export function applyLobbyButtonMaterial(entity: Entity, enabled: boolean): void {
  Material.setBasicMaterial(entity, {
    texture: Material.Texture.Common({
      src: enabled ? BUTTON_TEXTURE : BUTTON_TEXTURE_DISABLED,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_CLAMP
    }),
    diffuseColor: Color4.create(1, 1, 1, 1),
    alphaTest: 0.5,
    castShadows: false
  })
}

// Single cross-realm portal. Visible only in DEMO. Walking into it OR
// clicking it asks the explorer to swap realms via `changeRealm`,
// which surfaces its own confirmation dialog — no scene-side modal
// needed.
function spawnTeleportPortal(worldX: number, worldZ: number): void {
  const ring = engine.addEntity()
  Transform.create(ring, {
    position: Vector3.create(worldX, LOBBY_DECK_Y + PORTAL_LIFT - 0.15, worldZ),
    scale: Vector3.create(1.8, 1.8, 1.8)
  })
  GltfContainer.create(ring, {
    src: PORTAL_GLB,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  PointerEvents.create(ring, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: 'Travel to the FULL game',
          maxDistance: 8
        }
      }
    ]
  })
  LobbyTeleport.create(ring)
  LobbyTag.create(ring)

  spawnPortalInterior(worldX, worldZ)

  // Red button plate behind the FULL GAME label, mirroring the NEW
  // WORLD / LOAD WORLD buttons on the kiosk so the portal reads as a
  // call-to-action of the same family. Static (no billboard): the
  // plate's default plane normal points -Z, which matches the player's
  // approach from the south, same convention as the kiosk buttons. The
  // text is parented to the plate and inverse-scaled so glyphs render
  // at their natural aspect ratio despite the parent's non-uniform
  // stretch.
  const PLATE_SCALE = 0.5
  const PLATE_W = 2.7 * PLATE_SCALE
  const PLATE_H = 0.9 * PLATE_SCALE
  const plateY = LOBBY_DECK_Y + PORTAL_LIFT + 1.1
  const plateZ = worldZ - 0.5
  const plate = engine.addEntity()
  Transform.create(plate, {
    position: Vector3.create(worldX, plateY, plateZ),
    scale: Vector3.create(PLATE_W, PLATE_H, 1)
  })
  MeshRenderer.setPlane(plate)
  applyLobbyButtonMaterial(plate, true)
  LobbyTag.create(plate)

  const text = engine.addEntity()
  Transform.create(text, {
    parent: plate,
    position: Vector3.create(0, 0, -0.04),
    scale: Vector3.create(1 / PLATE_W, 1 / PLATE_H, 1)
  })
  TextShape.create(text, {
    text: 'FULL GAME',
    fontSize: 4 * PLATE_SCALE,
    textColor: Color4.create(1, 1, 1, 1),
    outlineColor: Color3.create(0.05, 0.05, 0.05),
    outlineWidth: 0.2,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  LobbyTag.create(text)
}

function spawnPortalInterior(worldX: number, worldZ: number): void {
  const interior = engine.addEntity()
  Transform.create(interior, {
    position: Vector3.create(worldX, LOBBY_DECK_Y + PORTAL_LIFT, worldZ),
    scale: Vector3.create(2, 2.2, 1)
  })
  MeshRenderer.setPlane(interior, [
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1
  ])
  PortalUvSwirl.create(interior, {
    speedU: 0.045,
    speedV: 0.08,
    offsetU: 0,
    offsetV: 0,
    rotSpeed: 0.6,
    rotation: 0,
    tileCount: 1
  })
  Material.setPbrMaterial(interior, {
    texture: Material.Texture.Common({
      src: PORTAL_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    emissiveTexture: Material.Texture.Common({
      src: PORTAL_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    alphaTexture: Material.Texture.Common({
      src: PORTAL_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_REPEAT
    }),
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 0.75,
    specularIntensity: 0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false,
    roughness: 1,
    metallic: 0
  })
  PortalPulse.create(interior, {
    elapsed: 0,
    speed: 3.5,
    baseIntensity: 0.5,
    pulseAmp: 0.12
  })
  LobbyTag.create(interior)
}

// East and west decoration wings — each a 1×2 cell strip extending off
// the island's middle row. The barrel cluster sits on the west wing,
// the fishing corner on the east wing. Two cells deep (in Z) so the
// 3-barrel ring + fishing rod / bucket / plant cluster all fit
// without overhanging the deck.
function buildSideWingRafts(cx: number, cz: number): void {
  for (const [gx, gz] of WING_CELLS) {
    tagged(createPlatform(
      Vector3.create(cellCentre(cx, gx), LOBBY_RAFT_Y, cellCentre(cz, gz)),
      { gridX: gx, gridZ: gz, yOverride: LOBBY_RAFT_Y }
    ))
  }
}

// West wing — three barrels arranged in a circle. Reads as the lobby's
// gathering nook.
function buildCampfireZone(wingX: number, wingZ: number, _mode: SceneMode): void {
  const barrelOffsets: Array<{ dx: number; dz: number; yawDeg: number }> = [
    { dx: 1.3, dz: 0, yawDeg: 30 },
    { dx: -0.65, dz: -1.1, yawDeg: 150 },
    { dx: -0.65, dz: 1.1, yawDeg: 270 }
  ]
  for (const { dx, dz, yawDeg } of barrelOffsets) {
    const barrel = engine.addEntity()
    Transform.create(barrel, {
      position: Vector3.create(wingX + dx, LOBBY_DECK_Y + BARREL_LIFT_CAMPFIRE, wingZ + dz),
      rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
      scale: Vector3.create(0.9, 0.9, 0.9)
    })
    GltfContainer.create(barrel, {
      src: BARREL_GLB,
      visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
    })
    LobbyTag.create(barrel)
  }
}

// East wing — a small bucket (re-scaled barrel) on the deck. The rod
// and plant tuft that used to flank it were removed; the lone bucket
// keeps the wing from reading as empty.
function buildFishingCorner(wingX: number, wingZ: number, _mode: SceneMode): void {
  const bucket = engine.addEntity()
  Transform.create(bucket, {
    position: Vector3.create(wingX - 0.6, LOBBY_DECK_Y + BARREL_LIFT_BUCKET, wingZ + 0.6),
    rotation: Quaternion.fromEulerDegrees(0, 45, 0),
    scale: Vector3.create(0.55, 0.55, 0.55)
  })
  GltfContainer.create(bucket, {
    src: BARREL_GLB,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  LobbyTag.create(bucket)
}

// Static decoration scattered around the central island's perimeter to
// echo the concept art's "scavenger raft" feel. Positions are kept off
// the natural walking lanes (welcome → centre, centre → kiosk, centre
// → portal) so the deck stays traversable.
function buildPerimeterProps(cx: number, cz: number): void {
  // The SE (2,-3) and NW (-3,2) deck cells are punched out by
  // ISLAND_REMOVE, so the matching corner barrels are shifted 2 m
  // inward along x — landing them on cells (1,-3) and (-2,2)
  // respectively instead of hanging off the deck.
  const cornerBarrels: Array<{ x: number; z: number; yawDeg: number }> = [
    { x: -7, z: -7, yawDeg: 15 },
    { x: 5, z: -7, yawDeg: 200 },
    { x: -5, z: 7, yawDeg: 110 },
    { x: 7, z: 7, yawDeg: 290 }
  ]
  for (const { x, z, yawDeg } of cornerBarrels) {
    const barrel = engine.addEntity()
    Transform.create(barrel, {
      position: Vector3.create(cx + x, LOBBY_DECK_Y + BARREL_LIFT_FULL, cz + z),
      rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
      scale: Vector3.create(1, 1, 1)
    })
    GltfContainer.create(barrel, {
      src: BARREL_GLB,
      visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
    })
    LobbyTag.create(barrel)
  }

  const driftwood: Array<{ x: number; z: number; yawDeg: number }> = [
    { x: 4.8, z: -3, yawDeg: 60 },
    { x: -4.8, z: -3, yawDeg: -60 }
  ]
  for (const { x, z, yawDeg } of driftwood) {
    const wood = engine.addEntity()
    Transform.create(wood, {
      position: Vector3.create(cx + x, LOBBY_DECK_Y + 0.05, cz + z),
      rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0),
      scale: Vector3.create(1.2, 1.2, 1.2)
    })
    GltfContainer.create(wood, {
      src: WOOD_GLB,
      visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
    })
    LobbyTag.create(wood)
  }

}

