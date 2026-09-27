import { AvatarMask } from '@dcl/sdk/ecs'
import { triggerSceneEmote } from '~system/RestrictedActions'
import { isMultiplayer } from './multiplayerState'

// Gestures played on our own avatar. We never see them (the scene forces
// first person), but the explorer broadcasts them over comms so crewmates do.
// Upper-body mask keeps the legs free, so walking does not cancel the gesture.
export type AvatarEmote = 'throw' | 'swingWeaponOneHand' | 'openChest'

// Bundled copies of the catalyst's base-scene-emotes, played as scene emotes rather
// than `triggerEmote` predefined ones: Bevy Web broadcasts predefined emotes as
// `base-scene-emotes:<id>` URNs, which Godot clients drop
// (decentraland/godot-explorer#2986). Scene-emote URNs play on both explorers.
const EMOTE_SRC: Record<AvatarEmote, string> = {
  throw: 'assets/scene/emotes/throw_emote.glb',
  swingWeaponOneHand: 'assets/scene/emotes/swingWeaponOneHand_emote.glb',
  openChest: 'assets/scene/emotes/openChest_emote.glb'
}

const COOLDOWN_MS = 800
let lastAt = 0

export function playAvatarEmote(emote: AvatarEmote): void {
  const now = Date.now()
  if (!isMultiplayer() || now - lastAt < COOLDOWN_MS) return
  lastAt = now
  void triggerSceneEmote({ src: EMOTE_SRC[emote], loop: false, mask: AvatarMask.AM_UPPER_BODY }).catch(() => {})
}
