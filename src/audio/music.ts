import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

export type MusicTrack = 'lobby' | 'game'

const TRACK_CLIPS: Record<MusicTrack, string> = {
  lobby: 'assets/nix.mp3',
  game: 'assets/mar.mp3'
}

const MUSIC_VOLUME = 0.15

let musicEntity: Entity | null = null
let currentTrack: MusicTrack | null = null
let pendingTrack: MusicTrack | null = null
let muted = false

function ensureMusicEntity(): Entity {
  if (musicEntity !== null) return musicEntity
  musicEntity = engine.addEntity()
  Transform.create(musicEntity, {
    position: Vector3.create(0, 0, 0),
    parent: engine.PlayerEntity
  })
  AudioSource.create(musicEntity, {
    audioClipUrl: '',
    playing: false,
    loop: true,
    volume: MUSIC_VOLUME
  })
  return musicEntity
}

export function setMusicTrack(track: MusicTrack): void {
  if (track === currentTrack && pendingTrack === null) return
  ensureMusicEntity()
  if (musicEntity !== null) {
    AudioSource.getMutable(musicEntity).playing = false
  }
  pendingTrack = track
}

export function isMusicMuted(): boolean {
  return muted
}

export function setMusicMuted(value: boolean): void {
  muted = value
  if (musicEntity === null) return
  const audio = AudioSource.getMutable(musicEntity)
  if (muted) {
    audio.playing = false
  } else if (currentTrack !== null) {
    audio.playing = true
  }
}

export function toggleMusicMuted(): void {
  setMusicMuted(!muted)
}

export function resetMusicState(): void {
  musicEntity = null
  currentTrack = null
  pendingTrack = null
}

export function musicTickSystem(_dt: number): void {
  if (pendingTrack !== null && musicEntity !== null) {
    const audio = AudioSource.getMutable(musicEntity)
    audio.audioClipUrl = TRACK_CLIPS[pendingTrack]
    audio.playing = !muted
    currentTrack = pendingTrack
    pendingTrack = null
  }
}
