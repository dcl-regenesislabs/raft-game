// Build-environment flag. `false` in source for every dev build; flipped
// to `true` at deploy time by `scripts/force-production.mjs`, which runs
// from the `deploy:demo` / `deploy:full` npm scripts. CI never edits this
// file by hand — it just runs the deploy script which handles the flip.
//
// Devs should keep this committed as `false` on main. The runtime never
// reads `process.env` (Decentraland scenes have no Node env) so this
// constant is the single source of truth for "am I a production build?".
//
// Typed as plain `boolean` rather than the `false` literal so downstream
// flags like DEBUG_MODE don't narrow to a literal type and trigger
// "always true / dead branch" warnings.
export const IS_PRODUCTION: boolean = true
