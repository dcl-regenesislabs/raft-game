import {
  AvatarAnchorPointType,
  AvatarAttach,
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  PlayerIdentityData,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isStateSyncronized } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import {
  HOOK_GRAVITY,
  HOOK_MAX_FLIGHT_TIME_S,
  HOOK_REEL_DESPAWN_RADIUS_XZ,
  HOOK_REEL_SPEED,
  HOOK_REEL_WOBBLE_SCALE,
  HOOK_WOBBLE_AMPLITUDE_DEG,
  HOOK_WOBBLE_FREQ
} from '../config/gameConfig'
import { HOOK_FORWARD_ROTATION, createHookEntity } from '../factories/hook'
import { HELD_ITEMS, HeldItemKind, isHeldViewmodelHidden } from '../factories/heldItem'
import { createRopeEntity, updateRopeBetween } from '../factories/rope'
import { WATER_LEVEL } from '../factories/sceneLevels'
import { AVATAR_PRESENCE_MAX_BYTES, AvatarCast, AvatarPresence, sanitizeAvatarPresence } from '../multiplayer/avatars'
import { worldRoom } from '../shared/messages'
import { getLocalRodCast } from '../systems/fishingRod'
import { getLocalHookCast } from '../systems/hookThrower'
import { getSelectedSlot, getSlotItem } from '../ui/inventoryState'
import { getItem } from '../ui/items'
import { RAD_TO_DEG } from '../utils/math'
import { computeWobble } from '../utils/wobble'
import { getMultiplayerPlayer, isMultiplayer, multiplayerReady } from './multiplayerState'

// Crewmate presence: we publish what we hold and our live cast; for everyone else we
// attach their held tool to their avatar's right hand and replay their hook/rod casts.

const SEND_MIN_MS = 150
const KEEPALIVE_MS = 1500
const REMOTE_STALE_MS = 7000
const REMOTE_CAST_MAX_S = 120

// Pose relative to the avatar's right-hand bone. Bone axes differ from the camera
// viewmodel, so these are tuned independently of HELD_ITEMS.
type Pose = { position: Vector3; rotation: Quaternion; scale: Vector3 }
const pose = (scale: number, pitch = 0, yaw = 0, roll = 0, y = 0): Pose => ({
  position: Vector3.create(0, y, 0),
  rotation: Quaternion.fromEulerDegrees(pitch, yaw, roll),
  scale: Vector3.create(scale, scale, scale)
})
// The hand bone's +Y runs along the fingers (down with relaxed arms), so the hook/anchor
// shaft (+Y) hangs point-down, the hammer head (-Y) sits on top and the rod tip (-X) points up.
const REMOTE_HELD_POSES: Record<HeldItemKind, Pose> = {
  hook: pose(0.3, 0, 0, 0, 0.05),
  hammer: pose(0.3, 0, 0, 0),
  spear: pose(0.5, 0, 0, 0),
  fishingRod: pose(0.45, 0, 0, 90),
  anchor: pose(0.3, 0, 0, 0, 0.05),
  food: pose(0.25, 0, 90, 0, 0.05),
  cup: pose(0.25, 0, 90, 0, 0.05)
}
const HOOK_ROPE_COLOR = Color4.create(0.55, 0.45, 0.15, 1)
const ROD_LINE_COLOR = Color4.create(0.541, 0.353, 0.051, 1)

type RemoteCast = {
  id: number
  tool: AvatarCast['tool']
  hook: Entity
  rope: Entity
  velocity: Vector3
  phase: 'flying' | 'floating' | 'reeling'
  elapsed: number
}
type Remote = {
  presence: AvatarPresence
  seenAt: number
  held: { id: string; root: Entity; model: Entity } | null
  cast: RemoteCast | null
  lastCastId: number
}

export function initAvatarPresence(): void {
  const remotes = new Map<string, Remote>()
  let lastPayload = '',
    lastSentAt = 0

  worldRoom.onMessage('worldAvatars', (data) => {
    const self = localAddress()
    try {
      const entries = JSON.parse(data.payload)
      if (!Array.isArray(entries)) return
      for (const entry of entries) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue
        const address = entry[0].toLowerCase()
        const presence = sanitizeAvatarPresence(entry[1])
        if (!presence || address === self) continue
        const remote = remotes.get(address)
        if (remote) {
          remote.presence = presence
          remote.seenAt = Date.now()
        } else remotes.set(address, { presence, seenAt: Date.now(), held: null, cast: null, lastCastId: 0 })
      }
    } catch {
      /* cosmetic data; a malformed relay packet is simply skipped */
    }
  })

  engine.addSystem((dt) => {
    if (!isMultiplayer()) return
    publish()
    renderRemotes(dt)
  })

  function publish(): void {
    const now = Date.now()
    if (!multiplayerReady() || !isStateSyncronized()) return
    const payload = JSON.stringify(localPresence())
    if (payload.length > AVATAR_PRESENCE_MAX_BYTES) return
    const changed = payload !== lastPayload
    if ((changed && now - lastSentAt >= SEND_MIN_MS) || now - lastSentAt >= KEEPALIVE_MS) {
      lastPayload = payload
      lastSentAt = now
      void worldRoom.send('worldAvatar', { payload }).catch(() => {})
    }
  }

  function renderRemotes(dt: number): void {
    const avatars = new Map<string, { entity: Entity; id: string }>()
    for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
      avatars.set(identity.address.toLowerCase(), { entity, id: identity.address })
    }
    const now = Date.now()
    const height = handHeight()
    for (const [address, remote] of remotes) {
      const avatar = avatars.get(address)
      if (now - remote.seenAt > REMOTE_STALE_MS || !avatar) {
        disposeHeld(remote)
        disposeCast(remote)
        if (now - remote.seenAt > REMOTE_STALE_MS) remotes.delete(address)
        continue
      }
      syncHeld(remote, avatar.id)
      const cast = remote.presence.cast
      if (cast && cast.id !== remote.lastCastId) {
        disposeCast(remote)
        remote.lastCastId = cast.id
        remote.cast = startCast(cast)
      }
      const hand = handPosition(avatar.entity, height, remote.cast?.tool === 'rod')
      if (remote.cast && hand) advanceCast(remote, hand, dt)
      // The hook itself is the projectile, so the hand is empty while it is out.
      if (remote.held) setVisible(remote.held.model, !(remote.cast && remote.cast.tool === 'hook'))
    }
  }
}

function localAddress(): string {
  return (getPlayer()?.userId ?? '').toLowerCase()
}

function localPresence(): AvatarPresence {
  const dead = getMultiplayerPlayer()?.dead ?? false
  const held = dead || isHeldViewmodelHidden() ? '' : (getSlotItem(getSelectedSlot())?.id ?? '')
  const hook = getLocalHookCast()
  const rod = getLocalRodCast()
  const round = (v: Vector3) => ({
    x: Math.round(v.x * 100) / 100,
    y: Math.round(v.y * 100) / 100,
    z: Math.round(v.z * 100) / 100
  })
  let cast: AvatarCast | null = null
  if (hook)
    cast = {
      id: hook.id,
      tool: 'hook',
      phase: hook.reeling ? 'reeling' : 'flying',
      origin: round(hook.origin),
      velocity: round(hook.velocity)
    }
  else if (rod)
    cast = { id: rod.id, tool: 'rod', phase: rod.phase, origin: round(rod.origin), velocity: round(rod.velocity) }
  return { held, cast }
}

function syncHeld(remote: Remote, avatarId: string): void {
  const id = remote.presence.held
  if (remote.held?.id === id) return
  disposeHeld(remote)
  const def = id ? getItem(id) : undefined
  const kind = def?.heldKind
  if (!def || !kind) return
  const root = engine.addEntity()
  Transform.create(root)
  AvatarAttach.create(root, { avatarId, anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })
  const model = engine.addEntity()
  Transform.create(model, { parent: root, ...REMOTE_HELD_POSES[kind] })
  const sprite = (kind === 'food' || kind === 'cup') && !def.glb
  if (sprite) {
    MeshRenderer.setPlane(model)
    Material.setPbrMaterial(model, {
      texture: Material.Texture.Common({ src: def.texture }),
      emissiveTexture: Material.Texture.Common({ src: def.texture }),
      emissiveColor: Color3.White(),
      emissiveIntensity: 1,
      albedoColor: Color4.create(0, 0, 0, 1),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
      alphaTest: 0.5,
      castShadows: false
    })
  } else {
    GltfContainer.create(model, { src: def.glb || HELD_ITEMS[kind].src })
    GltfNodeModifiers.create(model, { modifiers: [{ path: '', castShadows: false }] })
  }
  remote.held = { id, root, model }
}

function disposeHeld(remote: Remote): void {
  if (!remote.held) return
  engine.removeEntity(remote.held.model)
  engine.removeEntity(remote.held.root)
  remote.held = null
}

function startCast(cast: AvatarCast): RemoteCast {
  const hook = createHookEntity()
  Transform.getMutable(hook).position = Vector3.create(cast.origin.x, cast.origin.y, cast.origin.z)
  const rope = createRopeEntity(cast.tool === 'rod' ? ROD_LINE_COLOR : HOOK_ROPE_COLOR)
  return {
    id: cast.id,
    tool: cast.tool,
    hook,
    rope,
    velocity: Vector3.create(cast.velocity.x, cast.velocity.y, cast.velocity.z),
    phase: 'flying',
    elapsed: 0
  }
}

function disposeCast(remote: Remote): void {
  if (!remote.cast) return
  engine.removeEntity(remote.cast.hook)
  engine.removeEntity(remote.cast.rope)
  remote.cast = null
}

// Same ballistic/reel model as the local hook and rod, driven by the sender's phase.
function advanceCast(remote: Remote, hand: Vector3, dt: number): void {
  const cast = remote.cast!
  const live = remote.presence.cast?.id === cast.id ? remote.presence.cast : null
  cast.elapsed += dt
  if (cast.elapsed > REMOTE_CAST_MAX_S) return disposeCast(remote)
  const t = Transform.getMutable(cast.hook)
  const pos = t.position
  const toHand = { x: hand.x - pos.x, z: hand.z - pos.z }
  let wobble = computeWobble(cast.elapsed, HOOK_WOBBLE_FREQ, HOOK_WOBBLE_AMPLITUDE_DEG, HOOK_REEL_WOBBLE_SCALE)
  if (cast.phase === 'flying') {
    cast.velocity = Vector3.create(cast.velocity.x, cast.velocity.y - HOOK_GRAVITY * dt, cast.velocity.z)
    const next = Vector3.create(
      pos.x + cast.velocity.x * dt,
      pos.y + cast.velocity.y * dt,
      pos.z + cast.velocity.z * dt
    )
    if (next.y <= WATER_LEVEL || cast.elapsed > HOOK_MAX_FLIGHT_TIME_S) {
      next.y = WATER_LEVEL
      cast.phase = cast.tool === 'hook' ? 'reeling' : 'floating'
    }
    t.position = next
    wobble = computeWobble(cast.elapsed, HOOK_WOBBLE_FREQ, HOOK_WOBBLE_AMPLITUDE_DEG)
  } else if (cast.phase === 'floating') {
    if (!live || live.phase === 'reeling') cast.phase = 'reeling'
    else if (live.phase === 'biting')
      wobble = computeWobble(cast.elapsed, HOOK_WOBBLE_FREQ * 1.5, HOOK_WOBBLE_AMPLITUDE_DEG * 1.6)
  } else {
    const distance = Math.hypot(toHand.x, toHand.z)
    if (distance < HOOK_REEL_DESPAWN_RADIUS_XZ) return disposeCast(remote)
    const step = Math.min(HOOK_REEL_SPEED * dt, distance)
    t.position = Vector3.create(pos.x + (toHand.x / distance) * step, WATER_LEVEL, pos.z + (toHand.z / distance) * step)
  }
  t.rotation = heading(toHand.x, toHand.z, wobble)
  updateRopeBetween(cast.rope, hand, t.position, cast.tool === 'rod' ? 0.012 : 0.03)
}

function heading(dx: number, dz: number, wobble: { x: number; y: number; z: number }): Quaternion {
  const yaw = Quaternion.fromEulerDegrees(0, Math.atan2(dx, dz) * RAD_TO_DEG, 0)
  return Quaternion.multiply(
    Quaternion.multiply(yaw, HOOK_FORWARD_ROTATION),
    Quaternion.fromEulerDegrees(wobble.x, wobble.y, wobble.z)
  )
}

// Our own eye height over the avatar origin, reused as a proxy for crewmates' hands.
function handHeight(): number {
  const cam = Transform.getOrNull(engine.CameraEntity)
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!cam || !player) return 1.2
  return Math.min(2, Math.max(0.6, cam.position.y - player.position.y - 0.45))
}

// Approximate right hand (or rod tip) of a crewmate; AvatarAttach positions are not readable.
function handPosition(avatar: Entity, height: number, rodTip: boolean): Vector3 | null {
  const t = Transform.getOrNull(avatar)
  if (!t) return null
  const right = Vector3.rotate(Vector3.Right(), t.rotation)
  const forward = Vector3.rotate(Vector3.Forward(), t.rotation)
  const up = rodTip ? height + 0.9 : height
  const ahead = rodTip ? 0.6 : 0.25
  return Vector3.create(
    t.position.x + right.x * 0.3 + forward.x * ahead,
    t.position.y + up,
    t.position.z + right.z * 0.3 + forward.z * ahead
  )
}

function setVisible(entity: Entity, visible: boolean): void {
  if ((VisibilityComponent.getOrNull(entity)?.visible ?? true) === visible) return
  VisibilityComponent.createOrReplace(entity, { visible })
}
