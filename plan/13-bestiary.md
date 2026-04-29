# Step 13 — Bestiary

## Goal
Surface the bestiary aggregate (built in Step 09) as a 12-cell grid the player can open from the HUD: caught/uncaught states, heaviest specimen, rarity tiers, completion progress.

## Why this step exists here
- **It's the third reward currency** alongside Pearls and rods (GDD §4.7). Players who don't care about money still get hits from filling the grid.
- **It's the most visible long-session retention loop.** A player six minutes in needs a visual goal — the bestiary is it.
- **It's the place fish models earn their visual budget.** Up to here, the catch modal can use a generic silhouette; the bestiary is where each fish's distinctive look pays off.

## Depends on
- Step 09 (bestiary aggregate exists and is being updated correctly).
- Step 08 (fish definitions are queryable by id).

## Adds
- A bestiary HUD button (top-right cluster, below the rod icon) — toggles the panel.
- A `BestiaryUI` singleton with `{ open: Boolean }`.
- A 12-cell grid panel: 3–4 columns depending on viewport. Each cell:
  - **Uncaught**: dark silhouette + "?" + rarity tier badge. Name hidden.
  - **Caught**: full fish render (or thumbnail), name, rarity badge, heaviest weight, caught count.
- Top of panel: completion bar — `caught species / 12`, plus a celebratory state when full.
- Tapping a caught cell expands it for full details (zone, weight range, base value); tapping an uncaught cell shows only "Discover this fish in [zone]" (rarity-tier-appropriate hint).

## Out of scope
- Bestiary completion reward (stretch §11).
- Sorting / filtering options.
- Trade or leaderboard features.
- Persistence (Step 14).

## Acceptance criteria
1. Bestiary button visible in HUD, top-right under rod icon.
2. Tapping the button opens the panel; tapping again or a close affordance closes it.
3. Catching the first fish updates that cell from silhouette to full state within one frame of dismissing the catch modal.
4. Catching the same species heavier than before updates the cell's heaviest weight value.
5. All 12 cells exist from frame one — uncaught cells are visible (with silhouette) so the player sees the goal.
6. Locked-zone fish are still listed but their hint says "in The Deep — currently locked".
7. Fits on a mobile screen at 360×800 portrait without horizontal scroll.

## Implementation notes (no code)

**Render strategy.** Read directly from `Inventory.bestiary` and `fishById()` each render frame — no caching. The aggregate is small (12 entries) and the panel only renders while open.

**Silhouette for uncaught fish.** Easiest: a single dark-tinted version of the fish's bestiary thumbnail rendered with `tintColor: black` + low opacity. Saves us 12 extra art assets. Fall back to a generic fish shape if a thumbnail can't be tinted.

**Thumbnails vs. live 3D.** Two options:
- A. Pre-rendered 2D thumbnails (one PNG per fish) — cheap, predictable, mobile-safe.
- B. Live 3D render of the GLB on a small floating viewport — visually richer but expensive on mobile.

Recommend **A** for the hackathon. The catch modal in Step 16's polish pass can experiment with B if there's time. Add the 12 thumbnails to Step 01's asset list backlog (or generate them by screenshotting the GLBs against a neutral background).

**Completion bar.** Single horizontal bar across the top of the panel: filled fraction = `caughtSpecies / 12`. Shown as text too: "7 / 12 species discovered." When full, bar shifts to a celebratory color and the panel header changes to "Complete!".

**Cell-expand interaction.** Tap a cell: replace the panel content with a single-fish detail view; a back arrow returns. Don't try to do popovers or tooltips — they don't translate to mobile.

Pseudo-flow:

```
UI render-time:
    render <BestiaryButton onTap={() => BestiaryUI.open = !BestiaryUI.open} />
    if BestiaryUI.open:
        cellsCaught = count(bestiary entries with caughtCount > 0)
        render <BestiaryPanel
            completion={cellsCaught / 12}
            cells={ALL_FISH.map(fish => ({
                fish,
                caught: bestiary[fish.id]?.caughtCount > 0,
                heaviest: bestiary[fish.id]?.heaviest ?? 0,
                count: bestiary[fish.id]?.caughtCount ?? 0,
            }))}
            onCellTap={(fishId) => BestiaryUI.expandedCell = fishId}
            onClose={() => BestiaryUI.open = false}
        />
```

## Risks for this step

| Risk                                                       | Mitigation                                                                                                  |
|------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Panel doesn't fit on small mobile portrait                 | Verify at 360×800. Use 3 columns × 4 rows; cells are 80–100 px square.                                       |
| Silhouette tint hides the fish too much / not enough       | Tune the alpha; per-fish art polish is acceptable here, not in Step 16.                                      |
| The Pondkeeper cell spoils the legendary surprise          | Show its silhouette as a *very* dim, vague shape — barely readable as a fish. Hint: "Whispered to lurk in The Deep." |
| Players miss the button                                    | First-launch hint (Step 16): a small arrow points at the button for 5 seconds, then fades.                  |
| Bestiary aggregate is wrong → visual bug                   | Step 09 invariant catches this; this step inherits it. If it's wrong, fix Step 09's `recordCatch`.           |

## When this step is done
Open `plan/14-persistence.md`.
