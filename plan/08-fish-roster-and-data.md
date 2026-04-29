# Step 08 — Fish Roster & Data Layer

## Goal
Replace the single Mossback Carp with the full 12-species roster (GDD §A), a JSON-driven fish definition file, and zone-aware fish-pool rolling that uses the cast's landing tier.

## Why this step exists here
- **The vertical slice (Step 07) proves the loop. This step proves the *content engine*.** Without a data layer, every later step (rods, zones, bestiary) is hard-coded.
- **Tuning is the dominant Week 2 activity.** GDD §10 calls for a JSON-driven roster explicitly — designers should not have to recompile to rebalance.
- **It validates the difficulty profile feeding the reel system.** Step 06 left difficulty knobs as parameters; this step is the first place they're modulated by content.

## Depends on
- Step 07 (single-fish loop works).

## Adds
- A `fishData.json` (or equivalent) shipping all 12 species with the GDD §A fields plus the per-fish reel difficulty profile (`fishSpeed`, `fishRandomness`, `playerZoneSize`, `progressDrainRate`).
- A typed loader that parses the JSON at scene start and exposes a `fishById(id)` and `fishPoolForZoneAndTier(zone, tier)` API.
- A weighted-random roll: each zone has weights for fish in its pool; landing tier (`close | mid | deep`) further biases toward common (`close`) or rare (`deep`) entries.
- The `CatchSystem` from Step 07 now reads its fish from the pool roll instead of hard-coding Mossback Carp.
- Per-fish difficulty profile is applied to the reel system at the start of each minigame (overrides Step 06's defaults).

## Out of scope
- Inventory persistence of multiple fish (Step 09).
- Bestiary visualization (Step 13).
- Different visual fish models in the catch modal — for now, a single placeholder render or rarity-color silhouette is acceptable. Per-fish GLBs render in Step 13's bestiary and (optionally) the catch modal in Step 16's polish pass.
- Zone gating by player level (Step 12). All three zones are still freely accessible.

## Acceptance criteria
1. `fishData.json` contains 12 entries matching GDD §A name, rarity, zone, weight range, and base value.
2. Each entry also has a difficulty profile object with the four reel knobs.
3. Casting in Lily Cove produces only Lily-Cove fish; casting in Starwell produces Starwell fish; casting in The Deep produces The Deep fish. No cross-zone leaks.
4. A `deep` landing tier in The Deep occasionally produces a Legendary (Pondkeeper) — verifiable by setting its weight to 100 % temporarily for the test.
5. The reel minigame is *visibly harder* on a Rare than on a Common: faster fish, smaller player zone, faster drain.
6. Edits to `fishData.json` reflected after a single `npm run build` — no other code changes required.
7. The vertical-slice loop from Step 07 still works; nothing regressed.

## Implementation notes (no code)

**Schema.** Per-fish:

```
{
  id: "mossback-carp",
  name: "Mossback Carp",
  rarity: "common",
  zone: "lily-cove",
  weightRange: [1.0, 3.0],
  baseValue: 8,
  rarityMultiplier: 1.0,    // applied to price; 1.0 / 1.5 / 2.5 / 5 / 10
  poolWeight: { close: 40, mid: 25, deep: 10 },   // per-tier weights
  difficulty: {
    fishSpeed: 0.4,
    fishRandomness: 0.2,
    playerZoneSize: 0.20,
    progressDrainRate: 0.5
  }
}
```

**The pool roll.**

```
fishPoolForZoneAndTier(zone, tier):
    candidates = all fish where fish.zone == zone
    weights = candidates.map(f => f.poolWeight[tier])
    pick one weighted-randomly

CatchSystem on ReelState.won:
    fish = fishPoolForZoneAndTier(PlayerState.currentZone, CastState.landingTier)
    weight = roll(fish.weightRange)
    price = round(weight * fish.baseValue * fish.rarityMultiplier)
    LastCatch.set({ fish, weight, price, visible: true })
```

**Reel difficulty injection.** When `BiteState` transitions to `hooked`, *also* peek which fish is "on the line". One way: roll the fish at hook-set time (not at catch-success), cache it on `BiteState.hookedFish`, and use its difficulty to seed `ReelState`. The rolled fish then becomes whatever `CatchSystem` finalizes, ensuring the difficulty matches the fish you're seeing.

**Soft-rig still applies for the first catch.** Override the difficulty (Step 07) for the very first hooked fish — and constrain that first fish to a Common (force a `close`-tier roll once, ignoring landing tier).

**JSON location.** Live in `src/data/fishData.json`, imported via TypeScript JSON imports. SDK 7 supports this; verify in Step 02's build first.

**Loader.** A tiny module: `loadFish()` parses + validates (rarity ∈ enum, weights non-negative). Throw at scene start if malformed — fail loud, not silent.

## Risks for this step

| Risk                                                  | Mitigation                                                                                                  |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Pool weights produce no rares                         | Add a debug screen (toggleable) listing roll counts per fish. Surface skew quickly.                          |
| JSON shape drifts from runtime expectations           | A single `validateFish()` step at load time catches schema breaks before they reach gameplay.                |
| Difficulty profile makes a fish unbeatable            | Set absolute floors/ceilings for each knob and clamp during load. Document them in `tuning.ts`.              |
| Reel difficulty mismatch — the fish on the modal isn't the one you fought | Pre-roll the fish at `hookable → hooked`, not at `won`. Pseudo-code above does this.       |
| Stretch into Step 09 by also adding inventory now     | Keep this step laser-focused on roster + roll; modal buttons still just dismiss.                            |

## When this step is done
Open `plan/09-inventory-and-currency.md`.
