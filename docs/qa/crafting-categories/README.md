# Crafting categories verification

Motorola Edge 60 Pro, installed Explorer 1.14.0.1925, local preview with DEBUG_MODE enabled.

Final layout: always-visible icon category rail → recipe list → item details.
- Seven active category icons fit together in the safe area.
- One tap on Tools displayed hook, hammer and fishing rod.
- One tap on Navigation displayed anchor and its material requirements.
- Can craft filter removed. Recipes remain visible when materials are missing.
- Craft action is fixed at the bottom-right of the details panel, outside its scroll area.
- Full inventory blocks crafting before materials are debited; a slot freed by consuming ingredients can receive the result.
- Crafted one hook in the preceding category pass: wood 103 → 102, rope 99 → 98, +1 hook notification.
- Outside hold/release closed Craft with the hook idle.
- Ten original SVG/transparent PNG pictograms include future categories, which remain hidden until recipes exist.
- Short category rails use vertically stacked 56×48 pagination controls.
- Build/TypeScript pass; 16 UI tests and 20 mobile-control tests pass.
- Icon dimensions/alpha, category coverage, selection reconciliation, and compact paging are tested.
- Desktop uses the same three-column component; no fresh desktop visual run.

The new categories organize existing recipes. Raids, towers, shared construction and the radio finale are still roadmap work.

Broader gameplay suite: 26 pass, two pre-existing failures remain (bonus hunger drain and purifier fuel under a long frame).
