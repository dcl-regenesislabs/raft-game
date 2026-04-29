# Step 07 — Single-Fish Catch Loop (Vertical Slice)

## Goal
Wire one fish — Mossback Carp — through the entire loop so a player can walk to the pond, cast, wait, hook, reel, see the catch reveal, and dismiss — end-to-end, on mobile.

## Why this step exists here
- **This is the GDD's Week 1 Day 6 milestone (§10).** "Vertical slice playable on mobile" is the gate that justifies starting Week 2 work.
- **It tests the system seams.** Cast → bite → reel → catch each work in isolation by Step 06; this step proves they hand off cleanly.
- **The catch reveal modal is the player's payoff.** Building it once for one fish forces the design choices that all twelve fish will inherit in Step 08.

## Depends on
- Step 06 (`ReelState` resolves to `won` or `lost`).

## Adds
- A `Fish` data record (in code) for **Mossback Carp**: name, rarity (Common), weight range (1.0–3.0 kg), base value (8 C$/kg), zone (Lily Cove), difficulty profile (slow fish, low randomness — soft-rigged for the first catch per GDD §5).
- A `CatchSystem` that activates on `ReelState.phase == won`: rolls a weight inside the range, computes the price, stores the result transiently, and triggers the reveal modal.
- The **catch-reveal modal** (UI sourced Step 01): fish name, rarity badge, rolled weight, computed price, "Keep" and "Sell" buttons. (Both buttons just dismiss for now — selling and inventory are Steps 09–10. Keep this step's job small.)
- An escape branch for `lost`: a brief "Got away…" toast (1.5 s, fades), then state resets to idle.
- A clean reset path in both branches: `BiteState`, `CastState`, `ReelState` all return to `idle`, the bobber entity is despawned, and the player can immediately re-cast.

## Out of scope
- Twelve fish (Step 08).
- Inventory storage (Step 09) — for now both modal buttons just dismiss.
- Currency display (Step 09) — the price shown in the modal is a calculation, not a wallet update.
- Persistence (Step 14) — nothing is saved.

## Acceptance criteria
1. Cold start → walk to Lily Cove → cast → wait → hook → reel → catch reveal modal appears with name "Mossback Carp", a rarity badge, a weight in the documented range, and a price.
2. Tapping "Keep" or "Sell" dismisses the modal and returns the player to the world, ready to cast again.
3. Failing the reel minigame shows the "Got away…" toast and resets — no modal.
4. The full happy-path loop completes in 30–45 seconds (matches GDD §3 target).
5. Mobile preview runs the entire loop without a stuck state, dropped frame burst, or input lockout.
6. FPS during the reel minigame stays ≥30 on mid-tier Android.
7. The first cast as a fresh player is *easy* (slow fish, large player zone) — the GDD §5 soft-rig.

## Implementation notes (no code)

**Where the data lives.** Keep a single `fishData.ts`-style module exporting one record. Step 08 will replace this with a 12-record table; until then, one record is fine. Field shape should mirror the GDD table so the migration in Step 08 is mechanical.

**Soft-rig for the first catch.** Track on a `PlayerState` field whether the player has ever caught a fish. If not, override the reel difficulty knobs for this single attempt: `fishSpeed *= 0.6`, `playerZoneSize *= 1.5`, `progressDrainRate *= 0.5`. Once `won` resolves the first time, clear the flag. (This is also where Step 14's persistence will eventually decide to remember it — but for now session-only is fine.)

**Roll the weight.** Uniform random within the range, then snap to one decimal place. Compute `price = round(weight * baseValue)`. Cache both on a transient `LastCatch` singleton that the modal reads.

**Modal UI.** Render in the React-ECS function based on a flag in `LastCatch.visible`. Two buttons; both set `visible = false`. Step 09 will replace "Keep" with "store in inventory" and "Sell" with "credit pearls".

**Reset path.** A small helper `resetLoopToIdle()` is called from the modal-dismiss handler and from the `lost` branch. It sets all three system states back to `idle`, despawns the bobber, and clears any transient UI flags. One function = one place to keep it correct.

Pseudo-flow:

```
CatchSystem(dt):
    if ReelState.phase == won:
        weight = roll(MossbackCarp.weightRange)
        price = round(weight * MossbackCarp.baseValue)
        LastCatch.set({ fish: MossbackCarp, weight, price, visible: true })
        ReelState.phase = idle  // hand-off complete

    if ReelState.phase == lost:
        showToast("Got away…", 1.5s)
        ReelState.phase = idle
        resetLoopToIdle()

UI render-time:
    if LastCatch.visible:
        render <CatchModal
            name=LastCatch.fish.name
            rarity=LastCatch.fish.rarity
            weight=LastCatch.weight
            price=LastCatch.price
            onKeep={() => { LastCatch.visible = false; resetLoopToIdle() }}
            onSell={() => { LastCatch.visible = false; resetLoopToIdle() }}
        />
```

## Risks for this step

| Risk                                                            | Mitigation                                                                                                   |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Modal blocks the state reset, leaving the loop wedged           | The dismiss handler is the *only* path; verify by automated tap-spam during a playtest.                       |
| Soft-rigged first catch persists across sessions confusingly    | Step 14 will gate this with persistence; for now, session-only is the intended behavior.                      |
| The "Got away…" toast collides with DCL's notification system   | Use an in-scene React-ECS overlay, not DCL's chat/notification API — keeps it owned by the scene.            |
| Rarity badge image doesn't match palette                        | Already locked in Step 01's `STYLE.md`; verify visually before declaring the step done.                       |
| Vertical slice ships with a bug under load                      | Run the loop **ten times** consecutively before signing off; the bug usually emerges on attempt 4–5.          |

## Milestone gate

This is the **vertical slice gate**. Do not begin Step 08 until acceptance criteria 1–7 above are checked off. If a judging-style external player can play the loop three times in a row without you intervening, the gate is met.

## When this step is done
Open `plan/08-fish-roster-and-data.md`.
