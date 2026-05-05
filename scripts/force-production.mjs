#!/usr/bin/env node
// Forces `IS_PRODUCTION = true` in src/config/env.ts.
//
// Wired into the `deploy:demo` / `deploy:full` npm scripts so any deploy
// (CI or manual) ships with debug aids disabled, regardless of what the
// committed source has. Devs can keep `IS_PRODUCTION = false` locally for
// `npm run start` without it ever leaking into a deployed world.
//
// Mirrors the build-scene-json pattern: deploy-time mutations of tracked
// files happen here, not inside the runtime code.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TARGET = resolve(HERE, '..', 'src', 'config', 'env.ts')

const PATTERN = /export const IS_PRODUCTION: boolean = (?:true|false)/

function main() {
  const src = readFileSync(TARGET, 'utf8')
  if (!PATTERN.test(src)) {
    throw new Error(
      `[force-production] could not find "export const IS_PRODUCTION: boolean = true|false" in ${TARGET}. ` +
        `Update this script if the constant moved or was renamed.`
    )
  }
  const next = src.replace(PATTERN, 'export const IS_PRODUCTION: boolean = true')
  if (next === src) {
    // eslint-disable-next-line no-console
    console.log('[force-production] already true — no change')
    return
  }
  writeFileSync(TARGET, next, 'utf8')
  // eslint-disable-next-line no-console
  console.log('[force-production] IS_PRODUCTION forced to true for deploy')
}

main()
