# Repository Guidelines

## Project Context

This is a TypeScript Decentraland SDK7 survival game deployed to `raft.dcl.eth`. Players collect salvage, fish, manage hunger/thirst, craft equipment, expand a raft, and progress through production and defense encounters. Desktop and mobile controls are both part of the supported experience.

The runtime uses a data-oriented Entity Component System (ECS) and React-ECS UI. It is not a browser application: do not assume DOM APIs, React DOM hooks, or Node.js APIs are available in scene code. Node tooling belongs in `scripts/`.

## Project Structure & Ownership

- `src/index.ts`: scene entry point, initialization, and ordered system registration.
- `src/components.ts`: shared ECS component schemas and entity state.
- `src/factories/`: entity creation, visuals, colliders, and destruction helpers.
- `src/systems/`: per-frame gameplay, interactions, movement, and survival.
- `src/runtime/`: scene transitions and debug setup; `src/progression/`: campaign state, milestones, and checkpoints.
- `src/expansion/`: item catalog, production/combat rules, models, and expansion runtime.
- `src/ui/`: inventory, menus, input/session state, and layout; `components/` contains JSX views.
- `src/config/`: gameplay tuning and environment flags; `src/shared/`: save schemas and message definitions.
- `src/client/`, `src/server/`: persistence/ranking integration. Server startup is currently disabled in `src/index.ts`, and `src/server/` is excluded from TypeScript checking; do not assume authoritative multiplayer is active.
- `assets/`, `images/`: models/audio and UI textures. `scripts/`: tooling and regressions. `docs/`: design notes and QA evidence. `bin/`: generated output.

## Build & Development Commands

Use Node.js 20 to match CI. Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm start` | Start the SDK development preview. |
| `npm run build` | Build the scene; CI runs this on pushes and PRs. |
| `node scripts/test-gameplay.cjs` | Run gameplay regression checks. |
| `npm run check:textures` | Validate glTF textures. |
| `npm run fix:textures` | Apply texture fixes; inspect resulting asset changes. |
| `npm run prepare:scene` | Rewrite deployment metadata in `scene.json`. |

Run all regression scripts with:

```sh
for test in scripts/test-*.cjs; do node "$test" || exit 1; done
```

There is no `npm test` or lint script. Do not upgrade the SDK as part of unrelated work.

## Coding Style & Naming

Use strict TypeScript, two-space indentation, single quotes, no semicolons, and no trailing commas. `package.json` configures Prettier with a 120-character print width, but no formatter command is wired in. Keep formatting changes local; some existing files use compact legacy formatting.

Use camelCase for functions, variables, and ordinary modules; PascalCase for types, ECS components, and JSX components (`InventoryPanel.tsx`); UPPER_SNAKE_CASE for constants. Follow established names such as `createPlatform`, `survivalDrainSystem`, and `serializeProgress`/`hydrateProgress`. Give exported gameplay functions explicit parameter and return types. Prefer narrow unions and typed records over introducing `any`.

Keep designer-facing tuning in `src/config/gameConfig.ts`; retain feature-specific catalog and progression data in their existing modules. Include units in numeric names where useful (`_S`, `_PCT`, `yawDeg`). Comments should explain units, invariants, lifecycle, or engine constraints rather than restating assignments.

## ECS & Gameplay Rules

- Register frame updates through `engine.addSystem`; use `dt` in seconds for elapsed-time behavior.
- Read components with `get`/`getOrNull`; use `getMutable` only for writes. Define custom components with unique IDs and SDK `Schemas` fields.
- Centralize entity setup in factories. Clean up visual children, auxiliary entities, and tracking maps through the corresponding destruction helpers.
- Preserve system ordering: input-consumption reset systems must run after their readers. A UI tap or consumed world interaction must not also fire a tool.
- Respect lobby/startup, death, and victory gates when adding gameplay timers or actions. Follow `survivalDrainSystem` for examples.
- Use grid helpers and shared dimensions from `factories/platform.ts` and `sceneLevels.ts`. Keep placement/collider geometry consistent with previews; rotating a visual child must not silently change grid occupancy.
- Prefer testable rules separate from entity/rendering work, following `expansion/rules.ts`.

## UI, Saves & Assets

Use existing React-ECS components, theme tokens, and `getMobileLayout()` for safe-area-aware layouts. Keep render functions focused on reading state; route actions through existing session/input helpers. Verify pointer locking, menu transitions, and touch consumption when changing controls.

When changing inventory, progression, or construction state, review serialization and hydration in `src/shared/saveSchema.ts`. Supply defaults for optional fields; handle incompatible versions explicitly. Check save/load and checkpoint restoration, including full inventories and malformed data.

Use existing asset catalogs and preload paths. Run texture validation when changing models. Do not hand-edit `main.crdt` or generated `bin/` files.

## Testing & Review

Regression scripts use Node assertions, esbuild/TypeScript, and SDK mocks; no coverage threshold is configured. Name new scripts `test-<feature>.cjs` and add behavior-focused cases to the closest suite. Relevant suites cover gameplay, expansion, progression, scene configuration, UI, and mobile/touch controls.

Run affected suites and `npm run build` before submitting. Mock-based checks do not establish in-world correctness: verify visual/input changes in Explorer on desktop and mobile, with screenshots or notes under `docs/qa/`. Report checks actually run and any remaining limitations.

## Commits, Deployment & Agent Workflow

History uses imperative summaries and `fix:`/`feat:` prefixes. Keep commits focused. PRs should describe the player-visible change, link relevant issues, list validation, and include visual evidence for UI or asset changes.

Pushes to `main` deploy automatically. `npm run deploy` updates `scene.json`, forces production mode, and publishes to `raft.dcl.eth`. Preserve `--multi-scene` to retain other hosted scenes. Keep `IS_PRODUCTION = false` committed in `src/config/env.ts`; deployment credentials belong in the `DCL_PRIVATE_KEY` CI secret.

Inspect the working tree before editing and preserve unrelated work. Consult relevant `.agents/skills/` guidance for SDK-specific tasks. Keep project-specific skill changes in `.agents/skills/local/`; upstream-vendored skills may be overwritten during refresh. Treat source, scripts, and workflows as authoritative when older README or project notes disagree.
