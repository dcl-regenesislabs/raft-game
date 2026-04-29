# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — local preview (opens scene in browser)
- `npm run start -- --mobile` — preview accessible on LAN for mobile testing
- `npm run build` — compile TypeScript to `bin/index.js` (also runs automatically before deploy)
- `npm run deploy` — deploy scene to Decentraland
- `npm run upgrade-sdk` / `upgrade-sdk:next` — bump `@dcl/sdk` to latest / next

There is no test runner configured in this project.

## Architecture

This is a Decentraland **SDK7** scene using a data-oriented Entity Component System (ECS). The mental model is fundamentally different from OOP — read `README.md` for the full SDK7 primer before making non-trivial changes.

### Execution model

- `src/index.ts` exports `main()` — the SDK runtime calls this once on scene load.
- `main()` registers systems with `engine.addSystem(fn)` and sets up the UI with `ReactEcsRenderer.setUiRenderer(...)`. Do **not** put per-frame logic at module top level — put it inside a system.
- Systems run every frame and receive `dt` (seconds since last frame). They iterate entities via `engine.getEntitiesWith(ComponentA, ComponentB, ...)` which returns only entities that have **all** specified components.

### Mutability is load-bearing

- `Component.get(entity)` returns a **read-only** view. `Component.getMutable(entity)` returns a writable view that signals a change to the engine.
- Calling `getMutable` when you don't intend to write costs performance — use `get` for reads, `getMutable` only when assigning.
- Never mutate an immutable view; the change won't propagate and types should reject it.

### Components

- **Base components** (`Transform`, `MeshRenderer`, `Material`, `PointerEvents`, `GltfContainer`, etc.) come from `@dcl/sdk/ecs` — see the full list in `README.md`.
- **Custom components** are defined in `src/components.ts` via `engine.defineComponent('unique-id', Schemas.Map({ ... }))`. Field types must use `Schemas.*` (Boolean, String, Float, Int, Vector3, Quaternion, Color3/4, Entity, Array, Map, Optional, Enum) so they serialize correctly across the network.
- The string ID passed to `defineComponent` must be unique across the scene. If using numeric IDs, **1–2000 are reserved** for base components.
- Use empty-schema marker components (e.g. `Cube = engine.defineComponent('cube-id', {})`) purely as tags to group entities for queries.

### Entity factories

Entity creation is centralized in factory functions (e.g. `src/factory.ts`) that bundle `engine.addEntity()` + all the component `.create(entity, ...)` calls together. Follow this pattern when adding new entity kinds rather than scattering component setup across systems.

### UI layer

- UI lives in `src/ui.tsx` and uses **React-ECS** (`@dcl/sdk/react-ecs`) — JSX with `<UiEntity>`, `<Label>`, `<Button>`. It is NOT React DOM; no browser APIs are available.
- The render function is called every frame. Read scene state directly inside it (e.g. `engine.getEntitiesWith(...)`, `Transform.getOrNull(engine.PlayerEntity)`); there is no `useState`/`useEffect` pattern here.
- `engine.PlayerEntity` is the well-known entity for the local player.

### Scene metadata

- `scene.json` declares parcels, spawn points, feature toggles, and the compiled entry path (`bin/index.js`). Update parcels here, not in code.
- `main.crdt` is a binary CRDT snapshot used by the Decentraland Creator Hub / Inspector. It can coexist with hand-written code in `src/` — entities defined there are loaded alongside whatever `main()` creates. Don't hand-edit it.
- `assets/` holds scene resources (3D models, etc.); `images/` holds UI textures referenced by `texture.src`.

## SDK reference

`cursor.config` and `.cursor/rules/rules.md` point at external SDK7 reference material. When unsure about an API, prefer the README's primer and the official docs at https://docs.decentraland.org/creator/ over guessing.
