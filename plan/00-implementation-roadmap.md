# Implementation Roadmap — Mystic Pond

> Source: `product-mystic-pond-gdd.md`. This roadmap slices the GDD into incremental steps. Every step is a strict prerequisite for the next — skipping is not allowed. Each step has its own detailed file (`01-…md`, `02-…md`, etc.).

## Guiding principles

- **No code is written until Step 2.** Step 1 locks the visual + audio identity so we never re-skin the game.
- **Each step ships a playable (or at least visible) increment.** If a step's acceptance criteria can't be demoed, the slice is wrong.
- **Vertical before horizontal.** A single fish through the full loop beats twelve fish that don't catch. Roster expansion happens late.
- **Performance budget is enforced from Step 1.** Triangle + texture + audio budgets are gates on asset import, not afterthoughts.

## Dependency chain

```
01 Assets
  └─► 02 Scene Layout & Environment
        └─► 03 Player Presence & Zone Detection
              └─► 04 Casting Mechanic
                    └─► 05 Bite & Hook Phase
                          └─► 06 Reel Minigame
                                └─► 07 Single-Fish Catch Loop  ◄── vertical slice complete
                                      └─► 08 Fish Roster & Data Layer
                                            └─► 09 Inventory & Currency
                                                  └─► 10 Merchant & Selling
                                                        └─► 11 Rods & Shop
                                                              └─► 12 Zones & Gating
                                                                    └─► 13 Bestiary
                                                                          └─► 14 Persistence
                                                                                └─► 15 Audio Pass
                                                                                      └─► 16 UX Polish
                                                                                            └─► 17 Perf & Submit
```

## Step index

| #  | Step                              | Maps to GDD            | Sprint week |
|----|-----------------------------------|------------------------|-------------|
| 01 | Asset acquisition & style lock    | §7, §8, §4.4, §4.5     | W1 d1       |
| 02 | Scene layout & environment        | §4.6, §10 W1 d1        | W1 d1–2     |
| 03 | Player presence & zone detection  | §10 W1 d2              | W1 d2       |
| 04 | Casting mechanic                  | §4.1                   | W1 d3       |
| 05 | Bite & hook phase                 | §4.2                   | W1 d4       |
| 06 | Reel minigame                     | §4.3                   | W1 d5       |
| 07 | Single-fish catch loop            | §10 W1 d6 (milestone)  | W1 d6–7     |
| 08 | Fish roster & data layer          | §4.4, §A               | W2 d8       |
| 09 | Inventory & currency              | §4.7                   | W2 d9       |
| 10 | Merchant NPC & selling            | §4.7                   | W2 d9       |
| 11 | Rods & shop                       | §4.5                   | W2 d10–11   |
| 12 | Zones & gating                    | §4.6                   | W2 d13      |
| 13 | Bestiary                          | §4.7                   | W2 d12      |
| 14 | Persistence                       | §9.2                   | W2 d10      |
| 15 | Audio pass                        | §8                     | W3 d16      |
| 16 | UX polish & onboarding            | §6, §10 W3 d17         | W3 d15–17   |
| 17 | Performance & submission          | §10 W3 d18–21          | W3 d18–21   |

## Step contract

Every step file follows the same shape so nothing is accidentally skipped:

1. **Goal** — one sentence the team can repeat from memory.
2. **Why this step exists here** — what blocks if it's skipped or done later.
3. **Depends on** — explicit list of prior steps whose output is consumed.
4. **Adds** — concrete new capability visible to a player or developer.
5. **Out of scope** — what we deliberately defer to a later step.
6. **Acceptance criteria** — checkable items, demo-able in <2 minutes.
7. **Implementation notes** — design-level only, no TypeScript. Pseudo-flow allowed for clarity.
8. **Risks for this step** — what trips us up most often, with mitigation.

## How to work through this plan

- Open `plan/01-asset-acquisition.md` and execute it to completion before opening `02`.
- Each step's "Acceptance criteria" is the gate — when they pass, mark the step done and move on. Do not partially advance.
- If reality forces a change to a future step, update that step's file *before* you arrive at it. The plan is the contract.
- Stretch goals from GDD §11 are not in the chain. They get appended after Step 17 if time remains.
