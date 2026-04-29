# Step 10 — Merchant NPC & Selling

## Goal
Place the merchant on the dock, let the player walk up and interact, and sell individual fish or "Sell All" — using the SDK 7 NPC Toolkit (GDD §4.7).

## Why this step exists here
- **It moves selling out of the catch modal and into the world.** Players who Keep accumulate fish; without a merchant, those fish are dead inventory.
- **It validates the NPC Toolkit dependency.** GDD §4.7 says we use it; this is the first place we actually integrate it. Failing fast here protects Step 11 (rod shop, also a UI-on-NPC pattern).
- **It establishes the "walk up, tap, dialog" interaction pattern.** Step 11 reuses it for the rod shop.

## Depends on
- Step 09 (Inventory + sell action). The merchant is a *new entrypoint* to existing logic.

## Adds
- A real merchant NPC entity built with the NPC Toolkit, replacing the placeholder marker from Step 02.
- An NPC dialog that opens on tap when the player is within ~2 m: greeting → "Show inventory" → list of caught fish (or empty state).
- An inventory list UI: scrollable list of `caught` records, each with name, weight, price, and a "Sell" button. A persistent "Sell All" button at the bottom.
- A `sellAll()` action that sums every record's price, credits Pearls, and clears `caught` (preserving bestiary).
- The catch modal's "Sell" button is **kept** — selling immediately is still a valid quick-path.

## Out of scope
- Rod shop (Step 11). The merchant only sells *from* the player; buying is a separate NPC interaction.
- Filtering / sorting in the inventory list.
- Persistence (Step 14).

## Acceptance criteria
1. Walking onto the dock within ~2 m of the merchant and tapping triggers the dialog within one frame.
2. The dialog lists all currently `caught` fish; tapping a fish's "Sell" button removes it and credits Pearls equal to its price.
3. "Sell All" sums every caught fish's price, credits Pearls in one update, and empties the list.
4. Bestiary aggregates are *not* affected by selling (verified in Step 13's eventual UI; for now, log to console).
5. Closing the dialog returns control to the world; the player can walk away normally.
6. The merchant model from Step 01 renders cleanly with no z-fighting against the dock.
7. Empty inventory shows a friendly "No fish to sell yet — try the pond." message, not an empty list.

## Implementation notes (no code)

**Why preserve bestiary on sell.** Already established in Step 09: bestiary tracks "ever caught"; inventory tracks "currently held". Selling clears the latter, never the former.

**`sellAll` in one update.** Sum first, then mutate Pearls once, then clear the array. Avoid per-record HUD updates that would flicker.

**Dialog UI.** NPC Toolkit drives the trigger (proximity + tap), but the *inventory list* renders in our React-ECS UI tree, conditionally on a `MerchantUI.open` flag. The Toolkit handles the entry point; we own the content. This keeps complex list rendering out of the Toolkit's dialog tree.

**State.** A `MerchantUI` singleton with `{ open: Boolean }`. The Toolkit's tap handler sets it true; a "Close" button (or pressing Escape on desktop / a back chevron on mobile) sets it false.

**Sound.** Reuse the sell SFX from Step 09 for both `sell` and the per-record `sellOne`. `sellAll` plays it once, not N times — a single coin clink is enough.

Pseudo-flow:

```
on merchant tap:
    if player within 2m:
        MerchantUI.getMutable().open = true

UI render-time:
    if MerchantUI.open:
        render <MerchantPanel
            items={Inventory.caught}
            onSellOne={(record) => sellRecord(record)}
            onSellAll={() => sellAllRecords()}
            onClose={() => MerchantUI.open = false}
        />

sellRecord(record):
    Inventory.pearls += record.price
    Inventory.caught.removeOne(record)
    play sell SFX

sellAllRecords():
    total = sum(Inventory.caught.map(r => r.price))
    Inventory.pearls += total
    Inventory.caught = []
    play sell SFX  // once
```

## Risks for this step

| Risk                                                          | Mitigation                                                                                                  |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| NPC Toolkit dialog API doesn't support our list UI shape      | We don't *use* it for the list — only for the trigger and greeting. The list lives in React-ECS.            |
| Player taps merchant from across the parcel                   | Enforce the 2 m proximity check on the tap handler regardless of what the Toolkit allows.                    |
| `caught` list is huge, scrolling is painful on mobile         | Cap visible rows at 50; show "(+N more)". Most playthroughs stay under 50.                                  |
| Empty-state copy feels cold                                   | Use the GDD's voice — soft, encouraging. "Try the pond — the lilies hide easy catches."                      |
| z-fighting between dock and merchant                          | Lift NPC by 0.01 m or move the dock prop slightly; verified in Step 02's walk-test, finalized here.           |

## When this step is done
Open `plan/11-rods-and-shop.md`.
