import {
  Animator,
  Billboard,
  BillboardMode,
  ColliderLayer,
  Entity,
  GltfContainer,
  InputAction,
  Material,
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
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'

import { ChefAnimDebug, ChefNpc } from '../components'

// Shared NPC factory for the Italian chef GLB. The lobby greeter and the
// in-game boat passenger are visually the same model with the same idle
// loop — only the spawn site and the dialog script differ. This factory
// owns the GLB load, the idle Animator, the O(1) click-box child, and
// the floating speech bubble. Tag callbacks let callers attach scene-
// specific markers (e.g. `LobbyTag` so the lobby teardown sweeps the
// whole NPC) without leaking that concern into the factory itself.

export const CHEF_GLB = 'assets/scene/items/italian_chef.glb'
// Standing idle used by the lobby greeter. Renamed in the GLB from the
// original `Idle_8` to a descriptive label after a walk-test revealed
// that the Mixamo clip-name labels didn't match the actual motions.
export const CHEF_IDLE_CLIP = 'idle_curiosity'
// Visually-correct seated idle. The original Mixamo `Chair_Sit_Idle_M`
// label was on a clip that turned out to be a "thanks" gesture, so we
// remapped the names in the GLB (see `docs/chef.md`).
export const CHEF_SITTING_IDLE_CLIP = 'sitting_idle'
export const CHEF_BIG_WAVE_HELLO_CLIP = 'big_wave_hello'
export const CHEF_HOVER_LABEL = 'Talk to the chef'

// Every animation clip baked into `italian_chef.glb` (post-rename).
// Surfaced for the debug cycler (`chefAnimDebugSystem`) so it can
// iterate them by name. Order matches the GLB's animation array.
// See `docs/chef.md` for the full table including original Mixamo
// labels and a description of what each clip visually does.
export const CHEF_ALL_CLIPS: ReadonlyArray<string> = [
  'sitting_idle',
  'celebrating',
  'thanks',
  'idle1',
  'running',
  'sitting_hello',
  'thinking',
  'idle2',
  'idle_curiosity',
  'ifeelyoubro',
  'walking',
  'congrats',
  'big_wave_hello'
]

// Seconds each clip plays in debug-cycle mode before advancing.
const DEBUG_CYCLE_PERIOD_S = 3

const CHEF_DIALOG_TEXTURE = 'images/hud/dialog_box.png'

// Dialog bubble PNG is 1100x700; the plane is stretched to that aspect
// so the parchment art reads correctly. The text child is inverse-
// scaled inside the plane so glyphs render square despite the parent's
// non-uniform scale (same trick the lobby kiosk's FULL GAME label uses).
const CHEF_DIALOG_WIDTH = 2.6
const CHEF_DIALOG_HEIGHT = CHEF_DIALOG_WIDTH * (700 / 1100)
const CHEF_DIALOG_LIFT = 1.75
const CHEF_DIALOG_FONT_SIZE = 1.6
const CHEF_DIALOG_MOBILE_TEXT_SCALE = 0.7

// Default click-box footprint, tuned to wrap the chef's silhouette so
// the click target lines up with the visible body even when arms flail
// during the idle animation. The box pivot is at floor level (`y = 0`),
// so the y position is half-height.
const CLICK_BOX_SIZE = Vector3.create(0.8, 1.8, 0.6)
const CLICK_BOX_CENTER_Y = CLICK_BOX_SIZE.y / 2

export interface CreateChefParams {
  // Optional parent — when set, position/rotation are local to the parent
  // (e.g. when riding on top of the boat). When null, position/rotation
  // are world-space.
  parent?: Entity
  position: Vector3
  rotation?: Quaternion
  scale?: number
  // Per-instance dialog script. Index 0 is the welcome line shown when
  // the bubble first opens; subsequent entries advance one per click.
  // After the last line, the next click hides the bubble; the click
  // after that wraps back to index 0.
  dialogLines: ReadonlyArray<string>
  hoverLabel?: string
  // Animation clip to loop. Defaults to the standing idle used by the
  // lobby greeter; the boat chef passes the sitting variant since they
  // ride along on a bench.
  idleClip?: string
  // Debug: when true, register every clip from the GLB as a state and
  // attach `ChefAnimDebug` so `chefAnimDebugSystem` cycles through them
  // (overwriting the dialog bubble with the current clip name each
  // step). Use to identify which animation maps to which name visually.
  debugCycleAllClips?: boolean
  // Click-box collision layers. Lobby chef uses POINTER+PHYSICS so the
  // box doubles as a body collider; the boat chef can opt into pointer
  // only since the deck already has its own footing.
  clickColliderLayers?: ColliderLayer[]
  // Tag callback invoked on every entity this factory creates (chef,
  // click box, bubble, text). Callers pass `LobbyTag.create` so a
  // teardown can sweep the whole NPC in one query.
  tag?: (entity: Entity) => void
}

export interface ChefHandles {
  chef: Entity
  clickEntity: Entity
  dialogBubbleEntity: Entity
  dialogTextEntity: Entity
}

export function createChef(params: CreateChefParams): ChefHandles {
  const {
    parent,
    position,
    rotation = Quaternion.Identity(),
    scale = 1,
    dialogLines,
    hoverLabel = CHEF_HOVER_LABEL,
    idleClip = CHEF_IDLE_CLIP,
    debugCycleAllClips = false,
    clickColliderLayers = [ColliderLayer.CL_POINTER, ColliderLayer.CL_PHYSICS],
    tag
  } = params

  const chef = engine.addEntity()
  Transform.create(chef, {
    parent,
    position,
    rotation,
    scale: Vector3.create(scale, scale, scale)
  })
  GltfContainer.create(chef, { src: CHEF_GLB })
  // In normal mode: single-state Animator listing only the clip we
  // want playing (avoids any renderer fallback behaviour observed with
  // multi-state setups). In debug-cycle mode: enumerate every clip in
  // the GLB so `chefAnimDebugSystem` can toggle `playing` flags across
  // them.
  const initialClip = debugCycleAllClips ? CHEF_ALL_CLIPS[0] : idleClip
  const animatorStates = debugCycleAllClips
    ? CHEF_ALL_CLIPS.map((clip) => ({
        clip,
        playing: clip === initialClip,
        loop: true,
        weight: 1,
        speed: 1
      }))
    : [
        { clip: idleClip, playing: true, loop: true, weight: 1, speed: 1 }
      ]
  Animator.create(chef, { states: animatorStates })

  const clickEntity = engine.addEntity()
  Transform.create(clickEntity, {
    parent: chef,
    position: Vector3.create(0, CLICK_BOX_CENTER_Y, 0),
    scale: CLICK_BOX_SIZE
  })
  MeshCollider.setBox(clickEntity, clickColliderLayers)
  PointerEvents.create(clickEntity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: hoverLabel,
          maxDistance: 8
        }
      }
    ]
  })

  const initialBubbleText = debugCycleAllClips
    ? initialClip
    : dialogLines[0] ?? ''
  const { bubble, text } = buildChefDialogBubble(chef, initialBubbleText)

  ChefNpc.create(chef, {
    clickEntity,
    dialogBubbleEntity: bubble,
    dialogTextEntity: text,
    dialogLines: [...dialogLines],
    dialogLineIndex: 0
  })

  if (debugCycleAllClips) {
    ChefAnimDebug.create(chef, {
      clipNames: [...CHEF_ALL_CLIPS],
      clipIndex: 0,
      elapsed: 0,
      period: DEBUG_CYCLE_PERIOD_S
    })
  }

  if (tag !== undefined) {
    tag(chef)
    tag(clickEntity)
    tag(bubble)
    tag(text)
  }

  return { chef, clickEntity, dialogBubbleEntity: bubble, dialogTextEntity: text }
}

// Speech bubble plane floating above the chef's head. Billboarded
// around Y so the parchment always faces the camera horizontally; the
// TextShape is parented + inverse-scaled so glyphs render at natural
// aspect despite the bubble's non-uniform stretch.
function buildChefDialogBubble(
  chef: Entity,
  initialText: string
): { bubble: Entity; text: Entity } {
  const bubble = engine.addEntity()
  Transform.create(bubble, {
    parent: chef,
    position: Vector3.create(0.25, CHEF_DIALOG_LIFT + CHEF_DIALOG_HEIGHT / 2, 0),
    scale: Vector3.create(CHEF_DIALOG_WIDTH, CHEF_DIALOG_HEIGHT, 1)
  })
  MeshRenderer.setPlane(bubble)
  Billboard.create(bubble, { billboardMode: BillboardMode.BM_Y })
  Material.setBasicMaterial(bubble, {
    texture: Material.Texture.Common({
      src: CHEF_DIALOG_TEXTURE,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      wrapMode: TextureWrapMode.TWM_CLAMP
    }),
    alphaTest: 0.5,
    castShadows: false
  })

  const text = engine.addEntity()
  Transform.create(text, {
    parent: bubble,
    position: Vector3.create(0, 0.05, -0.02),
    scale: Vector3.create(1 / CHEF_DIALOG_WIDTH, 1 / CHEF_DIALOG_HEIGHT, 1)
  })
  TextShape.create(text, {
    text: initialText,
    fontSize: CHEF_DIALOG_FONT_SIZE * (isMobile() ? CHEF_DIALOG_MOBILE_TEXT_SCALE : 1),
    lineSpacing: 1.1,
    textColor: Color4.create(0, 0, 0, 1),
    outlineWidth: 0,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })

  return { bubble, text }
}
