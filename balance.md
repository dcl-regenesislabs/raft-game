# Balance — current scene vs. Raft

This document is a tuning reference, not a spec. It captures every numeric knob that shapes player experience as of HEAD on `main`, sets them next to the equivalent values from the real Raft (Redbeet Interactive), and ends with a shortlist of suggested tweaks. No code changes here — this is decision input.

Sources: cited `file:line` for every scene constant. Raft numbers from the official Raft wiki pages where reachable, plus Steam community guides and modding-community references (the wiki itself returned 403 to direct fetches; values cross-checked against multiple secondary guides).

---

## 1. How items enter the world today

### 1.1 Floating debris spawn loop

`src/systems/garbageSpawner.ts`

| Knob | Value | Line |
| --- | --- | --- |
| `SPAWN_INTERVAL_S` | 30 s between groups | 18 |
| `GROUP_SIZE` | 5 items per group | 20 |
| `SPAWN_DISTANCE_MARGIN` | 35 m upstream of raft (clamped) | 24 |
| `BYPASS_MIN_MARGIN / MAX_MARGIN` | 3 / 9 m lateral band beyond raft AABB | 29–30 |
| `UPSTREAM_JITTER_M` | 3 m along-flow stagger inside a group | 33 |
| `DRIFT_SPEED` | 1.8 m/s (± 0.3 jitter) along flow | 35–36 |
| `MAP_EDGE_SPAWN_MARGIN` | 4 m no-spawn band inside parcel edge | 41 |

Effective throughput: **5 items / 30 s = 10 items/min**, gated by parcel size — in 5×5 demo most lateral slots clamp tight, in 50×50 the full upstream band is available.

### 1.2 Debris pool

`src/factories/floatingGarbage.ts:13`

```
['wood', 'barrel', 'plants', 'plastic', 'metal', 'fish']
```

Equally weighted at draw time. Per-group barrel cap of 1 enforced in the spawner (it's the rarest payoff item — barrels yield bundles on collect). `fish` here is the food source for cooking; collected as raw and rolled into `{sardines, squid, crab}` at hook-bank time.

### 1.3 Collection

`src/config/gameConfig.ts`

| Knob | Value | Line |
| --- | --- | --- |
| `HOOK_MIN/MAX_THROW_SPEED` | 6 / 18 m/s | 89–90 |
| `HOOK_CHARGE_DURATION_S` | 0.5 s to full charge | 93 |
| `HOOK_REEL_SPEED` | 7 m/s reel-back | 98 |
| `HOOK_COLLECT_RADIUS_XZ` | **1.8 m** XZ snag radius | 106 |
| `HOOK_MAX_FLIGHT_TIME_S` | 6 s flight cap | 102 |

One hook tier. Collection is instantaneous on radius overlap — no minigame, no charge cost.

### 1.4 Inventory

`src/ui/items.ts`

| Knob | Value | Line |
| --- | --- | --- |
| `BOTTOM_BAR_SLOT_COUNT` | 5 hotbar slots | 183 |
| `INVENTORY_TOTAL_SLOTS` | 30 total | 184 |
| Stack cap | **none** — single slot, count badge | implicit |

The hook is the only pre-seeded slot (line 195); everything else allocates a slot on first pickup.

---

## 2. Crafting & cooking

### 2.1 Craft recipes

`src/ui/craftableItems.ts:26–132`

| Output | Wood | Plants | Plastic | Metal | Rope | Time |
| --- | --- | --- | --- | --- | --- | --- |
| HAMMER | 4 | — | — | — | 2 | 4 s |
| PLATFORM | 2 | — | 2 | — | 1 | **1 s** |
| WOODEN SPEAR | 8 | — | — | — | 3 | 4 s |
| WATER PURIFIER | 6 | 5 | 4 | 2 | — | 4 s |
| GRILL | 6 | — | — | 3 | 3 | 4 s |
| FISHING ROD | 6 | — | — | — | 8 | 4 s |
| KNIFE | 2 | — | — | 8 | — | 4 s |
| CUP | 2 | — | 2 | — | — | 4 s |
| STORAGE | 8 | — | — | 4 | 4 | 4 s |

Default craft time 4 s (`src/ui/craftSession.ts:15`). Note: `rope` is consumed but **not produced** — it's drawn from the same drop pool as everything else, so the recipe table treats it as an interchangeable raw material rather than a crafted intermediate.

### 2.2 Cook recipes

`src/ui/cookableItems.ts` + `src/systems/grillCook.ts`

| Tier | Plate count | Cook time | Hunger | Notes |
| --- | --- | --- | --- | --- |
| 1-ing | 5 | 4 s | 12 | Fuel: 1 wood per cook |
| 2-ing | 15 | 5 s | 25 | + thematic modifiers (broth +10 thirst, salt −4 thirst, oil +10 bonus) |
| 3-ing | 8 | 6 s | 40 | Pasta variants carry +20 bonus reserve |
| 4-ing hero | 2 | 8 s | 60 | Best plates in the game |

Cook windows: ready at **60 s**, burns at **120 s** (`grillCook.ts:33–34`). 60 s of "ready" headroom is generous — there's no failure pressure.

### 2.3 Food effects

`src/ui/foodEffects.ts`

- Raw fish (sardines/squid/crab/mussels/clams): +4 hunger / **−2 thirst**.
- `freshWater` +25 thirst, `saltWater` **−25 thirst** (cup/purifier loop).
- `sea_salt` ingredient **−8 thirst** alone, recipes layer it as −4.

---

## 3. Survival & secondary loops

### 3.1 Stat drains

`src/config/gameConfig.ts:72–84`

| Stat | Drain | Time-to-empty from full | Line |
| --- | --- | --- | --- |
| Hunger | 0.09 pct·s⁻¹ | **18 min 31 s** | 72 |
| Thirst | 0.11 pct·s⁻¹ | **15 min 09 s** | 73 |
| Life (one empty) | 0.75 pct·s⁻¹ | 2 min 13 s after empty | 75 |
| Life (both empty) | 1.5 pct·s⁻¹ | 1 min 06 s after empty | 78 |
| Fall rescue cost | 25 pct flat | — | 84 |

### 3.2 Fishing

`src/systems/fishingRod.ts:69` + `gameConfig.ts:116–120`

| Knob | Value |
| --- | --- |
| Pool | `sardines, squid, crab` |
| Bite delay | 4–10 s after cast |
| Reaction window | 2 s |

Single rod tier; no bait, no fish-rarity weighting.

### 3.3 Shark director

`src/config/gameConfig.ts:28–66` — patrol of 3–12 sharks, scheduled attack every **5 min** (`SHARK_ATTACK_INTERVAL_S = 5 * 60`, line 34) while at least one non-Main platform exists.

---

## 4. Raft (real game) reference

### 4.1 Debris

- Spawns **only while the raft is moving**. Faster sails / engine ⇒ **lower** spawn rate (anti-pattern: speeding up gives less loot).
- Spawn line is perpendicular to heading, within ±14 foundations of the *initial* raft centroid — extending the raft outward doesn't widen the catch zone.
- Pool: barrel, plank-debris, plastic, palm-leaf, scrap. Plus seaweed and the occasional shark crate. Weights are uneven; planks and plastic dominate, scrap is rarer, barrels rarest.
- Collected by hand (in-water, slow), or by **hook tiers** with progressively longer throw and durability (Plastic → Scrap → Titanium), or passively by **Collection Net** structures placed on the raft edge.

### 4.2 Resource → recipe chain

Raft uses **derived intermediates**:

| Intermediate | Recipe |
| --- | --- |
| Rope | 2 palm leaves |
| Nail (×3) | 2 scrap |
| Plank | dried wood (post 1.0 — pre-1.0 wood was the raw) |

Then everything else consumes those intermediates:

| Output | Plank | Palm leaf | Plastic | Rope | Nail | Other |
| --- | --- | --- | --- | --- | --- | --- |
| Plastic Hook | 1 | — | 2 | — | — | — |
| Scrap Hook | 4 | — | — | 2 | — | 6 scrap, 1 bolt |
| Fishing Rod (wood) | 6 | — | — | 8 | — | — |
| Fishing Rod (metal) | — | — | — | 8 | — | 3 scrap, 1 bolt |
| Simple Grill | 6 | — | — | 3 | — | 1 scrap |
| Simple Purifier | 6 | 6 | 4 | — | — | — |
| Small Crop Plot | 6 | — | — | 4 | — | — |

Effect: every craft requires a *staged* gather (raw → intermediate → tool), so progression has natural friction.

### 4.3 Survival

- Hunger drain: **0.09 hunger·s⁻¹** on Normal (Easy ×0.6, Hard ×1.5). Time-to-empty from 100 ≈ 18:31 — **same as our scene**.
- Thirst drain (Normal): also ~0.09 thirst·s⁻¹ in modern builds (some sources cite parity with hunger; older patches were faster). Either way, ours at 0.11 is at the high end.
- Damage at empty: **0.75 HP·s⁻¹** — identical to our `LIFE_DAMAGE_SINGLE_PCT_PER_S`.
- Bonus hunger drains slower (0.07/s) and is the meta target — pasta-heavy plates exist for this reason.

### 4.4 Fishing

- Bite delay ≈ 5–10 s (community-measured) — matches our 4–10 s.
- **Two rod tiers**: wooden rod biases toward small fish (herring, pomfret); metal rod biases toward large (mackerel, catfish). Bait (Shark Bait, etc.) is a separate consumable loop.

### 4.5 Anti-pattern reference

- Raft's "moving slows debris" rule exists to discourage speedrun-sailing. We have no analog (no sail, no movement penalty) — fine for a hackathon, but worth knowing if a sail ever ships.

---

## 5. Side-by-side delta

| Knob | Scene now | Raft | Delta | Felt as |
| --- | --- | --- | --- | --- |
| Debris cadence | 5 items every 30 s (10/min, bursty) | Continuous while drifting | Bursty vs. ambient | "Nothing happens, then a wave" |
| Item pool | 6 kinds, equal weight, barrel-capped | ~6 kinds, plank/plastic-dominant | Ours is too uniform on rares | Metal/barrel feel underwhelmingly common |
| Hook range | 1.8 m, single tier | Tiered, range scales with tier | No upgrade vector | Throw skill never improves |
| Inventory cap | 30 slots, infinite stack | 20-stack cap per material in vanilla Raft | No reason to chain storages | Storage feels cosmetic |
| Recipe inputs | Raw only (wood, plastic, plants, rope, metal) | Raw → intermediate → tool | We skip the middle layer | Crafts are one-step trivial |
| Craft time | 4 s flat (1 s for platform) | Instant | Ours pads more | Slight dead time but readable |
| Hunger drain | 0.09 pct/s (=18:31) | 0.09/s (=18:31) | Parity | Fine |
| Thirst drain | 0.11 pct/s (=15:09) | ~0.09/s (≈18:31) | We drain ~22% faster | Thirst slightly nags |
| Empty-stat damage | 0.75 single / 1.5 both | 0.75 single | "Both empty" is doubled here | Death spiral is steeper |
| Cook burn window | 60 s ready → 120 s burn | n/a (Raft cooks on grill stages, no burn) | Generous, no penalty | Cooking is set-and-forget |
| Fishing | Single rod, 3-fish pool | Two rod tiers, ~10-fish pool with weighted rarity | No upgrade vector or rare catch | Fishing is "press-button" |
| Cooked plates | 28 dishes, pasta is dominant strategy | Recipes exist but spread across tiers | Ours is content-dense, narrow-strategy | Pasta meta crowds out rest |
| Shark cadence | 1 attack / 5 min while platforms exist | Continuous patrol, opportunistic bites | Ours is metronomic | Predictable instead of tense |

---

## 6. Recommended tuning shortlist

Numbers, not implementations. Each row is a one-line code change in the cited file.

### 6.1 Smooth out debris cadence
- `garbageSpawner.ts:18` `SPAWN_INTERVAL_S` **30 → 12**.
- `garbageSpawner.ts:20` `GROUP_SIZE` **5 → 3**.
- Net: ~15 items/min, distributed in smaller waves — feels ambient, not metered.

### 6.2 Bias the debris pool
- Replace the equal-weight draw in `floatingGarbage.ts:13` with a weighted distribution. Suggested weights: `wood 30, plants 22, plastic 20, fish 15, metal 10, barrel 3`. Keep the per-group barrel cap.
- Net: planks/plants are abundant (matches Raft baseline), metal/barrel become genuinely rewarding to spot.

### 6.3 Restore the intermediate layer
- Add one craft: **rope = 2 plants** (instant or 1 s, no station). Update existing recipes that currently consume `plants` for what's "really" rope (purifier 5 plants → 5 rope; fishing rod 8 rope already; spear 3 rope already).
- Net: progression gets a one-step gate without redesigning the loot pool. Adds purpose to the `plants` drop class.

### 6.4 Hook tier
- Gate `HOOK_COLLECT_RADIUS_XZ` (`gameConfig.ts:106`) behind a craftable upgrade: starter 1.8 m → Scrap Hook 2.4 m → Titanium Hook 3.0 m. Same constant becomes a per-tool override.
- Recipe sketch: `Scrap Hook = 4 wood / 2 rope / 2 metal`, `Titanium Hook = 6 metal / 4 rope / 1 barrel`.
- Net: late-game throw skill expands; barrels gain a non-loot use.

### 6.5 Inventory pressure
- Introduce a per-stack cap of **20** in `items.ts` (today's "infinite stack" is the reason `STORAGE` feels optional). Storage chest then has a higher effective per-slot cap (e.g. 99) so chests unlock a meaningful capacity tier.
- Net: gives `STORAGE` a real mechanical reason to exist, matches Raft inventory feel.

### 6.6 Survival nudges
- `THIRST_DRAIN_PCT_PER_S` 0.11 → **0.09** (parity with hunger and Raft).
- `LIFE_DAMAGE_BOTH_PCT_PER_S` 1.5 → **1.0** (still painful, less of a death spiral).
- Raw fish thirst penalty in `foodEffects.ts:35–39` from −2 → **−1** (raw fish is the survival fallback; current penalty makes it self-defeating against thirst).

### 6.7 Cooking pressure
- `COOK_BURN_SEC` (`grillCook.ts:34`) 120 → **90**. Keep `COOK_READY_SEC = 60` so the player still has a 30 s window — half of the previous slack.
- Net: grill becomes a thing you actually mind, not a fire-and-forget.

### 6.8 Fishing depth (stretch)
- Add a **bait** consumable (e.g. `seaweed → bait`) that, while held, biases the rod's roll toward `crab` and `squid` (heavier hunger plates) over `sardines`.
- Add a *Metal Fishing Rod* (recipe: 4 metal / 8 rope / 1 barrel) with a tighter bite window (3–7 s) and a 2-fish-per-catch chance.
- Net: gives fishing a progression pole that mirrors Raft's wood→metal rod.

---

## 7. Open questions

- **Difficulty modes.** Raft has Easy ×0.6 / Normal ×1.0 / Hard ×1.5 multipliers on hunger/thirst. Worth exposing for the demo (kid mode) vs. full (standard)?
- **DEMO vs FULL scaling.** Should `SPAWN_INTERVAL_S` or `GROUP_SIZE` scale with parcel area? In the 50×50 FULL build a constant cadence may starve the lateral band; in the 5×5 DEMO it may flood the deck.
- **Sail / movement penalty.** If a sail ever ships, mirroring Raft's "moving = less debris" needs a design call — either copy it or explicitly reject it.
- **Recipe discoverability.** With or without intermediates, the craft panel currently shows everything from t=0. Raft gates recipes via the Research Table. Same hackathon scope question: lock or unlock?

---

_Last verified against `main` on 2026-05-08._
