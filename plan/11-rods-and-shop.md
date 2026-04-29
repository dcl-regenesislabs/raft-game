# Step 11 — Rods & Shop

## Goal
Add the three rods (Twig, Mystic, Crystal) with stats that meaningfully change gameplay, plus a shop UI on the merchant where the player spends Pearls to upgrade.

## Why this step exists here
- **Pearls finally have a sink.** Until now, currency accumulates with no destination — that breaks the loop the GDD §4.7 describes.
- **It's the primary progression vector** (GDD §4.5). Without rods, the difficulty curve is flat from cast 2 onward.
- **Stat plumbing into Steps 04–06 closes a gap left intentionally.** Those steps used default tuning; rods modulate them per the GDD.

## Depends on
- Steps 04 (cast), 05 (bite), 06 (reel) — all four rod stats touch these systems.
- Step 09 (Pearls exist to spend).
- Step 10 (the merchant NPC pattern is reused).

## Adds
- A `RodDefinition` data structure for each rod: `id, name, cost, power, control, lure, luck` (GDD §4.5 table).
- An `EquippedRod` field on `PlayerState`: starts as Twig.
- An `ownedRods` set on `Inventory`: starts containing only Twig.
- A `RodShopUI` opened from a second NPC interaction option ("Browse rods") on the merchant: lists all three rods with stat icons, cost, status (Owned / Equipped / Affordable / Locked).
- Purchase flow: cost is deducted, rod added to `ownedRods`, optionally auto-equipped.
- Equip flow: a tap on an owned rod sets it as `EquippedRod`.
- HUD rod icon (sourced Step 01) reflecting the equipped rod, top-right under the Pearls widget.
- Stat plumbing:
  - **Power** → `progressDrainRate` divisor in Step 06's reel.
  - **Control** → `playerZoneSize` multiplier in Step 06's reel.
  - **Lure** → wait-time floor reduction in Step 05's bite.
  - **Luck** → tier bias in Step 08's pool roll (favor higher rarity).

## Out of scope
- Stretch rods 4 and 5 (GDD §11).
- Bait system (GDD §11 stretch).
- Visually swapping the rod model on the player (nice-to-have; defer to Step 16).
- Persistence of equipped rod (Step 14).

## Acceptance criteria
1. Tapping the merchant offers two paths: "Sell fish" (Step 10) and "Browse rods" (this step).
2. Each rod entry shows its stats, cost, and ownership state. Locked rods are visibly distinct.
3. Buying a rod with sufficient Pearls deducts the cost and adds the rod to owned. Insufficient Pearls disables the buy button (greyed, not removed).
4. Equipping a rod updates the HUD rod icon within one frame.
5. With Mystic equipped, a Common fish reels visibly easier than with Twig (drain slower, zone wider).
6. Luck bias is observable: with Crystal equipped, the rare-tier roll rate increases — verifiable via debug counter from Step 08.
7. No regression in the Step 07 vertical-slice loop with the default Twig rod.

## Implementation notes (no code)

**Stat plumbing model.** Don't bake rod stats into individual systems. Instead, a small `effectiveTuning(fish, rod)` helper returns the final reel knobs:

```
effectiveTuning(fish, rod):
    return {
        fishSpeed: fish.difficulty.fishSpeed,
        fishRandomness: fish.difficulty.fishRandomness,
        playerZoneSize: fish.difficulty.playerZoneSize * (1 + 0.10 * rod.control),
        progressDrainRate: fish.difficulty.progressDrainRate / (1 + 0.20 * rod.power),
    }
```

The reel system reads from the result; rods don't reach into reel internals.

**Lure stat.** Modulates the wait timer in Step 05: `actualWait = max(MIN_WAIT, baseWait - lure * 0.5)`. `MIN_WAIT` ~= 1 s prevents instant bites.

**Luck stat.** Modulates Step 08's pool roll: bump higher-rarity weights up by `+luck * 0.10` (multiplicative on the rarer entries). Tune by playing with Crystal equipped for a few minutes.

**Shop UI.** Three large rod cards, one per rod, displayed vertically (mobile) or horizontally (desktop). Each card: rod icon, name, four stat bars, cost (or "Owned"), action button. Tap targets ≥48 dp (GDD §6.3).

**Equip vs. Buy distinction.** A clean affordance: button text reads "Equip" (owned, not equipped), "Equipped" (greyed, current), "Buy — C$ X" (owned == false). One button per card; do not split.

**Auto-equip-on-purchase.** Default ON for the first purchase (Twig → Mystic) since the player almost certainly wants the upgrade. Off for subsequent purchases — equip is a deliberate choice. Two-line behavior, clearly commented in the constants module.

Pseudo-flow:

```
buyRod(rodDef):
    if Inventory.pearls < rodDef.cost: ignore
    if Inventory.ownedRods.has(rodDef.id): ignore
    Inventory.pearls -= rodDef.cost
    Inventory.ownedRods.add(rodDef.id)
    if PlayerState.equippedRod == "twig":
        PlayerState.equippedRod = rodDef.id  // first upgrade auto-equips
    play purchase SFX

equipRod(rodId):
    if not Inventory.ownedRods.has(rodId): ignore
    PlayerState.equippedRod = rodId

UI render-time:
    if RodShopUI.open:
        render <RodShop rods={ALL_RODS} owned={Inventory.ownedRods} equipped={PlayerState.equippedRod} />
```

## Risks for this step

| Risk                                                              | Mitigation                                                                                              |
|-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Stat curves feel flat (Mystic doesn't feel different from Twig)   | Tune the multipliers up — `1 + 0.10 * control` is a starting point, not a final answer. Playtest.       |
| Pearls go negative on a race condition                            | All purchase logic in `buyRod`; check before deduct, single-frame mutation.                              |
| Player can't tell which rod is equipped                           | "Equipped" badge on the card + the HUD icon swap. Two visual cues for redundancy.                       |
| Locked rod (can't afford) feels bad / unclear                     | Show the cost in red and a clear "X more Pearls" delta below the price.                                 |
| Auto-equip surprises the player                                   | Only on first purchase; document in `STYLE.md` so designers don't add more auto-equip rules later.       |

## When this step is done
Open `plan/12-zones-and-gating.md`.
