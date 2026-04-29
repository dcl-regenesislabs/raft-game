# Step 05 — Bite & Hook Phase

## Goal
After the bobber lands, run the wait timer with the optional shake taps, surface the "!" hook prompt, and resolve the player's tap as a hooked-fish or escaped-fish outcome.

## Why this step exists here
- **It's the bridge between cast and reel.** Without it, casting and reeling are two disconnected mechanics.
- **The shake interaction is the GDD's main retention beat during the wait** (§4.2). Implementing it now ensures the wait never feels dead.
- **Hook timing tunes the entire game's reaction-feel.** Locking the 1.2 s window early prevents accidental harshness later.

## Depends on
- Step 04 (cast lands and produces `CastState.phase == landed`).

## Adds
- A `BiteState` singleton: `idle | waiting | hookable | escaped | hooked`, plus `waitRemaining` and `hookWindowRemaining` timers.
- A `BiteSystem` that consumes the `landed` cast state, picks a random wait time in `[3, 8]` seconds, and runs the timer.
- The **shake prompt** UI (sourced Step 01) — visible while `phase == waiting`. Each tap shaves ~0.5 s off `waitRemaining`, with a minimum floor of 0.5 s remaining (so you can't insta-skip).
- The **"!" prompt** UI — visible while `phase == hookable`, with the alerting bite SFX from Step 01.
- A clean transition out: on hook, the system advances to `hooked` (Step 06 picks up); on miss/escape, the system resets to `idle` and the player can re-cast.

## Out of scope
- The reel minigame itself (Step 06).
- Rod stats affecting wait time (Step 11). Wait range stays at 3–8 s for everyone here.
- Different bite behavior per fish (Step 08 introduces fish difficulty profiles; bite remains uniform here).

## Acceptance criteria
1. After a cast lands, the shake prompt appears within one frame.
2. Tapping the shake prompt visibly reduces the wait timer; spamming taps gets you to a bite faster but never instantly.
3. When the timer expires, the "!" prompt appears, the bite SFX plays, and the player has 1.2 s to tap.
4. Tapping during the 1.2 s window transitions to `hooked`; missing transitions to `escaped` with no penalty (no UI scolds the player).
5. After `escaped`, the bobber despawns and `CastState` resets to `idle`, allowing a new cast.
6. State machine never deadlocks — if the player walks away, a 30 s safety timeout returns everything to `idle`.

## Implementation notes (no code)

State machine:

```
idle ─── (CastState.phase == landed) ──► waiting
waiting ─── (waitRemaining ≤ 0) ──► hookable
hookable ─── (pointer-down within window) ──► hooked        // Step 06 picks up
hookable ─── (window expires) ──► escaped ──► idle
waiting ─── (safety timeout) ──► escaped ──► idle
```

Concepts:

- **`BiteSystem` runs every frame.** It decrements timers and resolves the state.
- **Shake taps**: reading "did the player tap *this frame*" requires a discrete input source — store the last-frame's pointer state and detect the rising edge. Tapping the shake prompt specifically is fine, but the simpler design is "any tap during waiting counts as a shake". Do the simpler design first.
- **Hook input**: the same pointer-down detection used for shake. The state distinguishes them — taps during `waiting` shave time, taps during `hookable` set the hook.
- **Escape is silent**: the GDD is explicit that there's no penalty for missing. Play a soft "fwip" sound (Step 01), no modal, no message.
- **Bobber despawn on transition out**: when entering `escaped`, also remove the bobber entity created in Step 04. When entering `hooked`, leave the bobber visually in place — Step 06 may use it for tension visuals.
- **Audio**: bite tug SFX on `waiting → hookable`, hook miss SFX on `hookable → escaped`. No SFX on shake tap (Step 15 may add one if it feels empty).

Pseudo-flow:

```
BiteSystem(dt):
    bite = BiteState.getMutable()
    cast = CastState.get()

    if bite.phase == idle and cast.phase == landed:
        bite.phase = waiting
        bite.waitRemaining = random(3, 8)

    elif bite.phase == waiting:
        bite.waitRemaining -= dt
        if pointer.justPressed:
            bite.waitRemaining = max(bite.waitRemaining - 0.5, 0.5)
        if bite.waitRemaining <= 0:
            bite.phase = hookable
            bite.hookWindowRemaining = 1.2
            play bite SFX

    elif bite.phase == hookable:
        bite.hookWindowRemaining -= dt
        if pointer.justPressed:
            bite.phase = hooked          // Step 06 takes over
        elif bite.hookWindowRemaining <= 0:
            play hook-miss SFX
            despawn bobber
            CastState.reset()
            bite.phase = idle
```

UI render-time:

```
if BiteState.phase == waiting: render <ShakePrompt />
if BiteState.phase == hookable: render <HookExclamation />
```

## Risks for this step

| Risk                                                 | Mitigation                                                                                                  |
|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Shake taps feel ineffective                          | Show a small visual nudge per tap (the prompt pulses). Step 16 enhances; a one-liner Color animation is fine. |
| 1.2 s window is too tight on mobile                  | Tune empirically with two playtesters. The number is in the constants module so it's a one-line change.    |
| Pointer-down on the shake prompt double-fires        | Detect rising-edge only (`justPressed` = pressed-this-frame and not pressed-last-frame).                   |
| Walking away mid-wait strands the state              | The safety 30 s timeout already covers it; verify with a deliberate test.                                  |

## When this step is done
Open `plan/06-reel-minigame.md`.
