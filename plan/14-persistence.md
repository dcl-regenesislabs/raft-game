# Step 14 — Persistence

## Goal
Save the player's progress between sessions: Pearls, owned rods, equipped rod, bestiary aggregate, and the soft-rig flag. Use Plan A (lightweight backend) if it lands; fall back to Plan B (session-only) without breaking the game.

## Why this step exists here
- **Without persistence, returning judges face a fresh start every session** — a massive blow to the GDD §13 success metric of "average judge session > 5 minutes".
- **It's the highest-risk step in the schedule** (GDD §12). Doing it after the feature-complete game (Steps 1–13) means we know exactly what to persist; doing it earlier risks designing for a moving target.
- **The fallback is graceful.** Plan B was always allowed; a clear hackathon notice keeps it shippable.

## Depends on
- Steps 9 (Inventory shape), 11 (rods), 12 (zone access derivable from Inventory — no new state needed).

## Adds
- A `PersistenceClient` interface with two implementations:
  - `BackendClient` (Plan A): hits a Node.js server's `/player/:address` endpoint, GET on load, PUT on save. Auth via Decentraland's signed-fetch.
  - `SessionClient` (Plan B): in-memory only; load returns empty state, save is a no-op.
- A small Node.js server (separate repo or `server/` subdir): single endpoint, JSON file or sqlite for storage, hosted on Railway or Fly.io.
- A `loadProfile()` call on scene start that hydrates `Inventory` and `PlayerState` if a profile exists.
- A `saveProfile()` call on every "checkpoint" event: catch kept, fish sold, rod purchased, rod equipped. Debounced to ≤1 save / 5 seconds.
- A "Demo session — progress not saved" toast (one-time) when running with `SessionClient`.

## Out of scope
- Inventory items beyond fish/rods (no bait, no consumables — none exist yet).
- Multi-device sync (Decentraland identity handles this, but no cross-account merge).
- Leaderboards (stretch goal §11).
- Anti-cheat — the server *trusts* the client for the hackathon. Production work, not hackathon work.

## Acceptance criteria
1. Plan A: catching a fish, leaving the scene, and re-entering shows the same Pearls, owned rods, and bestiary state.
2. Plan A: the save endpoint requires a valid signed-fetch payload; an unsigned request is rejected.
3. Plan B: the demo toast appears once, and the game functions normally for the entire session.
4. Plan A failure (server down, network fails) silently falls back to Plan B with the demo toast — no crash.
5. Save calls are debounced; rapid catches don't produce a save storm (verified via server logs or local counter).
6. Load latency on cold start is ≤1.5 seconds; otherwise the scene starts in Plan B and reconciles when the load resolves.
7. No visible gameplay change vs. Step 13 — persistence is invisible until the player returns.

## Implementation notes (no code)

**Decision tree at scene start.**

```
on scene start:
    set Inventory + PlayerState to defaults  // Plan B baseline
    fire-and-forget loadProfile():
        try BackendClient.load with signed-fetch
        if success: hydrate Inventory + PlayerState atomically
        if fail or timeout > 1.5s: stay on Plan B, show one-time demo toast
```

**Profile schema.**

```
PlayerProfile = {
    pearls: number,
    ownedRods: string[],
    equippedRod: string,
    bestiary: { [fishId]: { caughtCount, heaviest } },
    softRigConsumed: boolean,
    schemaVersion: 1,
}
```

`schemaVersion` lets us evolve the shape later without nuking saved profiles.

**Save triggers.** Wrap the four mutation entrypoints from Steps 09–11:
- `keepCatch` / `sellCatch` / `sellAll` (Step 09–10).
- `buyRod` / `equipRod` (Step 11).
- The soft-rig flag flip (Step 07/08), one-time.

Each call enqueues a save; a debounce timer ensures at most one network call per 5 seconds. On the trailing edge of the debounce, send the *current* full profile (small enough to send whole — ~1 KB).

**Backend.** Single Node.js process, single endpoint:
- `GET /player/:address` returns the JSON or 404.
- `PUT /player/:address` writes the JSON, requires the signed-fetch headers Decentraland injects.
- Storage: a JSON file per address in a directory, or a sqlite DB. JSON file is simpler for a hackathon.

Deploy on Fly.io or Railway free tier. ~30 minutes to scaffold + deploy.

**The demo toast.** Reuse the toast pattern from Step 07's "Got away…". Show once per session, dismissable, copy: "Demo session — progress saves in the live build."

Pseudo-flow:

```
PersistenceClient interface:
    load(address): Promise<PlayerProfile | null>
    save(address, profile): Promise<void>

scene start:
    addr = getCurrentPlayerAddress()
    client = BackendClient
    loadProfile(client, addr).catch(() => fallbackToSessionOnly())

mutation hooks (keep/sell/buy/equip/soft-rig flip):
    enqueueSave()

enqueueSave():
    if debounceTimer set: reset
    set debounceTimer for 5s:
        client.save(addr, currentProfile()).catch(...)
```

## Risks for this step

| Risk                                                      | Mitigation                                                                                                  |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Backend slips past Day 10                                 | Plan B is not a fallback for failure — it's a first-class build target. Test it from Day 1 of this step.    |
| Signed-fetch integration is finicky                       | Use Decentraland's official helper. If it doesn't work in 1 hour of integration, ship without auth (hackathon-acceptable, document the trade-off). |
| Save thrashing on a long session                          | The 5-second debounce caps it; verify with a counter.                                                        |
| Schema evolution breaks existing profiles                 | `schemaVersion` field; on load, run a migrator if older. For v1 → v1, no-op.                                 |
| Cold-start load races gameplay (player casts before load) | Block input for the first 1.5 s OR accept that early casts use Plan B defaults; reconcile on load resolve. The latter is simpler — choose it. |
| Server cost balloons                                      | Hackathon-scale traffic is trivial; free tier covers it. Set a billing alert anyway.                          |

## When this step is done
Open `plan/15-audio-pass.md`. The game is feature-complete; from here it's polish.
