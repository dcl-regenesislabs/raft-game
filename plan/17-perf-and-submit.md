# Step 17 — Performance & Submission

## Goal
Hit ≥30 FPS on mid-tier Android, finish the QA pass, deploy to a Decentraland World, and submit to the hackathon.

## Why this step exists here
- **Performance is a *judging criterion***, not just a quality bar (GDD §9.4). A 25-FPS submission scores worse than a 30-FPS one regardless of features.
- **Doing it last is correct.** Optimizing earlier risks contorting the architecture before we know the hot spots. Now we have a complete game and a profiler that can tell us where time goes.
- **Submission has its own checklist** that isn't engineering. Bundling it into one final step prevents a forgotten form field from sinking the run.

## Depends on
- Steps 01–16. All systems and polish are in place.

## Adds (engineering)
- A formal performance profile on mid-tier Android: idle, walking, casting, reeling, catch reveal, full bestiary panel open.
- Triangle, draw call, and texture audits with concrete numbers vs. budget.
- Optimizations as needed:
  - Atlas textures across props of similar tone.
  - Combine static meshes where SDK 7 allows.
  - Reduce particle counts under target.
  - Trim unused fish models (sanity check there aren't 24 on disk for 12 fish).
  - LOD or distance-cull props that are far from the player.
- A final scene-size audit: ≤80 MB target (under GDD §7's 240 MB ceiling).

## Adds (submission)
- **Deploy** to a Decentraland World tied to a Decentraland NAME (~100 MANA if not already owned).
- **Gameplay video**: 60–90 s, captures the full loop + the calm vibe + a Rare or better catch.
- **itch.io / submission portal** description: name, one-line, three-line, link to World, short tech blurb (SDK 7, no real MANA, etc.).
- **Submission form**: fill every required field. License attestations from `LICENSES.md`.
- **Repo cleanup**: README updated with the World link, Steps 1–17 archived in `plan/`, no dev-only debug toggles enabled in the deployed build.

## Out of scope
- Stretch goals from §11 unless explicitly added in Step 16.
- Post-submission patches (different problem; out of the hackathon window).

## Acceptance criteria
1. Mid-tier Android sustains ≥30 FPS through a full happy-path session including catch + bestiary panel.
2. Scene size ≤80 MB; texture VRAM usage measurable and within budget.
3. Triangle count ≤80,000 (GDD §7).
4. World deployed, link reachable from a phone in incognito mode.
5. Gameplay video shows: cast (with power meter), bite (with shake + "!"), reel (with progress + perfect), catch reveal, sell, rod purchase, zone unlock if it fits in the runtime.
6. Submission form submitted with all assets, before the deadline.
7. Smoke test: a teammate not previously in the scene plays the full loop on phone in <2 minutes from cold link.

## Implementation notes (engineering)

**Profile order.** Always measure before changing.
1. Hook the SDK 7 stats overlay (or use the Creator Hub profiler).
2. Record FPS during each of the six scenarios above.
3. The biggest delta from 30 FPS is the optimization target. Address it. Re-measure.
4. Stop optimizing at "30 FPS sustained with 5 FPS headroom." Don't chase 60.

**Common wins.**
- Texture atlasing across the dock + lanterns + props that share a palette zone.
- Reducing fish-model triangle count if any is over 300 (rare but check).
- Single material per zone where possible — fewer draw calls.
- Disabling shadow generation on props (DCL's setting if available).
- Capping particle systems to a hard ceiling (count + lifetime).

**Don't do.**
- Refactoring system architecture for theoretical perf wins. This is a hackathon, not a 1.0.
- Compressing audio further if it'll degrade the §15 polish — it's a small slice of memory.
- Removing features. Cut polish first if needed; don't remove fish, rods, or zones.

## Implementation notes (submission)

**Video.** 90 seconds is plenty. Open with the calm pond shot, walk to Lily Cove, cast. Land a Common, sell. Buy Mystic. Walk to Starwell after it unlocks. Land a Rare. End on the bestiary panel with progress visible. Music is the in-game ambient — don't add commentary.

**Description.** Three components:
1. The hook (one line): "A calm fishing game built natively for Decentraland mobile."
2. The pitch (3 lines): the tap-first vibe, the bestiary loop, the spatial nature of moving between zones.
3. The trust signals: SDK 7, no crypto, all assets license-clean, optimized for mobile.

**Form fields to triple-check.**
- Team name and contributors
- World URL
- Source repository link
- License attestation
- Any judging-criterion-aligned fields ("Innovation", "Optimization") — paste the GDD §9.4 mappings.

## Risks for this step

| Risk                                                       | Mitigation                                                                                                  |
|------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Performance below 30 FPS even after obvious optimizations  | Cut visible particle ambient, drop second pass on water, reduce one zone's prop density. Cuts before redesign. |
| World deploys but breaks on mobile                         | Test deploy URL on the actual mid-tier Android device. Don't trust desktop-only verification.                 |
| Recording reveals a sequence-breaking bug                  | Reproduce, fix, re-record. Pad the schedule for one re-record.                                                |
| MANA / NAME blocker (don't own one yet)                    | Buy NAME on day 14 of the sprint (Week 2 end) — don't wait until submission week.                              |
| Submission deadline timezone confusion                     | Note deadline in UTC and local time; submit 6 hours early.                                                    |
| Last-minute "small change" introduces a regression          | Code freeze 24 h before submit. After freeze: only documentation, video, and submission form changes.        |

## Final gate

The hackathon is done when:
- World link reachable.
- Video recorded and uploaded.
- Submission form acknowledged.
- The team has watched the video together once and agreed it represents the work.

If a stretch goal from GDD §11 made it in, mention it in the submission. If not, don't apologize — the MVP shipped, and that's the win condition.
