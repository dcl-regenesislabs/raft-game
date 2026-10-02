import { engine, executeTask, PointerEvents, TextShape } from '@dcl/sdk/ecs'
import { getExplorerInformation } from '~system/Runtime'
import { getLanguageRevision, setDetectedLocale, t } from './index'

const POLL_INTERVAL_S = 2
let elapsed = POLL_INTERVAL_S
let pending = false
let initialized = false

type DisplayState = { source: string; rendered: string; revision: number }
const worldText = new Map<number, DisplayState>()
const hoverText = new Map<string, DisplayState>()

function localize(value: string, previous: DisplayState | undefined): DisplayState {
  const source = previous && value === previous.rendered ? previous.source : value
  const revision = getLanguageRevision()
  if (previous && previous.source === source && previous.revision === revision) return previous
  return { source, rendered: t(source), revision }
}

/** Local presentation components only: never rewrite shared game data or player names. */
export function localizeWorldText(): void {
  const seenText = new Set<number>()
  for (const [entity, shape] of engine.getEntitiesWith(TextShape)) {
    seenText.add(entity)
    const state = localize(shape.text, worldText.get(entity))
    worldText.set(entity, state)
    if (shape.text !== state.rendered) TextShape.getMutable(entity).text = state.rendered
  }
  for (const entity of worldText.keys()) if (!seenText.has(entity)) worldText.delete(entity)

  const seenHover = new Set<string>()
  for (const [entity, pointers] of engine.getEntitiesWith(PointerEvents)) {
    pointers.pointerEvents.forEach((pointer, index) => {
      if (!pointer.eventInfo?.hoverText) return
      const key = `${entity}:${index}`
      seenHover.add(key)
      const state = localize(pointer.eventInfo.hoverText, hoverText.get(key))
      hoverText.set(key, state)
      if (pointer.eventInfo.hoverText !== state.rendered) {
        const info = PointerEvents.getMutable(entity).pointerEvents[index].eventInfo
        if (info) info.hoverText = state.rendered
      }
    })
  }
  for (const key of hoverText.keys()) if (!seenHover.has(key)) hoverText.delete(key)
}

export function languageSystem(dt: number): void {
  elapsed += dt
  if (!pending && elapsed >= POLL_INTERVAL_S) {
    elapsed = 0
    pending = true
    executeTask(async () => {
      try {
        const info = await getExplorerInformation({})
        // The current protocol exposes locale through configurations. Newer explorers also
        // provide a top-level field. Never infer language from wallet/profile/OS location.
        const response = info as typeof info & { locale?: string }
        setDetectedLocale(response.configurations?.locale || response.locale)
      } catch {
        // Older explorers may not implement this API. Keep the last successful locale.
      } finally {
        pending = false
      }
    })
  }
  localizeWorldText()
}

export function initLanguage(): void {
  if (initialized) return
  initialized = true
  // Run after gameplay writers, before rendering. SDK observables in this pinned version
  // discard localeChanged; polling avoids competing with the SDK's legacy event queue.
  engine.addSystem(languageSystem, -1000)
  languageSystem(0)
}
