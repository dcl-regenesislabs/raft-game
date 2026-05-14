import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const SFX_CLIPS = {
  inventoryOpen: 'assets/Audio/zipper.wav',
  inventoryClose: 'assets/Audio/zipper-reverse.wav',
  storageOpen: 'assets/Audio/chest-open.mp3',
  storageClose: 'assets/Audio/chest-close.mp3',
  craftOpen: 'assets/Audio/craft-short.wav',
  craftClose: 'assets/Audio/craft-short-reverse.wav',
  craftStart: 'assets/Audio/button-sound.mp3',
  hookThrow: 'assets/Audio/fireworklaunch.mp3',
  rodCast: 'assets/Audio/reel-flying.mp3',
  waterSplash: 'assets/Audio/water-splash.wav'
} as const

const LOOP_CLIPS = {
  reelPulling: 'assets/Audio/reel-pulling.mp3'
} as const

export type SfxId = keyof typeof SFX_CLIPS
export type LoopId = keyof typeof LOOP_CLIPS

// --- One-shot SFX ---

let sfxEntity: Entity | null = null
let pendingClip: string | null = null

function ensureSfxEntity(): Entity {
  if (sfxEntity !== null) return sfxEntity
  sfxEntity = engine.addEntity()
  Transform.create(sfxEntity, { position: Vector3.create(0, 0, 0), parent: engine.PlayerEntity })
  AudioSource.create(sfxEntity, {
    audioClipUrl: '',
    playing: false,
    loop: false,
    volume: 0.5
  })
  return sfxEntity
}

export function playSfx(id: SfxId): void {
  const entity = ensureSfxEntity()
  const audio = AudioSource.getMutable(entity)
  audio.playing = false
  pendingClip = SFX_CLIPS[id]
}

export function stopSfx(): void {
  if (sfxEntity === null) return
  AudioSource.getMutable(sfxEntity).playing = false
  pendingClip = null
}

// --- Looping sounds ---

let loopEntity: Entity | null = null
let activeLoop: string | null = null
let pendingLoop: string | null = null

function ensureLoopEntity(): Entity {
  if (loopEntity !== null) return loopEntity
  loopEntity = engine.addEntity()
  Transform.create(loopEntity, { position: Vector3.create(0, 0, 0), parent: engine.PlayerEntity })
  AudioSource.create(loopEntity, {
    audioClipUrl: '',
    playing: false,
    loop: true,
    volume: 0.4
  })
  return loopEntity
}

export function startLoop(id: LoopId): void {
  const clip = LOOP_CLIPS[id]
  if (clip === activeLoop) return
  const entity = ensureLoopEntity()
  const audio = AudioSource.getMutable(entity)
  audio.playing = false
  pendingLoop = clip
}

export function stopLoop(): void {
  if (activeLoop === null && pendingLoop === null) return
  if (loopEntity !== null) {
    AudioSource.getMutable(loopEntity).playing = false
  }
  activeLoop = null
  pendingLoop = null
}

// --- Tick system (handles both one-shot and loop deferred playback) ---

export function sfxTickSystem(_dt: number): void {
  if (pendingClip !== null && sfxEntity !== null) {
    const audio = AudioSource.getMutable(sfxEntity)
    audio.audioClipUrl = pendingClip
    audio.playing = true
    pendingClip = null
  }

  if (pendingLoop !== null && loopEntity !== null) {
    const audio = AudioSource.getMutable(loopEntity)
    audio.audioClipUrl = pendingLoop
    audio.playing = true
    activeLoop = pendingLoop
    pendingLoop = null
  }
}
