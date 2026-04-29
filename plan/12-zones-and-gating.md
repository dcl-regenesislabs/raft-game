# Step 12 — Zones & Gating

## Goal
Restrict access to Starwell and The Deep until the player has earned the right to fish them, using the player-level system implied by GDD §4.6.

## Why this step exists here
- **Without gating, the player wanders into Legendary territory at minute one.** That collapses the difficulty curve and the GDD's pacing plan (§5).
- **It's a small system that makes a big difference to the first-5-minute experience** — which is what judges play.
- **Visual gating is a Decentraland-native technique.** The GDD calls this out explicitly; it's a place we showcase what the platform allows.

## Depends on
- Steps 03 (zone detection), 09 (we read player progress from Inventory's bestiary aggregate), 11 (rod ownership is one progression signal).

## Adds
- A `PlayerLevel` derivation: not stored, derived each frame from `Inventory.bestiary` (or owned rods, or total Pearls earned — pick one signal). Recommended: **distinct fish caught** in Lily Cove → unlocks Starwell at 3, The Deep at 6.
- A `ZoneAccess` resolver: given player progress, returns a set of currently-accessible zone ids.
- A visual gate per locked zone: the GDD suggests "rising water" or invisible barriers. Concretely:
  - **Starwell**: a soft mist wall and a sign reading "Locked — catch 3 species in Lily Cove".
  - **The Deep**: a darker mist + sign reading "Locked — catch 6 species".
  - When the gate clears, the mist fades over ~2 seconds and a small chime plays.
- The Step 03 prompt no longer appears inside locked zones. A different prompt — the unlock-progress message — appears instead when the player approaches.

## Out of scope
- Bestiary panel UI (Step 13).
- Persistent unlock state (Step 14).
- Time-of-day or weather (stretch goals §11).
- A more elaborate ceremony when a zone unlocks (Step 16's polish pass adds particles / camera nudges if there's time).

## Acceptance criteria
1. Fresh game: only Lily Cove allows casting; the other two show the unlock-progress prompt.
2. Catching 3 distinct species in Lily Cove unlocks Starwell. The mist visibly clears.
3. Catching 6 distinct species (across all zones already accessible) unlocks The Deep.
4. Walking into a still-locked zone never shows the cast prompt — only the lock prompt.
5. The lock prompt updates live: "Catch 1 more species" → "Catch 0 more species" → unlock.
6. The Step 03 zone-entry sound only plays for *unlocked* zones.
7. Step 11's rod purchase still works at every level.

## Implementation notes (no code)

**Choosing the unlock signal.** Three reasonable options:
- A. Distinct species caught — straightforward; encourages exploration of the existing zone before the next.
- B. Total Pearls earned — couples zone progression with the rod track; risks players grinding one zone forever.
- C. Owned rods — couples zones with the shop; risks softlock if the player never visits the merchant.

Recommend **A** for the hackathon: clearest causal feedback ("I caught a new fish, I see progress"). The signal is already computed by Step 09's bestiary aggregate; no new state.

**`ZoneAccess` resolver.**

```
zoneAccess(inventory):
    distinctSpecies = inventory.bestiary.entries.where(caughtCount > 0).count
    accessible = { LilyCove }
    if distinctSpecies >= 3: accessible.add(Starwell)
    if distinctSpecies >= 6: accessible.add(TheDeep)
    return accessible
```

**Gate visuals.** Each zone has two states (locked, unlocked) controlled by a per-zone `Visibility` attached to the mist/wall entity. The transition is a 2 s alpha tween. No physical collider — the wall is non-solid; the player can walk through, but the cast prompt won't appear so they can't actually fish.

**Lock prompt.** Same UI slot as the cast prompt (Step 03), different content. The Step 03 system reads `ZoneAccess` and decides which prompt to render.

**One-time chime.** Track which zones have *just* unlocked since last frame; play the chime exactly once on the rising edge.

Pseudo-flow:

```
each frame:
    accessible = zoneAccess(Inventory.get())
    for each zone in [LilyCove, Starwell, TheDeep]:
        wasAccessible = zone in PlayerState.accessibleLastFrame
        isAccessible  = zone in accessible
        if isAccessible and not wasAccessible:
            tween mist alpha 1 → 0 over 2s
            play unlock chime
        if not isAccessible and wasAccessible:   // shouldn't happen, but defensive
            tween mist alpha 0 → 1 over 2s
    PlayerState.accessibleLastFrame = accessible

ui zone prompt:
    if PlayerState.currentZone is null: render nothing
    if PlayerState.currentZone in accessible: render <CastPrompt />
    else: render <LockPrompt
        target=PlayerState.currentZone
        remaining=requiredSpecies(zone) - distinctSpecies
    />
```

## Risks for this step

| Risk                                                  | Mitigation                                                                                                    |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| Player gets stuck — can't unlock The Deep with what's available | Verify that 6 species are reachable from {LilyCove, Starwell} alone. Audit the fish data table.       |
| Mist wall fades but cast still rejected               | The cast prompt is the gate, not the mist; one source of truth (`ZoneAccess`) prevents drift.                 |
| Unlock chime double-plays on frame 1 (everything's "new")     | The "since last frame" comparison handles it; verify `accessibleLastFrame` is initialized to the same starting set as `accessible`. |
| Visual gating feels punitive                          | Soft, hopeful copy: "The Starwell waters are restless tonight — catch 3 from Lily Cove first." Tone matters.   |

## When this step is done
Open `plan/13-bestiary.md`.
