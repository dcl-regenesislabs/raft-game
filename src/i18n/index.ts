import { messages } from './catalog'

export type Language = 'en' | 'es' | 'pt'
export type LanguagePreference = 'default' | Language

let detectedLanguage: Language = 'en'
let preference: LanguagePreference = 'default'
let revision = 0
const cache = new Map<string, string>()
const exact = new Map<string, readonly [string, string]>()
const folded = new Map<string, readonly [string, string]>()
const templates: { pattern: RegExp; translations: readonly [string, string]; slots: number[]; weight: number }[] = []

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

for (const [source, es, pt] of messages) {
  if (!/\{\d+\}/.test(source)) {
    exact.set(source, [es, pt])
    folded.set(source.toLowerCase(), [es, pt])
    continue
  }
  const slots: number[] = []
  let offset = 0
  let pattern = '^'
  source.replace(/\{(\d+)\}/g, (placeholder, slot: string, index: number) => {
    pattern += escapeRegex(source.slice(offset, index)) + '([\\s\\S]*?)'
    slots.push(Number(slot))
    offset = index + placeholder.length
    return placeholder
  })
  pattern += escapeRegex(source.slice(offset)) + '$'
  templates.push({ pattern: new RegExp(pattern), translations: [es, pt], slots, weight: source.replace(/\{\d+\}/g, '').length })
}
// Prefer full sentences to broad prompts such as "Collect {0}".
templates.sort((a, b) => b.weight - a.weight)

export function normalizeLanguage(locale: unknown): Language {
  if (typeof locale !== 'string') return 'en'
  const base = locale.trim().toLowerCase().split(/[-_]/)[0]
  return base === 'es' || base === 'pt' ? base : 'en'
}

export function getLanguage(): Language {
  return preference === 'default' ? detectedLanguage : preference
}

export function getLanguagePreference(): LanguagePreference {
  return preference
}

export function getLanguageRevision(): number {
  return revision
}

function languageChanged(before: Language): void {
  if (before === getLanguage()) return
  revision++
  cache.clear()
}

export function setDetectedLocale(locale: unknown): void {
  const before = getLanguage()
  detectedLanguage = normalizeLanguage(locale)
  languageChanged(before)
}

export function setLanguagePreference(value: LanguagePreference): void {
  const before = getLanguage()
  preference = value
  languageChanged(before)
}

function translate(source: string, language: 'es' | 'pt', depth: number): string {
  const column = language === 'es' ? 0 : 1
  const direct = exact.get(source)
  if (direct) return direct[column]
  const insensitive = folded.get(source.toLowerCase())
  if (insensitive) {
    const value = insensitive[column]
    if (source === source.toUpperCase()) return value.toUpperCase()
    if (source === source.toLowerCase()) return value.toLowerCase()
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
  if (depth > 6) return source
  // Authority errors sometimes contain raw item IDs; only normalize those that resolve
  // to a known display name. The original IDs in gameplay and network state stay intact.
  const itemName = source.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  if (itemName !== source && folded.has(itemName.toLowerCase())) return translate(itemName, language, depth + 1)
  for (const template of templates) {
    const match = template.pattern.exec(source)
    if (!match) continue
    const values: Record<number, string> = {}
    template.slots.forEach((slot, index) => { values[slot] = translate(match[index + 1], language, depth + 1) })
    return template.translations[column].replace(/\{(\d+)\}/g, (_, slot: string) => values[Number(slot)] ?? '')
  }
  // Composed labels, dialogue lines and resource lists retain their punctuation.
  const parts = source.split(/(\n| · |, | \+ | \/ )/)
  if (parts.length > 1) return parts.map((part, index) => index % 2 ? part : translate(part, language, depth + 1)).join('')
  const counted = /^(\d+\s*(?:x|×)?\s+)(.+)$/.exec(source)
  if (counted) return counted[1] + translate(counted[2], language, depth + 1)
  const trimmed = source.trim()
  if (trimmed !== source) return source.replace(trimmed, translate(trimmed, language, depth + 1))
  // Unknown text (including server diagnostics) stays readable in English.
  return source
}

/** Translate at the display boundary, so cached messages and catalogs switch language live. */
export function t(source: string): string {
  const language = getLanguage()
  if (language === 'en' || !source) return source
  const cached = cache.get(source)
  if (cached !== undefined) return cached
  const result = translate(source, language, 0)
  if (cache.size >= 512) cache.clear()
  cache.set(source, result)
  return result
}
