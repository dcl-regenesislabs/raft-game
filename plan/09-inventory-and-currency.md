# Step 09 — Inventory & Currency

## Goal
Make "Keep" actually keep the fish and "Sell" actually credit Pearls. Show the Pearls counter in the HUD, and store caught fish in a structured inventory the bestiary and merchant will read.

## Why this step exists here
- **Without storage, the loop has no progression.** GDD §4.7 says every catch must give *something* — currency, bestiary entry, or weight record. This step is where that promise becomes real.
- **It defines the only mutable game-state the player accumulates.** Get the shape right now; Steps 10, 11, 13, 14 all read it.
- **The HUD lights up for the first time.** All future HUD elements (rod icon, bestiary button) inherit this slot's positioning.

## Depends on
- Step 08 (fish are rolled by id; inventory references those ids).

## Adds
- An `Inventory` singleton component:
  - `pearls: Float` — current currency.
  - `caught: Array<CaughtFishRecord>` — every fish kept.
  - `bestiary: Map<fishId, { caughtCount, heaviest }>` — derived/aggregated, kept in lock-step.
- `CaughtFishRecord` shape: `{ fishId, weight, price, caughtAt }`.
- HUD currency widget (top-right, image from Step 01) bound to `Inventory.pearls`.
- Modal "Keep" → adds a `CaughtFishRecord` to `caught`, updates `bestiary` aggregate, dismisses.
- Modal "Sell" → adds the record to `caught` *too* (so the bestiary still reflects it!), credits `pearls += record.price`, dismisses.
- Sell SFX (Step 01) on the Sell action.

## Out of scope
- The merchant NPC (Step 10) — the modal "Sell" is the only sell entrypoint until then.
- Rod purchase (Step 11) — Pearls accumulate, nothing to spend on yet.
- Bestiary UI panel (Step 13) — the *aggregate* is updated here, but visualization is later.
- Persistence (Step 14) — Inventory is in-memory only.

## Acceptance criteria
1. Catching a fish and tapping "Keep" increments the bestiary aggregate for that fish (count + heaviest if applicable). Pearls unchanged.
2. Catching a fish and tapping "Sell" increments Pearls by the modal's shown price. Bestiary aggregate also updated.
3. The Pearls counter visibly updates within one frame of a sell.
4. Catching the *same* fish twice updates `heaviest` only when the new weight exceeds the stored value.
5. Closing and re-opening the scene resets everything (persistence is not until Step 14) — no error state.
6. `Inventory.caught` and `Inventory.bestiary` are always consistent with each other after any action (invariant: bestiary aggregate equals replay of all caught records).
7. No regression to Steps 04–08.

## Implementation notes (no code)

**Why both Keep and Sell update the bestiary.** Selling a fish should still count toward the bestiary — otherwise players who sell aggressively can never complete it, and that punishes the loop the GDD specifically designed to reward. Inventory and bestiary are two views of the same underlying event ("a fish was caught").

**Aggregate vs. raw.** Storing both `caught` (raw) and `bestiary` (aggregate) is mild duplication, but the bestiary view has to render every frame and re-aggregating each time is wasteful. Keep them in sync via a single `recordCatch(record)` helper — never mutate one without the other.

**Currency type.** `Float`, not `Int`. Future stretch goals (per-bait modifiers, percent bonuses) may produce non-integer prices. Step 06's `Perfect!` 50 % bonus is already a candidate.

**Where the modal handlers live.** A single `inventoryActions.ts` module exposes `keepCatch(record)` and `sellCatch(record)`. The modal dismiss flow imports both. This decouples the UI from the storage shape — Step 14 will swap implementations to add persistence without touching the modal.

**HUD position.** Top-right per GDD §6.1. Reuse the position constants for Step 11's rod icon and Step 13's bestiary button.

Pseudo-flow:

```
recordCatch(record):
    inv = Inventory.getMutable()
    inv.caught.push(record)
    entry = inv.bestiary[record.fishId] ?? { caughtCount: 0, heaviest: 0 }
    entry.caughtCount += 1
    entry.heaviest = max(entry.heaviest, record.weight)
    inv.bestiary[record.fishId] = entry

keepCatch(record):
    recordCatch(record)

sellCatch(record):
    recordCatch(record)
    Inventory.getMutable().pearls += record.price
    play sell SFX

UI render-time:
    render <PearlsHUD value={Inventory.get().pearls} />
```

## Risks for this step

| Risk                                                            | Mitigation                                                                                                  |
|-----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Caught list grows unbounded across a long session               | Bestiary aggregate caps storage; `caught` array is bounded only by playtime. Cap at ~500 entries; drop FIFO if exceeded — log a warning. |
| Inventory drift between aggregate and raw                       | `recordCatch` is the only mutation path. Code-review enforces it.                                             |
| HUD currency flickers / jumps                                   | Render directly from state every frame; no animation tweens until Step 16's juice pass.                       |
| Sell from modal feels slow                                      | Dismiss the modal *before* the SFX completes; SFX is fire-and-forget.                                         |

## When this step is done
Open `plan/10-merchant-and-selling.md`.
