# Step 16 — UX Polish & Onboarding

## Goal
Add the welcome popup, the in-zone tutorial nudges, and the "juice" — particles, screen shake, haptics, the Perfect-catch celebration — that turn a working game into one a judge remembers.

## Why this step exists here
- **The first 60 seconds decide everything** (GDD §5). Onboarding lives here, after every system is stable enough to teach.
- **Juice is multiplicative on perceived quality.** A 5 % bump in feel reads as a 20 % bump in polish. It's the highest-ROI work left.
- **It's the natural place to pull stretch UX off the backlog** — Perfect-catch UI, soft-rig hint, bestiary first-look — without conflating with audio (Step 15) or perf (Step 17).

## Depends on
- Steps 02–15. Every system the polish touches must be in its final shape.

## Adds
- **Welcome popup** (GDD §6.4): one-shot on first scene entry, "Catch fish, fill the bestiary, become a master angler", "Got it" tap-to-dismiss. Follows DCL's UX guidelines.
- **Tutorial prompts** at three key moments — the first time the player:
  1. Enters Lily Cove → "Tap & hold to cast" with a small thumb icon animation.
  2. Sees the "!" → "Tap to set the hook!" overlay for 800 ms (extra forgiveness on the first bite).
  3. Reels their first fish → a one-line tip near the bar: "Hold to lift, release to drop."
- **Soft-rigged first catch** (Step 07's flag) gets explicit visual feedback: the catch modal title for that first one is "Your first catch!" with a small celebratory frame.
- **Perfect-catch celebration**: when `ReelState.perfect == true` on win, the modal shows a "Perfect!" badge with a sparkle effect; price is +50 % (already speced GDD §4.3 — wire it now).
- **Particles**: bobber splash on water (small water droplets), rare-catch aura around the modal fish render, gentle pond bubbles ambient.
- **Screen shake** on Legendary catch — small kick (0.05 s, 2 px on UI, no movement of the player camera).
- **Haptics on mobile** (where SDK 7 supports it): hook-tap, catch-success, rod-purchase. Soft pulses, not buzzers.
- **Visual feedback on shake taps** (Step 05 risk callback): the prompt pulses scale on each tap.
- **HUD nudges**: bestiary button has a soft glow + arrow for 5 seconds the first time the player has anything to look at.

## Out of scope
- Stretch goals from GDD §11 (bait, weather, day/night, leaderboard, wearable reward).
- Onboarding for non-fishing actions (rod shop opens organically when the player walks to the merchant; no separate tutorial).
- Performance work (Step 17). Polish is allowed to add a small budget hit; Step 17 reclaims it.

## Acceptance criteria
1. First scene entry: welcome popup appears within 500 ms, dismisses cleanly, and never re-appears in the same session.
2. The three tutorial prompts each appear once and then never again, even if the same situation recurs.
3. First catch: title reads "Your first catch!"; subsequent catches use the normal title.
4. A run with no progress drops triggers the Perfect badge and credits +50 % Pearls.
5. Bobber splash particles render on landing without dropping FPS below 30.
6. Legendary catch produces a brief, tasteful screen-shake — not seasick.
7. Haptics on mobile fire on the three documented events; mute setting respected.
8. None of the polish overlaps with DCL's default UI (top bar, bottom-left controls).

## Implementation notes (no code)

**One-shot events.** Track a small `OnboardingFlags` singleton: `welcomeShown`, `firstZoneNudgeShown`, `firstHookNudgeShown`, `firstReelNudgeShown`, `bestiaryNudgeShown`. Persist these via Step 14 if Plan A is live; otherwise session-only. Each flag is set on first display, never unset.

**Soft-rigged first catch flag** (Step 07/08) is a separate flag and was already in scope; the visual treatment is what's added here.

**Particles.** Use SDK 7's particle support; if budget is tight, fall back to a 0.5 s alpha-tweened decal at the splash point (cheap, looks fine). Rare-catch aura: a glowing sprite behind the modal fish, gentle pulse.

**Screen shake on UI.** Don't move the camera (Decentraland breaks if you do). Move the *modal frame* 2 px in random directions for 0.1 s. The eye reads it as a kick.

**Haptics.** SDK 7 exposes a haptic hook on mobile-capable browsers. Wrap it in a guard — desktop / unsupported → no-op. Three events:
- Hook tap → light pulse
- Catch success → medium pulse
- Rod purchase → light pulse

**Tutorial prompt copy** lives in a single `tutorialCopy.ts` file. Designers can iterate text without touching gameplay code.

Pseudo-flow:

```
on scene start:
    if not OnboardingFlags.welcomeShown:
        showWelcomeModal()
        OnboardingFlags.welcomeShown = true

on first zone entry of session:
    if not OnboardingFlags.firstZoneNudgeShown and PlayerState.currentZone is unlocked:
        showZoneNudge()
        OnboardingFlags.firstZoneNudgeShown = true

on bite hookable:
    if not OnboardingFlags.firstHookNudgeShown:
        showHookNudge()  // 800ms forgiveness
        OnboardingFlags.firstHookNudgeShown = true

on reel won:
    if ReelState.perfect: apply +50% to LastCatch.price; mark Perfect on modal
    if Inventory.softRigConsumed == false: title = "Your first catch!"
    if catch.fish.rarity == 'legendary': trigger UI screen-shake
```

## Risks for this step

| Risk                                                          | Mitigation                                                                                                  |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Particles tank FPS                                            | Step 17 will profile; if particles are the offender, reduce particle count. Cap from the start (≤30 active).|
| Screen shake feels jarring                                    | Keep amplitude small (≤2 px), duration short (≤0.1 s); test with non-team members.                          |
| Tutorial prompts re-trigger because flags weren't persisted   | Step 14's debounced save fires when an OnboardingFlag flips; guarantees one-show even across reloads.        |
| Welcome popup blocks input on mobile                           | Tap-anywhere-to-dismiss in addition to the explicit "Got it" button.                                         |
| Haptics annoy on long sessions                                | Three events only, all milestone-driven; verify nothing fires per-frame.                                     |
| Polish hides bugs that perf testing then reveals              | Step 17 explicitly tests *with* polish on; do not strip polish to hit the FPS target.                        |

## When this step is done
Open `plan/17-perf-and-submit.md`. Last step.
