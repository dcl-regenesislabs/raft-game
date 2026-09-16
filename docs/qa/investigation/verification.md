# Investigation, guided crafting and equipment transitions

## Behavior

- No All recipes category. The left rail selects concrete crafting categories, with a separate Investigation journal.
- Investigation lists five objective-driven discovery groups: Survival, A floating home, Metalworking, Engineering, Rescue technology. Goals unlock recipes automatically; crafting still requires the correct nearby workstation.
- Early guided runs keep replacement hooks and rope available. Rope unlocks the hammer, expansion unlocks purifier/cup, and drinking fresh water unlocks grill/fishing rod. Completing the survival milestones opens the workbench tier. Later discoveries follow the existing story milestones.
- Opening crafting selects the current guide recipe/category when that recipe belongs to this station. A 1.4-second pulse settles into persistent yellow diamonds on category and recipe, plus a next-objective label in details. Mobile pages reveal the target; manual category selection remains available.
- Skipping the guide unlocks every normal recipe immediately. `TUTORIAL_ENABLED = false` starts new runs the same way. The saved progression event preserves this decision; reopening help never relocks recipes. Station ownership and the earned rescue core remain unchanged.
- Bandage and repair-kit recipes and debug chest supplies are retired. Legacy item definitions remain readable for older inventories.
- Successfully crafted equippable outputs immediately use the existing equipment switch path, including cancellation of pending casts and placement previews. Materials and ammunition preserve equipment. The crafting panel stays open.
- Every equipment switch, automatic fallback and successful placement starts a 0.4-second action cooldown and requires POINTER release. It does not hide native controls or freeze movement. This blocks the placement press before the hook system runs later in the same frame.

## Automated verification

118 checks passed: gameplay 32, mobile controls 22, UI 20, progression 14, expansion 29, scene metadata 1. TypeScript and SDK build passed.

New regressions cover tutorial visibility and target markers, category fallback, Investigation navigation, skip/load/reopen, starting without tutorial, pulse settling, immediate equipment selection, materials/ammo preserving selection, and consuming the last purifier without forwarding its press to the hook. Input tests cover both desktop and mobile, long holds, releases during cooldown, and same-frame suppression.

Recipe dependency report regenerated without retired consumables.

## Motorola observations

Device `0089321234`, Motorola Edge 60 Pro, installed Explorer `1.14.0.1974-7368e6e-staging`. Used local preview and ADB, with no Explorer source changes.

- Verified the concrete-category rail, three-column crafting panel, close button and fixed craft footer.
- Verified Investigation objective selection and paged recipe previews.
- Started the Tutorial Craft Test fixture. Opened Resources on the marked rope, crafted it, then selected Tools and observed the newly revealed hammer with its persistent yellow marker.
- Saved screenshots: `categories-motorola.png`, `journal-motorola.png`, `rope-marker-motorola.png`, `hammer-unlock-motorola.png`.
- Stopped automated phone input after the user confirmed they were testing on the device. Final auto-equip/cooldown changes have automated regression coverage; do not treat those changes as a completed hands-on phone retest. Earlier screenshots show the first category-art revision, not the final simplification.

## Repeating the targeted phone test

System menu → Debug tools → Tutorial Craft Test provides supplies while keeping progression gates. Craft rope, then hammer; verify hammer equips. Expand, craft and place the final purifier while holding its action, release, then explicitly press again: no hook cast should begin until a new press after the cooldown. Open the survival guide and skip it; verify all normal recipes appear at their respective workplaces and reopening help leaves them unlocked.
