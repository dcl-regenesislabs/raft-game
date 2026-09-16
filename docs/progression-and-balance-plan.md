# Progressive single-player campaign: design and implementation plan

Status: campaign implementation complete; automated and Motorola scenario verification recorded in `qa/progression/verification.md`. Fresh-player pacing validation remains pending. Target approved by the user: a first successful solo run in 45–60 minutes. Timings and balance numbers below are initial tuning targets, not measured playtest results.

## Design promise

Start barely surviving on a raft. Turn it into a reliable home, build a workshop, defend it, develop machinery, and broadcast for rescue. Each milestone introduces a capability, lets the player use it, and then presents a challenge that makes it valuable.

Core loop: collect → build → improve daily life → prepare → defend → recover salvage → unlock the next capability.

Keep single-player first, minimal HUD, station-exclusive recipes, automatic invisible power connections, and simple sprite placeholders. Multiplayer, auth-server synchronization, additional models, physical raft travel and a large new item catalog are outside this phase.

## Current code findings

- `craftSession.ts` checks station, cost and capacity, but has no campaign milestone gate. `craftCategories.ts` filters by station only. A station exposes its whole recipe group at once.
- `tutorialState.ts` stops at collection, expansion, water and cooking. There is no equivalent bridge into workshops, defense or rescue.
- DEBUG_MODE starts enabled with stations and supplies. This is useful for checking features but invalid for measuring progression.
- Full hunger/thirst bars last approximately 18.5/15.2 minutes at the configured constant drain. First shark attacks are scheduled at 7.5 minutes and islands at 10 minutes, independently of preparedness. These calculations describe depletion from full without refills, not measured survival time.
- Each standard raid currently spawns `min(3 + wave, 10)` enemies. Type rotates zombies/pirates/beasts. The first raid therefore has four 70-HP zombies, rather than a small teaching encounter.
- A cleared raid grants four wood and four metal; the third grants a transmitter core. For example, four 70-HP targets take twelve 32-damage bolts if killed entirely by ballista. Those bolts cost twelve wood and twelve metal before construction, repairs or missed opportunities. The reward does not replace the ammunition in that example.
- Generic crafting grants one output. Ammunition recipes are not batches. Smelting plates takes twenty seconds each and multiple branches depend on plates/gears.
- Tower auto-resupply and proximity power already reduce repetitive input. Keep them.
- The radio wins at 120 powered seconds even if attackers remain. Finale raids use the same generic wave rotation. The craftable replacement core is currently a possible route around the intended third-raid milestone.
- Navigation currently changes salvage arrivals and resource preference. Do not promise a moving raft or ocean exploration campaign without implementing it.

## Campaign structure

Times are cumulative targets, not time locks. A skilled player can advance faster. Completion conditions use successful gameplay events and survive item consumption or replacement.

| Chapter | Target time | Player task and new capability | Completion / next unlock |
| --- | --- | --- | --- |
| 1. Stay afloat | 0–8 min | Hook nearby salvage; make a hammer; expand; build cup/purifier and grill; drink fresh water and eat a cooked meal. | Expansion + first drink + first cooked meal unlock the workbench. |
| 2. Make a home | 8–16 min | Place workbench, storage and smelter; produce the first metal plate. Offer food/water upgrades and metal hook as small optional improvements. | First plate unlocks the armory, basic defenses and the first raid objective. |
| 3. Defend the raft | 16–24 min | Prepare with spear/bow, barricades or spikes. Start a small zombie raid with the bell; learn repairs and attack direction. | First victory unlocks engineering, ballista and ammunition storage. |
| 4. Build an advantage | 24–34 min | Use sailing/steering for better salvage; build/load a ballista and experience automatic resupply. Defend against the first pirates. Anchor/islands and engine are optional branches. | Pirate victory unlocks research, advanced defenses and electrical equipment. |
| 5. Prepare the rescue | 34–46 min | Introduce harpoon defense before the first sea-beast raid. Build research, generator, antenna and radio; learn automatic power. | Third distinct story victory guarantees the transmitter core. |
| 6. Send the signal | 46–60 min | Fit the core, stock defenses, fuel power and explicitly start the final defense. | Complete 120 powered seconds and defeat the finite final assault to win. |

The campaign should require a viable defense, not every recipe. Cannon, net launcher, armor, batteries, reinforced foundations, elevated platforms and extra food/navigation upgrades are strategic choices. Their unlocks come before the threats they counter. A spear/basic defensive route must be sufficient for the first raid; ballista is introduced before pirates; harpoon before sea beasts.

Dependency spine:

`survival → workbench → smelter → first plate → armory → zombie victory → engineering + ballista → pirate victory → research + harpoon + power → beast victory → core → final broadcast`

Draw and validate the complete recipe dependency graph before implementing gates. Gate recipes at their actual owner station; do not create an armory/engineering recipe that requires a component only obtainable from a later chapter. Component access must precede the station that needs it.

## Recipe discovery and minimal UI

- Keep basic craft limited to currently understood essentials. Hook replacement, rope and emergency recovery cannot be locked away.
- At a milestone, reveal a small useful group (roughly 3–5 meaningful choices), not the whole remaining catalog. Recipes may have sub-milestones inside a chapter.
- The left category rail shows only categories containing available recipes at that station. Preserve category → item → detail; no extra menu layer.
- Keep the current objective as one compact, collapsible line: “Make your first metal plate.” It expands to one reason and the next action, not a quest dashboard.
- Preview the next capability in the objective (“Metalworking unlocks the armory”), rather than displaying dozens of locked item tiles.
- Show a brief milestone sound/banner and update the objective. Never open a panel automatically or interrupt a tool action.
- Teach placement, loading, targeting and automatic resupply by using them. A new gun should arrive with a small initial ammo opportunity so the player can test it immediately.
- One shared progression resolver must authorize both recipe visibility and actual crafting, including alternate input paths. Tutorial dismissal changes guidance visibility, never unlock state.

## Economy and pacing

### Protect the opening

Use a controlled opening salvage sequence, with its material totals derived from starter recipes plus a modest error margin. Vary positions and presentation while guaranteeing access to essential wood, plants, plastic and metal. Supply enough early edible food to cover learning before the first cooked meal.

Do not let a broken hook, full backpack or lost core permanently strand a run. Ensure reachable basic salvage for tool replacement; critical rewards go to a recoverable claim location if the pack is full. Record core entitlement after the third story victory; replacement is allowed only after that milestone and only when the core is neither installed nor already owned.

### Price outcomes, not isolated recipes

Measure collected resources per minute, including misses, travel, crafting time and inventory friction. Spawn rate alone is not income. Expand every milestone's recipes into raw-material totals, including stations, components, fuel, ammo and a repair allowance.

Initial targets:

- First useful successful action within 30 seconds; first small upgrade within 2–3 minutes.
- A meaningful capability approximately every 6–10 minutes.
- After the workshop, routine eating/drinking preparation should consume less than roughly 20% of active play time.
- Preparation for a normal story raid should generally fit in 3–5 minutes once its station is available.
- Balanced play should progress without waiting for one unlucky resource for several minutes. Use bounded drop streaks and milestone supply crates, with seeds reproducible for testing.

Add `outputCount` to crafting and start testing ammo batches: arrows/bolts ×4; harpoons/cannonballs ×2; nets ×2. Reprice ingredients using actual damage-per-resource and expected encounter demand; these batch sizes are proposals, not approved final costs. Update capacity checks, material subtraction, grants and craft UI together.

Raid rewards should approximately replace an efficiently played encounter's consumables and normal repair bill, then contribute a meaningful part of the next upgrade. Use per-encounter reward budgets, not fixed rewards across every difficulty. Story rewards are one-time; optional repeat raids must not multiply difficulty or bypass milestones merely by being attempted.

Support small processing batches or queues (initially up to five) in the smelter and improved grill. Keep hand crafting instant. Let useful tasks overlap production rather than forcing the player to stand at a station. Do not make every process faster without checking the resulting economy.

## Threat curve and combat feel

Introduce one concept at a time:

- First zombie encounter: initial candidate of two slow boarders from one clearly warned direction, roughly 30 seconds preparation warning, and a 60–90 second combat target.
- Pirates: first encounter from one direction, clearly telegraphed ranged attacks, teaching interception before boarding. Ballista is already accessible.
- Sea beasts: conspicuous approach and vulnerable period, testing harpoon placement and hull protection. Basic spear remains an expensive-in-attention fallback.
- Finale: authored, finite reinforcement groups over the powered broadcast, using previously taught threats. Do not simply increase the generic wave number. Cap concurrent enemies and total attackers; no infinite escalation while power is interrupted.

One threat director coordinates story raids, ambient shark attacks and recovery windows. Defer ambient attacks during an introduction, story assault, critical recovery and finale. Queue eligible events rather than permanently discarding them. Do not scale difficulty directly with raft size or unlocked recipes: building and earning upgrades should make the player feel stronger.

Keep story raids player-started using the bell. Offer an honest preparation summary (ammo, fuel, useful counter), but avoid making optional defenses mandatory checklist items. Target about 60–90 seconds of calm after an encounter. Repeat raids are optional risk/reward, not compulsory farming.

Combat feedback priorities: readable incoming direction, distinct attack warnings, obvious hits, visible low ammo/fuel only when relevant, and a concise outcome/reward. Normal threats should survive enough hits to be readable without feeling sponge-like. Initial goals: basic enemies need roughly 2–4 appropriate hits; an appropriate new tower improves survival or resource efficiency noticeably.

Preserve niches: spear close defense; bow flexible manual range; ballista efficient general interception; nets crowd control; harpoons beasts; cannon expensive high burst against boats. Tune these against enemy armor/health and ammo cost together so cannon does not simply erase the ballista's purpose.

## Failure and recovery

Recommend a forgiving default for a 45–60 minute mobile campaign: a local safe checkpoint at chapter boundaries. “Retry chapter” restores the captured raft, inventory, vitals and progression; restarting the run explicitly starts over. Restore rather than merge state so rewards cannot be duplicated. Clear stale raids and pending actions when restoring.

Within a living run, destruction never relocks earned knowledge. Lost stations can be rebuilt. Power loss pauses transmission without resetting its earned seconds; finishing the broadcast still requires the finite final assault to be cleared. Death during the finale returns to the pre-finale checkpoint, not minute zero.

This checkpoint feature is in-run recovery, not a promise of app-restart/cloud persistence. Extend the existing snapshot schema with versioned progression fields for future integration; auth-server and cross-session synchronization remain out of scope. Preserve DEBUG_MODE across restarts, as already requested.

## Implementation sequence

1. **Baseline and tuning data.** Instrument clean non-debug runs; extract recipe dependency/raw-cost reports; put campaign, economy, waves and rewards in editable configuration. Record elapsed active time separately from menus, production and combat.
2. **First playable progression slice.** Add a typed milestone state, successful-action events and a shared unlock resolver. Connect basic craft/station menus and the compact objective. Implement only chapters 1–3 first; support out-of-order legitimate actions without deadlocking progression.
3. **Economy and first combat.** Implement bounded opening loot, batch ammo, capacity-safe production queues and a teaching raid/reward. Tune until the first 20–25 minutes work without debug supplies.
4. **Full campaign.** Add engineering/research milestones, authored pirate/beast encounters, guaranteed core entitlement and the explicit finale. Unify ambient scheduling with campaign threat/recovery windows.
5. **Recovery and feel.** Add local chapter checkpoints; polish collection, placing, crafting, combat and milestone feedback. Keep minimal HUD and mobile release/input gates.
6. **Balance passes.** Test mobile and desktop fresh runs, adjust one group of variables at a time, then lock a baseline before introducing multiplayer or more items.

Likely modules: new `src/progression/{state,milestones,events}.ts`, campaign/balance configuration; integrate `craftSession`, `craftCategories`, `tutorialState`, `eventScheduler`, expansion catalog/runtime/rules, resource spawner and `raftSnapshot`. Keep rendering and UI consumers of the same state, not owners of separate unlock flags.

Debug needs two explicit modes: sandbox (all existing supplies/features) and progression test (clean start, seeded random sequence, milestone inspector). Add stage-jump fixtures that validate prerequisites instead of silently affecting normal balance. Never measure progression in the sandbox.

## Acceptance and playtesting

Automated: valid dependency graph; no progression bypass at crafting; no deadlocks after consuming objective items; no unlock loss after structure destruction; correct batch counts/full-pack handling; deterministic opening resources; one-time story rewards and core recovery; ambient/raid exclusion; checkpoint restoration without duplication; no victory before both broadcast and finale clearance.

Human tests: initially five fresh players without coaching, prioritizing the Motorola; also one experienced desktop run. Capture event times, deaths, resource starvation, time in menus, idle processing, ammo use, damage, chosen branches and abandon points. Ask what they believe the next objective is and what each new station made possible.

Initial acceptance targets: most first-time players identify the next action without explanation; at least four of five reach safe food/water within ten minutes; successful first runs cluster around 45–60 minutes; ordinary losses permit another attempt without prolonged resource grinding; upgrades reduce an existing burden; at least two viable defense layouts reach the finale. A five-player pilot is directional evidence, not statistical proof. If these targets fail, retune the earliest failing chapter before adding more content.

The first implementation deliverable should be a convincing starter-raft-to-first-raid slice. That is the earliest useful test of whether the game feels progressive rather than simply containing many craftable objects.
