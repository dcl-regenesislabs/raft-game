---
name: hackathon-scene-local-skills
description: Project-local SDK7 skills for the hackathon-scene project. These extend (and never overwrite) the upstream `decentraland-sdk-skills` set vendored alongside this directory. Use when a scene needs godot-explorer-style HUD scaling, safe-area-aware layout, or other patterns that aren't yet covered by the upstream skill set.
---

# Project-Local SDK7 Skills — hackathon-scene

These skills live at `.agents/skills/local/<topic>/SKILL.md` and are **independent of the upstream `decentraland-sdk-skills` package**. Running `npx skills add decentraland/sdk-skills` does NOT touch this directory, so handcrafted skills here are safe to keep.

If a topic eventually lands in the upstream skill set, delete the local copy.

## Index

### `mobile-ui-scaling`

**File:** `mobile-ui-scaling/SKILL.md`

Make scene UI scale and resize the same way godot-explorer's native HUD does — fixed pixel sizes, edge-anchored positions, and safe-area-aware layout via `<SafeAreaContainer>`. Covers the three rules (no virtual canvas, pixel literals, edge anchors), the centering tricks, the anchor-cluster pattern, the per-button-radius radial layout helper, common pitfalls, and the cross-runtime caveat from `decentraland/bevy-explorer#754`. Also documents the godot palette / metrics for visual parity.

Use when the user asks for: "UI that scales like the explorer", "mobile-friendly HUD", "items that stay the same size when I resize", "buttons anchored to corners", or anything involving `interactableArea` / safe-area insets.

## How to add a new local skill

1. Create `.agents/skills/local/<topic>/SKILL.md` with frontmatter (`name`, `description`).
2. Add an index entry above with a one-paragraph "use when" hook.
3. If the skill belongs upstream, also open a PR against `decentraland/docs` under `skills/<topic>/`.
