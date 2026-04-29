# Step 03 — Player Presence & Zone Detection

## Goal
Detect when the player's avatar enters a fishing zone and surface a clear "Tap & hold to cast" prompt — without yet doing anything when they tap.

## Why this step exists here
- **It's the first place we read the player's position into game logic.** Getting the helper right (read-only `Transform.getOrNull(engine.PlayerEntity)`) avoids miscommunication later.
- **Prompts are the player's first feedback signal.** If the prompt feels late or missing, every later mechanic inherits the lag.
- **Zones become first-class entities.** Once they exist as data (not just visuals), every later system — fish pools, gating, audio cues — has something to query.

## Depends on
- Step 02 (zones are visually placed in the parcel).

## Adds
- A `FishingZone` custom component carrying the zone's identity (Lily Cove / Starwell / The Deep), center, and radius.
- A small `ZoneTriggerSystem` that, every frame, computes which zone (if any) contains the player and writes the result to a singleton `PlayerState` component.
- A persistent UI element: a floating prompt that appears when `PlayerState.zone` is non-null and disappears otherwise.
- A subtle audio cue on zone entry (re-uses one of the UI tap sounds from Step 01 until Step 15 replaces it).

## Out of scope
- Casting itself (Step 04).
- Tap-and-hold input handling (Step 04 — the prompt this step shows is *visual only*).
- Zone-based gating by level (Step 12; this step lets the player enter all three freely).
- Different prompt copy per zone — one prompt for now.

## Acceptance criteria
1. Walking into Lily Cove makes the prompt appear within one frame; walking out makes it disappear within one frame.
2. The prompt reads "Tap & hold to cast" and is visible on both desktop and mobile preview.
3. The prompt does not flicker when the player straddles a zone boundary (debounce or use `>=` consistently).
4. Standing in two zones at once is impossible — zones are non-overlapping by design; if they overlap, one wins deterministically by priority order (Lily → Star → Deep).
5. `engine.getEntitiesWith(FishingZone)` returns exactly three entities.
6. FPS budget unchanged from Step 02 (≥45 FPS mid-tier Android).

## Implementation notes (no code)

Concepts:

- **`FishingZone` component** holds: `id` (enum: `LilyCove | Starwell | TheDeep`), `center` (Vector3), `radius` (Float). It's attached to an invisible "zone anchor" entity placed at the dressing's center. The visible dressing entities from Step 02 stay separate — zones are *logical*, dressings are *visual*.
- **`PlayerState` singleton** (one entity, one instance) carries `currentZone: Optional<FishingZone.id>`. `null` means "player is not in any zone".
- **`ZoneTriggerSystem`** runs every frame. It reads the player's transform, iterates `engine.getEntitiesWith(FishingZone)`, finds the first whose distance-squared to the player is ≤ radius², and writes that id into `PlayerState`. Distance-squared avoids the sqrt.
- **The prompt UI** is a `<UiEntity>` rendered conditionally — its visibility is computed every render-frame from `PlayerState.currentZone`. No event system, no `useEffect`. Per CLAUDE.md, just read scene state inside the render function.
- **Debounce**: only update `PlayerState.currentZone` when it actually changes; skip writes that would assign the same value. This both avoids unnecessary mutability calls and gives us a clean event point for the entry-sound trigger.

Pseudo-flow:

```
ZoneTriggerSystem(dt):
    player = Transform.getOrNull(engine.PlayerEntity)
    if player is null: return
    matchedZoneId = null
    for each (entity, zone) in entities-with(FishingZone):
        if distance_squared(player.position, zone.center) <= zone.radius²:
            matchedZoneId = zone.id
            break  // priority: first zone wins
    if PlayerState.currentZone != matchedZoneId:
        PlayerState.getMutable().currentZone = matchedZoneId
        if matchedZoneId is not null:
            play zone-entry sound
```

UI render-time:

```
ui():
    state = PlayerState.get()
    if state.currentZone is null:
        return null
    return <UiEntity>"Tap & hold to cast"</UiEntity>
```

## Risks for this step

| Risk                                                       | Mitigation                                                                                                |
|------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Prompt flickers near zone borders                          | Use distance-squared with a small hysteresis (e.g., enter at `r²`, exit at `(r+0.5)²`).                   |
| Player position is null on the first frame                 | The system already handles `null`; verify nothing crashes during the load → spawn frames.                 |
| Zone radii mis-tuned (player triggers too far / too close) | Tune the radii in-engine, not in code: pick numbers that visually match the dressing footprint.            |
| `getMutable` called every frame on `PlayerState`            | The change-only write above prevents this; verify in the profiler.                                         |

## When this step is done
Open `plan/04-casting-mechanic.md`.
