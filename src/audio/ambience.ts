import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

const OCEAN_CLIP = 'assets/Audio/CoastalWavesOnRocksLoop.mp3'
const AMBIENCE_VOLUME = 0.18

let ambienceEntity: Entity | null = null
let shouldPlay = false
let pendingStart = false

function ensureAmbienceEntity(): Entity {
  if (ambienceEntity !== null) return ambienceEntity
  ambienceEntity = engine.addEntity()
  Transform.create(ambienceEntity, {
    position: Vector3.create(0, 0, 0),
    parent: engine.PlayerEntity
  })
  AudioSource.create(ambienceEntity, {
    audioClipUrl: OCEAN_CLIP,
    playing: false,
    loop: true,
    volume: AMBIENCE_VOLUME
  })
  return ambienceEntity
}

export function startAmbience(): void {
  ensureAmbienceEntity()
  shouldPlay = true
  pendingStart = true
}

export function stopAmbience(): void {
  shouldPlay = false
  pendingStart = false
  if (ambienceEntity === null) return
  AudioSource.getMutable(ambienceEntity).playing = false
}

export function resetAmbienceState(): void {
  ambienceEntity = null
  shouldPlay = false
  pendingStart = false
}

export function ambienceTickSystem(_dt: number): void {
  if (!pendingStart || ambienceEntity === null) return
  const audio = AudioSource.getMutable(ambienceEntity)
  audio.audioClipUrl = OCEAN_CLIP
  audio.playing = shouldPlay
  pendingStart = false
}
