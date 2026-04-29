# Step 04 — Casting Mechanic

## Goal
Implement the full cast: tap-and-hold powers a meter, releasing launches the bobber on a parabolic arc, and the landing tier (close / mid / deep) is recorded for later steps to consume.

## Why this step exists here
- **It's the first input-driven mechanic.** Every later mechanic re-uses this pattern: read pointer state, drive a UI meter, transition to a new game state on release.
- **Tweens are the SDK 7 idiom for procedural motion.** Getting the bobber arc working through `Tween` validates we don't need a physics engine for the rest of the game.
- **The landing tier is the seed of the fish-pool roll.** Step 08 reads it; every cast feels different because of it.

## Depends on
- Step 03 (we only allow casting while the player is inside a zone, i.e. `PlayerState.currentZone != null`).

## Adds
- A `CastState` singleton carrying the cast's lifecycle: `idle | charging | flying | landed`, the power value (0..1), and the resolved `landingTier` (`close | mid | deep`).
- A `CastingSystem` that handles the input state machine and updates the power meter value while charging.
- The **power meter UI** (sourced in Step 01) bound to `CastState.power` — three bands (red / yellow / green), oscillating marker, only rendered while `state == charging`.
- A `Bobber` component + entity that, on release, tweens from the rod tip to a target landing position over ~0.8 seconds.
- A simple ripple/splash placeholder on landing (re-use the splash sprite from Step 01 — a 1-frame static decal is fine; real particles come in Step 16).

## Out of scope
- Bite, hook, reel (Steps 05–06).
- Picking the actual fish — the cast just records `landingTier`.
- Rod stats affecting cast power (Step 11 wires that — for now all casts use the Twig defaults).
- Audio for cast/splash beyond the placeholders from Step 01 (Step 15 polishes).

## Acceptance criteria
1. Pressing-and-holding while inside a zone shows the power meter; releasing while charging launches the bobber.
2. The bobber follows a visible parabolic arc and lands within the pond — never on the dock, never out of bounds.
3. Holding longer biases the marker toward the green band; the landing tier matches the band the marker was in at release.
4. `landingTier` is one of `close` / `mid` / `deep` after every cast and is logged (console for now).
5. Tapping outside a zone does nothing — no power meter, no bobber.
6. Tapping again while a cast is in flight is ignored — the state machine rejects it.
7. Mobile preview: the entire cast is doable with one thumb, no stuck states after a release.

## Implementation notes (no code)

State machine for `CastState.phase`:

```
idle ─── (pointer-down inside zone) ──► charging
charging ─── (pointer-up) ──► flying
flying ─── (tween complete) ──► landed
landed ─── (Step 05 takes over here) ──► …

idle ─── (pointer-down outside zone) ──► idle  (ignored)
charging ─── (pointer-down again) ──► charging  (ignored, no double-charge)
```

Concepts:

- **Power oscillation.** While `phase == charging`, advance an internal `phase` (sorry, name collision — call it `meterPhase`) 0→1→0 via a triangle wave. The power at release is whatever value the wave is currently at. This produces the "stop the marker on green" feel without floating-point noise.
- **Landing tier mapping.** `power < 0.33 → close`, `0.33–0.66 → mid`, `≥ 0.66 → deep`. Constants live next to the data — they will be tuned, do not bury them.
- **Bobber trajectory.** Compute the target landing position from the player's facing direction × a base distance scaled by power. Then use SDK 7 `Tween.create(...)` with `TweenType.Move` over ~0.8 s. Easing: ease-out so the bobber decelerates into the splash. SDK 7 tween events fire `onTweenCompleted` — that's our transition to `landed`.
- **Pointer input.** Use SDK 7's `PointerEvents` with primary button down/up events on a global "input capture" entity (or directly on the player). The hold/release pair drives the state machine.
- **UI.** Power meter is a `<UiEntity>` rendered only when `phase == charging`. Marker position is a percentage = current `meterPhase`. The three colored bands are static images from Step 01.

Pseudo-flow for the system:

```
CastingSystem(dt):
    state = CastState.getMutable()
    switch state.phase:
        case idle:
            if pointer.justPressed and PlayerState.currentZone != null:
                state.phase = charging
                state.meterPhase = 0
                state.meterDirection = +1
        case charging:
            // triangle wave 0→1→0
            state.meterPhase += state.meterDirection * dt * METER_SPEED
            if state.meterPhase >= 1: state.meterDirection = -1
            if state.meterPhase <= 0: state.meterDirection = +1
            state.power = state.meterPhase
            if pointer.justReleased:
                state.landingTier = tierFromPower(state.power)
                spawn bobber, start tween to target
                state.phase = flying
        case flying:
            // Tween fires onComplete → handler sets state.phase = landed
        case landed:
            // wait — Step 05 picks up here
```

UI render-time:

```
if CastState.phase == charging:
    render <PowerMeter value={CastState.power} />
```

## Risks for this step

| Risk                                                   | Mitigation                                                                                                |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Bobber lands outside the pond                          | Cap target distance using parcel bounds + the pond's known footprint; clamp before tweening.              |
| Pointer-up missed because player walked away mid-charge | Add a 5-second timeout on `charging`; if exceeded, force release with the current power.                 |
| Triangle wave feels jittery on mobile                  | Time-step it on dt (already in pseudo-code) rather than frame counts. Confirm at 30 vs 60 FPS.            |
| Cast feels too easy / too hard                         | Tune `METER_SPEED` empirically with the team; locked numbers go into a `tuning.ts`-style constants module. |

## When this step is done
Open `plan/05-bite-and-hook.md`.
