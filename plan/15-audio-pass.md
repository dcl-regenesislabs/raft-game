# Step 15 — Audio Pass

## Goal
Wire the full audio palette from Step 01 into the game so silence is replaced with the calm-mystical-pond vibe the GDD §8 specifies.

## Why this step exists here
- **Audio is the highest-leverage polish budget item.** GDD §8: "silence kills the vibe". A judge with sound on for two minutes is sold by the audio.
- **It's invisible until you remove it.** Wire it once, and every prior step retroactively feels three times more polished.
- **Now is when systems are stable.** Wiring audio earlier means re-wiring on every state-machine change. Doing it after Step 14 freezes the wiring exactly once.

## Depends on
- Steps 02–14. Every system that emits an audio event needs to be in its final state.

## Adds
- An `AudioController` module with a small API: `play(soundId)`, `playLoop(soundId)`, `stopLoop(soundId)`, `setLoopPitch(soundId, pitch)`, `setMusicVolume(0..1)`. SDK 7's `AudioSource` is the underlying primitive.
- The ambient bed loops continuously from scene start, mixed to ~40 % so SFX cut through.
- Cast / splash / bite / hook-miss SFX wired into Steps 04–07 transitions (was placeholder before).
- Reel tension loop while `ReelState.phase == active`, with **pitch tied to progress** — pitch rises as the player nears a catch.
- Catch jingles tier-mapped: Common = 1 note, Uncommon = 2, Rare = 3, Epic = 4, Legendary = arpeggio + sparkle.
- Sell SFX (was placeholder) on Step 10 actions. Purchase SFX on Step 11 actions.
- Zone-entry chime (Step 03) replaced with a softer per-zone tone — one for each of the three zones.
- Unlock chime on Step 12's gate-clearing — already added there; replaced with the proper asset.

## Out of scope
- Music progression (different track in The Deep) — stretch goal.
- Spatial 3D audio (panning, distance attenuation) — Decentraland's `AudioSource` supports it but it's overkill for a 16×16 m parcel.
- Voice acting / NPC voice clips.
- A user volume slider (DCL provides one; we don't need to duplicate).

## Acceptance criteria
1. Scene start: ambient bed audible within ~1 second, loops cleanly with no perceptible seam.
2. Casting: whoosh on release, splash on bobber landing, with proper timing offset.
3. Bite: clear "tug" SFX exactly when the "!" prompt appears.
4. Reel: tension loop only while reeling; pitch audibly rises with progress; loop stops cleanly on win/lose.
5. Catch jingles match rarity — Legendary catch is unmistakably bigger than a Common catch.
6. Sell SFX every sell, purchase SFX every rod buy, no double-fires.
7. No clipping, no audio spikes louder than the ambient bed (set ceilings during mix).
8. Total audio file size in the build ≤5 MB (GDD §8 budget).

## Implementation notes (no code)

**`AudioController`.** A thin wrapper over SDK 7's `AudioSource` component. Internally maintains a map of `soundId → entity` for any loops that need stop/start control. One-shots can be created-and-destroyed per play.

**Pitch-with-progress.** Map `ReelState.progress` to pitch via `pitch = 1.0 + 0.5 * progress` (1.0 → 1.5x). The reel system calls `setLoopPitch('reel-tension', mappedPitch)` each frame while active. When the loop stops, no further pitch adjustment is needed.

**Mix levels.** Set initial `volume` per category:
- Ambient: 0.4
- Reel loop: 0.7
- One-shot SFX: 0.8 (varies — coin clinks louder, soft "fwip" softer)
- Music elements (catch jingles): 0.9

These live as constants. Adjustable centrally without touching call sites.

**Where each audio event fires.** A short table for the implementer:

| Event                    | Step source       | Sound                     |
|--------------------------|-------------------|---------------------------|
| scene start              | main()            | ambient-bed (loop)        |
| cast pointer-up          | Step 04           | cast-whoosh               |
| bobber tween complete    | Step 04           | bobber-splash             |
| bite phase: hookable     | Step 05           | bite-tug                  |
| hook missed              | Step 05           | hook-miss                 |
| reel phase: active       | Step 06           | reel-tension (loop)       |
| reel won                 | Step 06           | catch-jingle-{rarity}     |
| reel lost                | Step 06           | got-away-soft-fwip        |
| sell                     | Step 09 / 10      | sell-coin-clink           |
| rod purchased            | Step 11           | purchase-success          |
| zone entered             | Step 03           | zone-chime-{id}           |
| zone unlocked            | Step 12           | unlock-celebration        |
| any UI button tap        | Steps 09–13       | ui-tap-soft               |

Wire each one at the existing transition point — do not add a new state machine just for audio.

Pseudo-flow:

```
AudioController.play(soundId):
    create transient entity with AudioSource(soundId, loop=false, volume=...)
    schedule cleanup after duration

AudioController.playLoop(soundId):
    if existing: ignore
    create persistent entity with AudioSource(soundId, loop=true, volume=...)
    store entity in loopMap

AudioController.stopLoop(soundId):
    destroy loopMap[soundId]
    delete loopMap[soundId]

ReelSystem each frame, while active:
    AudioController.setLoopPitch('reel-tension', 1.0 + 0.5 * ReelState.progress)
```

## Risks for this step

| Risk                                                       | Mitigation                                                                                                  |
|------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Ambient loop has audible seam                              | Source from a pack designed for looping; if not, crossfade in Audacity before importing.                     |
| Catch jingle plays during reel-tension fadeout (overlap)   | Acceptable; the jingle plays *after* tension stops. If not pleasant, add a 100 ms gap.                       |
| Mobile mix differs from desktop                            | Test both. Mobile speakers compress; bass-heavy SFX may be lost. Pick brighter alternatives if so.            |
| Audio file sizes blow the 5 MB budget                      | Re-encode at lower bitrate (96 kbps OGG mono is plenty); cut ambient bed to 20 s loop if 30 s overshoots.    |
| Pitch shift sounds chipmunky at high progress              | Cap at 1.4x rather than 1.5x; alternatively use volume rise instead of pitch.                                |

## When this step is done
Open `plan/16-ux-polish-and-onboarding.md`.
