# Step 06 — Reel Minigame

## Goal
Implement the vertical reel bar minigame: a fish target drifts up and down, the player holds to lift their zone band against gravity, and the progress bar fills when the band overlaps the fish. Win = catch; drain = escape.

## Why this step exists here
- **This is the skill check the entire game is judged on.** GDD §4.3 calls it "the heart of the game". If it doesn't feel great, nothing else matters.
- **It's the most-tuned mechanic.** Locking it in place now gives Steps 08, 11 (fish profiles, rods) something concrete to modulate, instead of designing modulators for an unknown base.
- **It exercises the SDK7 input-as-state pattern at its hardest.** A continuous hold drives a continuous force; getting it right validates the input model for everything later.

## Depends on
- Step 05 (`BiteState.phase == hooked` is the entry condition).

## Adds
- A `ReelState` singleton: `idle | active | won | lost`, plus `progress` (0..1), `fishY` (0..1), `playerY` (0..1), `playerVelocity`, and a `perfect` flag (true if `progress` never decreased during the run).
- A `ReelSystem` that runs the simulation each frame: fish AI, player physics, overlap test, progress update.
- The **reel minigame UI** (sourced Step 01): vertical bar background, fish icon at `fishY`, player band at `playerY` with height = current zone size, horizontal progress bar at the bottom.
- Win/lose resolution that hands off to Step 07 (`won` → catch, `lost` → escape, both reset bite/cast for the next cast).
- A `ReelTuning` constants module exposing the four difficulty knobs from GDD §4.3: `fishSpeed`, `fishRandomness`, `playerZoneSize`, `progressDrainRate`. Step 08 reads from fish, Step 11 reads from rod — but here, defaults live for the single-fish vertical slice.

## Out of scope
- Tying difficulty to the actual fish (Step 08).
- Tying it to the rod (Step 11).
- Audio polish (Step 15) — basic Step 01 reel-tension loop is hooked up here, but pitch-with-progress is later.
- The "Perfect!" celebration UI (Step 16). The flag is set; the screen treatment is later.

## Acceptance criteria
1. Entering this state shows the reel UI as a full-screen overlay; pointer hold lifts the player band, release lets it fall.
2. The fish target moves up and down at a believable speed — random but trackable, not jittery.
3. The progress bar fills only while the player band overlaps the fish target; it drains otherwise.
4. Reaching `progress >= 1` transitions to `won`; reaching `progress <= 0` transitions to `lost`.
5. On `won`, the reel UI hides and the catch hand-off happens (Step 07 listens). On `lost`, same hand-off but to the escape path.
6. The minigame is fully playable on mobile with one thumb anywhere on screen — no precision required.
7. With default tuning the win rate for an attentive player is roughly 80 %. (Hand-tuned, not measured precisely.)

## Implementation notes (no code)

Coordinates: the bar goes from `0` (bottom) to `1` (top). Both `fishY` and `playerY` are normalized.

**Fish AI** — pick a target Y inside `[0, 1]`, drift toward it at `fishSpeed`. When close enough (or after a randomized hold time), pick a new target. Higher `fishRandomness` = shorter hold + larger jumps + faster speed variance.

**Player physics** — held: positive acceleration up. Released: gravity pulls down. Clamp `playerY` to `[0, 1]`. Velocity damping prevents the band from oscillating violently. The band has a *height* (`playerZoneSize`); the band's bounds are `[playerY - h/2, playerY + h/2]`.

**Overlap test** — `inside = fishY ∈ [playerY - h/2, playerY + h/2]`. Use that flag to decide fill vs. drain.

**Progress** — when inside: `progress += fillRate * dt`. Otherwise: `progress -= drainRate * dt`. Clamp to `[0, 1]`. Set `perfect = false` the first time progress decreases. Resolve at extremes.

Pseudo-flow:

```
ReelSystem(dt):
    reel = ReelState.getMutable()

    if reel.phase == idle and BiteState.phase == hooked:
        reel.phase = active
        reset progress to 0.5, fishY to 0.5, playerY to 0.5, perfect = true
        play reel-tension loop

    if reel.phase != active: return

    // fish AI
    update fish drift toward current target with fishSpeed + jitter
    if reached target or hold elapsed: pick new target

    // player physics
    if pointer.held:
        playerVelocity += LIFT_ACCEL * dt
    playerVelocity -= GRAVITY * dt
    playerVelocity *= DAMPING
    playerY = clamp(playerY + playerVelocity * dt, 0, 1)

    // overlap and progress
    inside = abs(fishY - playerY) <= playerZoneSize / 2
    if inside:
        reel.progress += FILL_RATE * dt
    else:
        previous = reel.progress
        reel.progress -= drainRate * dt
        if reel.progress < previous: reel.perfect = false

    reel.progress = clamp(reel.progress, 0, 1)

    if reel.progress >= 1:
        reel.phase = won
        stop reel-tension loop
        // Step 07 picks up
    elif reel.progress <= 0:
        reel.phase = lost
        stop reel-tension loop
        // Step 07's escape branch picks up
```

UI render-time:

```
if ReelState.phase == active:
    render <ReelOverlay
        fishY=ReelState.fishY
        playerY=ReelState.playerY
        zoneSize=playerZoneSize
        progress=ReelState.progress
    />
```

## Risks for this step

| Risk                                                                 | Mitigation                                                                                              |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Player band drops too fast or floats too slow                        | Tune `LIFT_ACCEL` and `GRAVITY` together so a casual hold-rhythm hovers near mid-bar. Empirical only.   |
| Fish AI feels mechanical (oscillation looks scripted)                | Add small per-frame noise to the velocity, not just the target. Two random sources beat one.            |
| Mobile pointer hold registers double events                          | Use the same rising-edge / continuous-hold detection from Step 04; reuse, don't re-implement.           |
| Progress oscillates at 0 or 1                                        | Clamp first, *then* compare. Done in pseudo-code above.                                                 |
| The minigame UI overlaps with DCL's bottom-left controls             | Place the bar on the right edge per GDD §6.3; verify on mobile.                                         |

## When this step is done
Open `plan/07-single-fish-catch-loop.md`. Vertical slice is one step away.
