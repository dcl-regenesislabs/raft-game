# 🎣 MYSTIC POND
### Game Design Document — Decentraland Mobile Hackathon
**Version:** 1.0 · **Date:** April 2026 · **Scope:** 3-week hackathon build · **Platform:** Decentraland (Mobile + Desktop, SDK 7)

---

## 1. Executive Summary

**Mystic Pond** is a single-player, casual fishing experience built for Decentraland's new mobile client. Inspired by Roblox's *Fisch* (4.3B+ visits) — but reimagined as a calm, mystical pond rather than a sprawling open world — it delivers a complete cast → bite → reel → upgrade loop inside a single 4×4 parcel.

The fantasy is simple and timeless: walk up to a glowing pond, cast your line, feel the tug of something rare, and reel it in. Every catch grows your bestiary, fills your wallet, and pulls you toward the next rod upgrade. It's the kind of loop you can play for 90 seconds between meetings or 30 minutes at night — and it sells the *unique sensation* of fishing in a virtual world you can actually walk around in.

| Attribute | Value |
|---|---|
| **Genre** | Casual / Idle-adjacent / Collection |
| **Players** | Single-player (with shared leaderboard) |
| **Session length** | 90 sec – 10 min, fully resumable |
| **Scene size** | 1 parcel (16m × 16m) — Decentraland World deployment |
| **Performance target** | ≥30 FPS on mid-tier Android, ≤120 MB scene |
| **Dev time** | 3 weeks, 1–2 devs + 1 artist (or AI-assisted assets) |
| **Tech** | SDK 7, TypeScript, no external physics |

---

## 2. Design Pillars

These four pillars are decision filters. When in doubt during the sprint, the answer is whatever serves these best.

**🌙 Calm, not grindy.** The competing fishing games (Fisch, Fish It) lean into RPG depth. We deliberately go the other direction: a peaceful, meditative tone. Ambient music, soft splashes, no enemies. This is our differentiator and it also massively reduces hackathon scope.

**👆 Tap-first, always.** Every mechanic must be playable with one thumb. If it requires precision movement or two-handed input, it's redesigned or cut. This guarantees the mobile experience is great and desktop becomes a free upgrade.

**🌍 Decentraland-native.** The player physically walks to fishing spots inside the parcel. We don't fight DCL's spatial nature — we use it. Three small zones in the parcel each have a different fish pool, giving players a reason to actually move.

**🎁 Always one more cast.** Every catch gives at least one of: currency, bestiary entry, weight record, or rare-pull dopamine. The player should never finish a cast with nothing.

---

## 3. The Core Gameplay Loop

The 45-second moment-to-moment is everything. This is what we'll be judged on.

```
┌──────────────────────────────────────────────────────────────┐
│  WALK TO POND  →  CAST  →  WAIT/SHAKE  →  HOOK  →  REEL      │
│       ↑                                                ↓     │
│       │            CATCH REVEAL  ←  SUCCESS / FAIL          │
│       │                    ↓                                 │
│       └──── SELL / LOG IN BESTIARY  ←  INVENTORY  ←─────────┘
│                          ↓                                   │
│                  UPGRADE ROD  →  unlocks rarer fish          │
└──────────────────────────────────────────────────────────────┘
```

A complete loop on the starter rod takes roughly 30–45 seconds. With upgrades and rarer fish, individual catches can stretch to 60–90 seconds because the reel minigame gets harder.

---

## 4. Game Mechanics (Detailed)

### 4.1 Casting

Walking into a fishing zone shows a floating prompt: **"Tap & hold to cast."**

- Player taps and holds — a horizontal **power meter** appears above the rod.
- A marker oscillates left-to-right across the meter. The meter has three zones: red (weak cast, lands close), yellow (decent), green (perfect cast, lands in the deep spot where rare fish spawn).
- Releasing the tap launches the bobber on a parabolic arc using SDK 7's `Tween` component. No physics engine needed — the arc is procedural.
- Where the bobber lands determines the **fish pool** drawn from for this cast (close = common-weighted, deep = rare-weighted).

**Why it works on mobile:** Hold-and-release is a two-state input. No drag, no precision aim. Identical experience on desktop with mouse hold.

### 4.2 The Bite (with optional Shake)

Bobber lands. A **wait timer** starts (random, 3–8 seconds, modified by rod stats).

During the wait, an optional **"Shake!"** prompt blinks on the side of the screen. Each tap shaves ~0.5s off the wait timer. This is borrowed directly from Fisch and serves a real purpose: it gives the player something to do during the wait, making the game feel responsive instead of idle.

When the timer expires, a large **red "!"** appears above the player's head and a clear audio cue plays. The player has a **1.2-second window** to tap to set the hook. Miss it and the fish escapes (no reward, no penalty — just back to cast).

### 4.3 The Reel Minigame

This is the skill check and the heart of the game. It must feel great.

**Visual:** A vertical bar appears on the right side of the screen.
- A **fish icon** (the target) drifts up and down at varying speeds.
- A **player zone** (a colored band) is controlled by hold-input: tap-and-hold moves the band up; release lets it fall. Gravity pulls it down constantly.
- A **progress bar** at the bottom fills when the fish icon is inside the player zone, and drains when outside.
- Fill the progress bar → catch. Drain to zero → fish escapes.

```
┌─────────────────┐
│       [🐟]      │  ← fish target (AI-driven movement)
│         │       │
│   ┌─────┴───┐   │
│   │ player  │   │  ← controlled by tap-hold
│   │  zone   │   │
│   └─────────┘   │
│                 │
│ ▓▓▓▓▓░░░░░░░░  │  ← progress bar (fills/drains)
└─────────────────┘
```

**Difficulty knobs (per fish):**
- Fish movement speed (how fast the target moves)
- Fish movement randomness (predictability)
- Player zone size (smaller = harder, modified by rod's *Control* stat)
- Progress drain rate (modified by rod's *Power* stat)

This is the same hold/release pattern as Fisch's reel minigame, which we know works well on mobile because Fisch is one of the top mobile-played games on Roblox.

**Perfect catch bonus:** If the progress bar never decreases during the minigame, the player gets a "Perfect!" notification and a 50% currency bonus. This rewards skill without punishing casual players.

### 4.4 The Fish System

Each fish is defined by:

| Property | Description |
|---|---|
| **Name** | e.g., "Moonscale Carp", "Glimmer Eel" |
| **Rarity** | Common / Uncommon / Rare / Epic / Legendary |
| **Base weight range** | e.g., 0.5–2.0 kg |
| **Base value** | C$ per kg |
| **Zone** | Which fishing spot it spawns at |
| **Difficulty profile** | Movement speed + randomness for the reel minigame |
| **Visual asset** | Low-poly fish model (~300 tris) |

When caught, a fish gets a rolled weight within its range. **Weight × value × rarity multiplier = sell price.** This creates "wow" moments when players land an especially heavy specimen.

**MVP target: 12 fish species** across 3 rarity tiers. This is enough to feel rich but is achievable in one week of content work.

### 4.5 Rod Progression

Rods are the primary upgrade vector. Each rod has four stats:

| Stat | Effect |
|---|---|
| **Power** | Slows progress drain in the reel minigame |
| **Control** | Increases the size of the player zone |
| **Lure Speed** | Reduces wait time before a bite |
| **Luck** | Shifts fish pool toward higher rarity |

**MVP rod tree (3 rods):**

| Rod | Cost | Power | Control | Lure | Luck | Notes |
|---|---|---|---|---|---|---|
| 🪵 **Twig Rod** | starter (free) | 1 | 1 | 1 | 0 | Starter, struggles on rare fish |
| 🔮 **Mystic Rod** | C$ 500 | 3 | 2 | 2 | 1 | Mid-tier, comfortable on most fish |
| 💎 **Crystal Rod** | C$ 5,000 | 5 | 4 | 4 | 3 | Endgame, can land legendaries reliably |

Three rods is a deliberate choice: it's enough to feel like progression without ballooning the balance work. Stretch goal can add rods 4 and 5.

### 4.6 Fishing Zones (in-parcel)

The 16×16m parcel is divided into three small zones. Each is visually distinct and has its own fish pool:

- 🌿 **Lily Cove** (shallow, lush) — Commons + low Uncommons. Where new players start.
- 🌌 **Starwell** (deep, glowing) — Uncommons + Rares. Unlocks visually once player reaches level 2.
- 🌑 **The Deep** (dark, eerie) — Rares + Epics + chance at Legendaries. Unlocks at level 4.

"Unlocking" is purely environmental — invisible barriers (or visual gating like rising water) keep early players from accessing endgame zones. This is a design technique that works in DCL because we control the entire scene.

### 4.7 Currency, Selling & Bestiary

- **Currency:** *Pearls* (C$). In-game only — **no real MANA or crypto**, to avoid scope creep on blockchain integration during the hackathon. Stretch goal can introduce real MANA-redeemable tokens later.
- **Merchant NPC** at the dock. Walk up, tap to interact, sell individual fish or "sell all". Built using the SDK 7 NPC Toolkit library.
- **Bestiary** — a UI panel showing all 12 species. For each: caught (yes/no), heaviest specimen, rarity tier. Completing the bestiary triggers a special end-game event (stretch: free Crystal Rod, or a wearable reward).

---

## 5. Progression & Pacing

The first 5 minutes need to be impeccable — that's how long judges will play.

| Time | Player experience |
|---|---|
| 0:00–0:30 | Welcome popup, tutorial prompt at Lily Cove, first cast |
| 0:30–1:30 | First catch (rigged to be a Common, easy reel) — sells for first C$ |
| 1:30–3:00 | 3–4 more catches, builds bestiary, currency creeps up |
| 3:00–5:00 | Hits C$ 500, can buy Mystic Rod — first major progression beat |
| 5:00–10:00 | Explores Starwell zone, lands first Rare, dopamine hit |
| 10:00+ | Grind toward Crystal Rod (C$ 5,000), chase legendary in The Deep |

The first catch is **soft-rigged** to succeed (oversized player zone, slow fish) so no one bounces in their first 30 seconds. From cast 2 onward it's normal balance.

---

## 6. UI / UX

### 6.1 Persistent HUD

Minimal, always-visible:
- 💰 Pearls counter (top-right)
- 🎣 Currently equipped rod icon (top-right, below currency)
- 📖 Bestiary button (top-right)
- 📍 Current zone name + rarity hint (top-center, fades out after 3s)

### 6.2 Contextual UI

- **Cast power meter** — appears only while charging
- **Shake prompt** — appears only during wait
- **Reel minigame** — full-screen overlay during reel
- **Catch reveal modal** — shows fish image, name, rarity, weight, value, "Keep / Sell" buttons

### 6.3 Mobile considerations

- All tap targets ≥48dp (Android) / 44pt (iOS) per platform guidelines
- No required text input
- All critical info on the right edge (where the thumb naturally rests)
- Decentraland's default UI overlays our scene — design around the bottom-left controls and top status bar

### 6.4 Welcome message

A non-intrusive popup on entry following Decentraland's UX guidelines: scene name, one-line objective ("Catch fish, fill the bestiary, become a master angler"), and a "Got it" tap-to-dismiss button.

---

## 7. Art Direction

**Visual mood:** A serene mystical pond at twilight. Bioluminescent plants glow softly along the shore. The water has a subtle animated normal map and slight color shift. Think *Spirited Away* bathhouse + *Animal Crossing* serenity.

**Palette:** Deep navy water, lavender sky, mint-green glowing flora, warm amber dock lanterns. Fish use saturated colors against the muted environment so catches feel special.

**Asset budget (per the 4×4 parcel limits):**
- Total triangles: ≤ 80,000 (well under the 160k limit, leaves headroom)
- Textures: 2K max, atlased aggressively
- Fish models: ~300 tris each × 12 = 3,600 tris
- Environment: ~50,000 tris
- Effects (water, glow, particles): ~10,000 tris
- File size: target ≤ 80 MB (limit is 240 MB)

**Sources:** Decentraland Asset Library has a usable starter library. We'll supplement with Sketchfab CC0 assets and AI-generated 3D models (Meshy, Tripo) for fish if the artist is solo. All assets must be `.gltf` or `.glb`.

---

## 8. Audio

Audio is high leverage — it's a calm fishing game and silence kills the vibe.

- **Ambient bed** — looping soft pad with bird/water foley (~30 sec loop, mono OGG)
- **Cast SFX** — whoosh + splash on bobber landing
- **Bite SFX** — clear, alerting "tug" sound on the "!" prompt
- **Reel SFX** — subtle line tension that pitches up as progress fills
- **Catch jingle** — short, bright, rarity-tiered (commons get 1 note, legendaries get a 4-note arpeggio)
- **Sell SFX** — coin clink

Total audio budget: ≤ 5 MB. Source freesound.org (CC0) and itch.io free music packs.

---

## 9. Decentraland-Specific Implementation

### 9.1 SDK 7 architecture

ECS-based, using SDK 7 patterns:

**Components (custom):**
- `FishingRod` — power, control, lure, luck stats
- `Bobber` — current position, target landing zone, tween state
- `Inventory` — list of caught fish + currency
- `FishSpawn` — zone-bound, weighted rarity table
- `BestiaryEntry` — species, caught flag, max weight

**Systems:**
- `CastingSystem` — handles power meter input, bobber tween
- `BiteSystem` — manages wait timer, shake taps, "!" trigger
- `ReelSystem` — runs the minigame, handles hold/release input
- `CatchSystem` — rolls fish from pool, applies weight, updates inventory
- `MerchantSystem` — sell flow, currency update

### 9.2 Persistence

The painful one. SDK 7 scenes can't directly write to disk; they need a backend.

**Plan A (preferred):** Lightweight Node.js server (deployed on Railway/Fly.io) with a single `/player/:address` endpoint storing JSON. Auth via Decentraland's signed-fetch helper to verify the player's wallet.

**Plan B (fallback if backend slips):** Per-session only — player progress resets when they leave the scene. We add a clear "Demo session" notice. Acceptable for a hackathon judging playthrough since judges play 5–10 minutes.

### 9.3 Deployment

Deploy to a **Decentraland World** (no LAND required) tied to a Decentraland NAME. Cost: ~100 MANA for the NAME if we don't already have one. World deployment is faster to iterate than LAND deployment.

### 9.4 Hackathon judging alignment

Mapping our design to the standard DCL Game Jam judging criteria:

| Criterion | How we score |
|---|---|
| **Player experience** | First catch in <60s, tap-only controls, clear feedback |
| **Innovation** | First calm fishing game in DCL; uses spatial walking between zones |
| **Optimization** | 30+ FPS target, sub-80MB scene, asset budget enforced |
| **Gameplay depth** | 3-phase loop with skill expression in reel minigame |
| **Theme adherence** | Flexible — fits "fairground", "exploration", "calm", or "collection" themes |

---

## 10. Three-Week Sprint Plan

Tight, opinionated, with a hard cut-off for polish on Friday of week 3.

### Week 1 — Vertical Slice (Days 1–7)

**Goal: One fish, one rod, the full cast → reel → catch loop is playable end-to-end.**

| Day | Tasks |
|---|---|
| 1 | Project setup (SDK 7 scaffold, Creator Hub, repo). Block out parcel layout in Scene Editor. Pond shape, dock, basic lighting. |
| 2 | Walking + camera tested on mobile preview. Placeholder rod model. Casting prompt trigger zone working. |
| 3 | Casting mechanic — power meter UI, bobber tween, landing detection. |
| 4 | Wait timer + bite indicator + hook tap. |
| 5 | Reel minigame — UI, hold/release input, win/lose states. |
| 6 | One fish wired in (Common Carp), full loop functional, catch modal. |
| 7 | **Milestone: vertical slice playable on mobile.** Internal playtest. |

### Week 2 — Systems & Content (Days 8–14)

**Goal: Real game with progression, multiple fish, economy, and zones.**

| Day | Tasks |
|---|---|
| 8 | Fish data layer — 12 species with rarity, value, difficulty profiles. JSON-driven so balancing is easy. |
| 9 | Inventory UI + sell-to-merchant flow. NPC Toolkit integrated. |
| 10 | Currency persistence (backend Plan A or local Plan B). Rod shop UI. |
| 11 | 3 rods implemented with stat effects on the reel minigame. |
| 12 | Bestiary UI — grid view, caught/uncaught states, max weight tracking. |
| 13 | Three fishing zones built and visually distinct. Zone-gating logic by player level. |
| 14 | **Milestone: feature-complete game.** Full external playtest with 3+ players. |

### Week 3 — Polish & Submit (Days 15–21)

**Goal: Make it feel great, hit performance targets, ship.**

| Day | Tasks |
|---|---|
| 15 | Art polish pass — final environment models, lighting, water shader, glow effects. |
| 16 | Audio implementation — ambient bed, all SFX, catch jingles. |
| 17 | UX polish — welcome popup, tutorial prompts, juicy feedback (screen shake, particles, haptics on mobile). |
| 18 | Performance optimization — profile on mid-tier Android, reduce draw calls, atlas textures. Target 30+ FPS. |
| 19 | Stretch goal sprint (one of: leaderboard, wearable reward via Quests Service, weather/time-of-day effects). |
| 20 | Final QA — full bestiary playthrough, edge cases, crash testing, mobile + desktop parity check. |
| 21 | **Submit.** Deploy to World, record gameplay video, write itch.io description, fill in submission form. |

---

## 11. Scope: MVP vs. Stretch

**MVP (must ship by end of week 3):**
- ✅ Cast → wait → hook → reel → catch loop
- ✅ 12 fish across 3 rarities
- ✅ 3 rods with meaningful stat differences
- ✅ 3 in-parcel fishing zones
- ✅ Sell to merchant + Pearls economy
- ✅ Bestiary
- ✅ Persistence (Plan A or B)
- ✅ Mobile-tested, 30+ FPS
- ✅ Welcome popup, basic tutorial flow

**Stretch goals (build only if MVP is solid):**
- 🌟 Bait system (3 bait types, each modifying one stat)
- 🌟 Day/night cycle affecting which fish appear
- 🌟 Weather event (rain spawn boost for one rare fish)
- 🌟 Bestiary completion reward (DCL wearable via Quests Service — judges love this)
- 🌟 Global leaderboard (heaviest fish caught)
- 🌟 Two more rods (Stages 4 and 5)
- 🌟 4th fishing zone unlocked at level 6

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Reel minigame doesn't feel good on mobile | High | High | Playtest from day 5, tune drain rate and zone size empirically |
| Backend persistence slips | Medium | Medium | Plan B (session-only) is acceptable; cut early if needed |
| Asset pipeline (custom 3D models) takes too long | Medium | High | Use DCL Asset Library + AI-generated assets; cap fish model time at 30 min each |
| Performance below 30 FPS on mid-tier Android | Medium | High | Strict triangle/texture budget enforced from day 1, profile at end of each week |
| Scene exceeds size limit | Low | High | Audit on day 14 before content lock |
| Team sickness / availability | Medium | Medium | All tasks documented in shared board; any one task ≤1 day |

---

## 13. Success Metrics (post-hackathon)

If we win or place: great. But the real success metrics for a hackathon submission are:

- **Engagement:** Average judge session > 5 minutes
- **Completion:** ≥1 judge catches a Rare or higher fish
- **Performance:** 30+ FPS sustained on mobile
- **Polish signal:** Zero critical bugs in the judging window
- **Memorability:** The game gets a name-check in judges' deliberation

---

## 14. Appendices

### A. Sample fish list (12 species)

| # | Name | Rarity | Zone | Weight (kg) | Base value (C$/kg) |
|---|---|---|---|---|---|
| 1 | Lily Minnow | Common | Lily Cove | 0.2–0.6 | 5 |
| 2 | Mossback Carp | Common | Lily Cove | 1.0–3.0 | 8 |
| 3 | Sunfish Spark | Common | Lily Cove | 0.5–1.5 | 10 |
| 4 | Brook Tetra | Common | Lily Cove | 0.3–0.8 | 12 |
| 5 | Glimmer Eel | Uncommon | Starwell | 1.5–4.0 | 25 |
| 6 | Dusk Pike | Uncommon | Starwell | 2.0–5.0 | 30 |
| 7 | Moonscale Bass | Uncommon | Starwell | 1.8–4.5 | 35 |
| 8 | Star Trout | Rare | Starwell | 2.5–6.0 | 80 |
| 9 | Hollow Catfish | Rare | The Deep | 4.0–8.0 | 120 |
| 10 | Voidray | Epic | The Deep | 5.0–10.0 | 300 |
| 11 | Phantom Sturgeon | Epic | The Deep | 6.0–15.0 | 450 |
| 12 | The Pondkeeper | Legendary | The Deep (1% chance) | 12.0–25.0 | 1,000 |

A full bestiary playthrough should net ~C$ 6,000–8,000, comfortably over the C$ 5,000 Crystal Rod target.

### B. Reference games & inspirations

- **Fisch (Roblox)** — primary loop reference. We borrow the cast → shake → reel three-phase structure, simplified.
- **Animal Crossing** — calm tone, satisfying small rewards, no failure state that punishes.
- **Stardew Valley** — fishing minigame UI inspiration (vertical bar with target zone).
- **Webfishing** — proof that a small-scope, calm fishing game can hit hard with no combat.

### C. Open questions for kickoff meeting

1. Are we targeting a specific Game Jam theme this round, and does it constrain the visual direction?
2. Do we have an artist or are we going AI-asset + Asset Library?
3. Backend hosting — Railway, Fly.io, or self-hosted? Who owns ops?
4. Is the wearable reward stretch goal worth the DAO submission overhead, or skip for a leaderboard?
5. Who's the primary playtester for week 1's mobile feedback?

---

*End of document. Total word count ~3,400. Ready to slice into Linear / Notion tickets.*
