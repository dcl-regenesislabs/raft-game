# Step 01 — Asset Acquisition & Style Lock

## Goal
Gather every visual, audio, and UI asset the game will need, so the next 16 steps can pull from a fixed library instead of pausing to source content.

## Why this step exists here
- **Style is decided once, not per-feature.** If we build casting before fish exist, the bobber's mood won't match the fish's mood, and we'll re-skin twice.
- **Asset sourcing is the highest-variance task in the schedule.** Failing fast here (a model is too high-poly, a sound is wrong tone) is cheap. Failing on day 14 is fatal.
- **The performance budget (GDD §7) is enforced at *import*, not at code review.** A 12k-tri fish fails this step, not the catch system.
- **It unblocks parallelism.** Once the library exists, Steps 02–07 can run while Steps 08, 13 art-tweak in parallel.

## Depends on
Nothing. This is the entry point.

## Adds
- A populated `assets/` and `images/` tree, organized by purpose.
- A short `STYLE.md` reference: palette swatches, mood references, naming conventions, file-format rules.
- A `BUDGETS.md` reference: per-asset triangle/texture/audio caps with current usage.
- A `LICENSES.md` listing the source + license of every third-party asset (CC0, DCL Asset Library, AI-generated, etc.). Required for hackathon submission.

## Out of scope
- Wiring assets into the scene (Step 02).
- Custom shaders (Step 02 uses default Material with the imported textures; advanced water shader is Step 16).
- VFX systems (particles are placed only in Step 16; the textures/sprites they consume are sourced here).
- Animations beyond what ships inside the GLB (e.g. fish swim cycle baked into the model is in scope; runtime tweens are Step 04+).

## Acceptance criteria
A teammate (or future-you) opens the repo cold and can:

1. See a populated asset tree matching the structure below.
2. Open `STYLE.md` and answer "what color is the water?" "what's the fish-model triangle cap?" without guessing.
3. Open `BUDGETS.md` and see current totals **under** every limit in GDD §7 (≤80k tris, ≤80MB scene, ≤5MB audio).
4. Spot-check three random assets in `LICENSES.md` and find their source URL + license.
5. Drop a fish GLB into a blank Decentraland scene and see it render in the intended palette without further work.

## Asset inventory

### A. Environment (target ≤50,000 tris total)

| Group              | Items                                                         | Notes                                                                |
|--------------------|---------------------------------------------------------------|----------------------------------------------------------------------|
| Pond + water       | 1 water plane GLB, 1 normal-map texture                       | Plane is flat; animated normal map is a Step 16 enhancement          |
| Terrain / shore    | 1 shore mesh, ground texture (atlas)                          | One mesh wrapping the pond; minimize unique materials                |
| Dock               | 1 wooden dock GLB                                             | This is also where the merchant stands                               |
| Lily Cove dressing | Lily pads, soft reeds, glowing flowers                        | Lush, mint-green glow; this is the "starter" zone, friendliest tone  |
| Starwell dressing  | Glowing rocks, bioluminescent kelp, mystical glyph stones     | Mid-tier; deeper colors, softer light                                |
| The Deep dressing  | Twisted dead trees, dark fog plane, eerie roots               | Endgame; minimal saturation, single warm accent                      |
| Lighting props     | Amber lanterns (stationary), mushroom lights                  | Provide the warm-vs-cool color contrast called out in GDD §7 palette |
| Skybox / backdrop  | Lavender twilight skybox or large dome                        | Static; do not add a day/night cycle (stretch goal §11)              |

### B. Fish (12 species, ≤300 tris each, ≤3,600 tris total)

Order matches GDD §A. Each fish is one GLB. Texture sheet may be shared across same-rarity fish.

| # | Name              | Rarity    | Visual brief                                 |
|---|-------------------|-----------|----------------------------------------------|
| 1 | Lily Minnow       | Common    | Tiny silver, faint pink underside            |
| 2 | Mossback Carp     | Common    | Olive-green back, mossy texture              |
| 3 | Sunfish Spark     | Common    | Yellow body with orange specks               |
| 4 | Brook Tetra       | Common    | Translucent body, neon blue stripe           |
| 5 | Glimmer Eel       | Uncommon  | Slim, iridescent purple                      |
| 6 | Dusk Pike         | Uncommon  | Long, indigo with faint star pattern         |
| 7 | Moonscale Bass    | Uncommon  | Pale blue scales, moon-disc head marking     |
| 8 | Star Trout        | Rare      | Deep blue with constellation speckles        |
| 9 | Hollow Catfish    | Rare      | Translucent body, glowing organs             |
|10 | Voidray           | Epic      | Black with violet fin glow                   |
|11 | Phantom Sturgeon  | Epic      | Long, ghostly silver-white                   |
|12 | The Pondkeeper    | Legendary | Massive, dark robes-of-fins, golden eyes     |

### C. Equipment (3 rods + bobber + line)

| Item        | Notes                                                                 |
|-------------|-----------------------------------------------------------------------|
| Twig Rod    | Rough wood, simple — looks like a stick. The "free starter" silhouette |
| Mystic Rod  | Carved wood with faint runes, soft glow                               |
| Crystal Rod | Polished crystal shaft, strong glow, treated as endgame trophy        |
| Bobber      | Small sphere, two-tone, faint glow so it reads at distance            |
| Line        | Thin cylinder mesh OR simple line-render-friendly texture             |

### D. Characters

| Item        | Notes                                                                                       |
|-------------|---------------------------------------------------------------------------------------------|
| Merchant NPC | Built using DCL NPC Toolkit (GDD §4.7). Sourced/configured here, wired in Step 10.         |

### E. VFX source assets (not systems — just textures/sprites)

| Asset                    | Notes                                                       |
|--------------------------|-------------------------------------------------------------|
| Splash sprite/sheet      | For bobber-landing splash (Step 04 reads this)              |
| Bubble particle texture  | For idle pond bubbles                                       |
| Sparkle / star sprite    | For rare-catch moments                                      |
| Ripple decal             | For bobber-on-water ring                                    |
| Glow disk                | Reused for lanterns, rod tips, rare-fish auras              |

### F. UI assets (`images/`)

| Asset                        | Notes                                                         |
|------------------------------|---------------------------------------------------------------|
| HUD currency frame           | Top-right, holds Pearls value                                 |
| HUD rod slot                 | Shows currently equipped rod icon                             |
| HUD bestiary button          | Top-right cluster                                             |
| Zone-name banner             | Top-center, fades in/out                                      |
| Power-meter strip            | Three-zone gradient (red → yellow → green)                    |
| Power-meter marker           | Travels left-to-right                                         |
| Reel-bar background          | Vertical bar frame                                            |
| Reel-bar player-zone band    | Movable colored band                                          |
| Reel-bar fish-target icon    | Small fish silhouette                                         |
| Reel progress bar            | Fills/drains horizontally at the bottom                       |
| Catch-reveal modal frame     | Holds fish render + name + stats + Keep/Sell                  |
| Bestiary grid frame + cells  | 12 cells, locked vs unlocked variants                         |
| Welcome popup frame          | Step 16 uses this; sourced now                                |
| Rod-shop modal frame         | Step 11 uses this                                             |
| Buttons (idle / pressed)     | One reusable set, ≥48dp tap target                            |
| Rarity badges                | Common / Uncommon / Rare / Epic / Legendary — five badges     |
| Rod icons                    | One per rod (3 total)                                         |
| "!" hook prompt              | Large red exclamation                                         |
| Shake prompt                 | Side-of-screen tap-to-shake icon                              |
| Pearl/coin icon              | Currency unit                                                 |

### G. Audio (target ≤5 MB total)

| Asset                       | Notes                                                          |
|-----------------------------|----------------------------------------------------------------|
| Ambient bed loop (~30s OGG) | Soft pad + birds + distant water; mono                         |
| Cast whoosh                 | Short, airy                                                    |
| Bobber splash               | Wet, low                                                       |
| Bite tug                    | Clear, alerting — must read instantly on mobile                |
| Reel tension loop           | Short loop, pitch up via `volume`/`pitch` as progress fills    |
| Catch jingle — Common       | 1 note, soft                                                   |
| Catch jingle — Uncommon     | 2 notes                                                        |
| Catch jingle — Rare         | 3 notes                                                        |
| Catch jingle — Epic         | 4 notes, brighter                                              |
| Catch jingle — Legendary    | 4-note arpeggio + sparkle layer                                |
| Sell SFX                    | Coin clink                                                     |
| UI tap                      | Subtle click for buttons                                       |
| Hook miss                   | Soft "fwip" — failure should not feel punitive                 |

## Sources & sourcing strategy

In priority order — exhaust the cheaper option before escalating:

1. **Decentraland Asset Library** (free, license-clean, format-correct). Cover environment first.
2. **Sketchfab CC0** (filter by `Downloadable` + `CC0`). Good for fish, rocks, props.
3. **AI-generated 3D** (Meshy or Tripo). Reserved for the 12 fish if a single artist runs the project. **Cap: 30 minutes of iteration per fish** (GDD §12 mitigation).
4. **freesound.org** (CC0) + itch.io free music packs for audio.
5. **Hand-authored** — only for UI graphics and the rod silhouettes if no good source exists.

Every asset gets logged in `LICENSES.md` at import time. No exceptions; this is a hackathon submission requirement.

## File-format & naming rules

- 3D: `.glb` only (GDD §7). `.gltf` is acceptable but `.glb` is preferred for fewer files.
- Textures: `.png` (alpha) or `.jpg` (no alpha). Max 2K, atlased aggressively.
- Audio: `.ogg` mono. Stereo is reserved for the ambient bed only if needed.
- UI: `.png` with transparent background, exported at 2× for retina readability.
- Names: `kebab-case`, prefixed by category — `fish-lily-minnow.glb`, `ui-rod-icon-mystic.png`, `sfx-catch-rare.ogg`. No spaces, no PascalCase.

## Folder structure (created during this step)

```
assets/
  environment/
    pond/
    shore/
    dock/
    lily-cove/
    starwell/
    the-deep/
    lighting/
    sky/
  fish/
    common/
    uncommon/
    rare/
    epic/
    legendary/
  rods/
  bobber/
  npc/
  vfx/
  audio/
    music/
    sfx/
images/
  hud/
  modals/
  buttons/
  icons/
  badges/
  prompts/
plan/
  STYLE.md          ← created in this step
  BUDGETS.md        ← created in this step
  LICENSES.md       ← created in this step
```

(`assets/` and `images/` already exist per CLAUDE.md; this step subdivides them.)

## Implementation notes (no code)

This is a sourcing + organization task. The order to execute it in:

1. **Style lock first.** Pin three reference images (one per zone mood) into `STYLE.md`. Lock the palette: deep navy water, lavender sky, mint-green flora, warm amber lanterns. Every subsequent asset is judged against this swatch — if it doesn't fit, recolor or reject.
2. **Build the budget tracker.** `BUDGETS.md` is a small living table: row per category, columns for cap / current / headroom. It's updated *as assets are added*, not retroactively.
3. **Source environment first.** It's the largest tri count and the visual frame for everything else. Get pond + shore + dock + sky in place mentally before fish.
4. **Source equipment.** Three rods + bobber. Rods set the player-character silhouette tone.
5. **Source fish in waves.** Commons first (4 fish, simplest mood), then uncommons, then rares, then epics, then the legendary. The Pondkeeper is sourced last — it's the centerpiece and benefits from the most calibrated reference.
6. **Source UI flat.** The eleven UI groups in section F. Use a single button style across the whole game; don't differentiate by screen.
7. **Source audio.** Ambient bed first — it's the longest file and sets tone. Then SFX in the order the player encounters them: cast → splash → bite → reel → catch jingle → sell.
8. **Final budget audit.** Add up `BUDGETS.md`. If anything's over, decimate the offender (or atlas, or remove a fish-roster duplicate texture). Do not advance to Step 02 until every row is green.

Pseudo-flow for the per-asset import gate:

```
for each asset being added:
    inspect file size, triangle count, texture resolution
    if violates BUDGETS.md cap:
        reject, find a smaller alternative or decimate
    rename to kebab-case + category prefix
    move to the matching subfolder
    append a row to LICENSES.md (name, source URL, license, attribution-required Y/N)
    bump current-usage row in BUDGETS.md
```

## Risks for this step

| Risk                                                   | Mitigation                                                                                                |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Fish models from Meshy/Tripo are too high-poly         | Decimate in Blender to ≤300 tris; reject anything that needs >5 min of cleanup and re-prompt the AI tool. |
| UI styles drift between screens                        | One palette + one button set + one font, all locked in `STYLE.md` before any UI asset is sourced.         |
| Licenses not tracked → submission gets blocked         | `LICENSES.md` row is added the same minute the file lands in `assets/`. No file lives un-logged.          |
| Sourcing balloons past day 1                           | Hard cut: 30 min/fish, 1 hour/zone-dressing, 30 min total for all UI buttons. Use placeholders if needed. |
| Audio ambient feels wrong against final environment    | Re-source allowed only in Step 15 (audio pass). Do not retune in this step — pick one and lock it.        |

## When this step is done

Open the next file: `plan/02-scene-layout-and-environment.md` (to be written after this step is complete; defining it now would calcify decisions that depend on the actual asset list landing).

The completion criterion: every Acceptance Criteria item above passes, and `BUDGETS.md` shows green across the board.
