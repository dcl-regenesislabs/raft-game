import {
  Entity,
  InputAction,
  PointerEventType,
  TextShape,
  VisibilityComponent,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { LobbyChef } from '../components'

// Per-frame interact handler for the lobby chef. The Animator on the
// chef entity holds a single state — the idle loop — so animations
// never change at runtime; this system only drives the dialog bubble
// parented above the chef's head. The bubble opens on the welcome
// question (line 0) and advances ONLY on click — there's no auto-cycle.
// After the final story line, the next click wraps back to the welcome.

export const CHEF_IDLE_CLIP = 'Idle_8'

export const CHEF_HOVER_LABEL = 'Talk to the chef'

// Story the lobby chef tells through the dialog bubble parented above
// his head. Index 0 is the always-on welcome question that invites the
// player to click; subsequent entries are the story he tells, advancing
// one line per click. English with sprinkled Italian so it reads as a
// stereotyped Italian chef — funny without leaning on a real accent.
// Newlines are intentional: TextShape doesn't auto-wrap nicely inside
// the bubble texture, so each entry is hand-broken to land roughly
// inside the parchment area.
// All entries are exactly DIALOG_LINES_PER_ENTRY lines long with no
// blank rows, and each line is hand-broken to stay under
// DIALOG_MAX_LINE_CHARS — keeps the parchment area visually balanced
// across every click of the chef. Run the unit-style assert below at
// module load to catch regressions when editing the script.
const DIALOG_LINES_PER_ENTRY = 4
const DIALOG_MAX_LINE_CHARS = 32
export const CHEF_DIALOG_LINES: ReadonlyArray<string> = [
  [
    'IMAGINE YOU WAKE UP ALONE...',
    'adrift in the open sea,',
    'on just a tiny wooden raft.',
    'What would you do? Click me.'
  ].join('\n'),
  [
    'Picture it — no land in sight,',
    'only waves and the salty wind.',
    'Hours pass. You start to wonder:',
    'how on earth do I survive this?'
  ].join('\n'),
  [
    'If this happened, my friend,',
    'I would teach you everything —',
    'where to look, what to gather,',
    'how to live another day.'
  ].join('\n'),
  [
    'To earn rescue, you would cook',
    "a true master's plate at sea:",
    'spaghetti, clams, garlic, oil —',
    'fettuccine, shark, squid, crab.'
  ].join('\n'),
  [
    'A good chef can cook a feast',
    'anywhere the sea takes him.',
    'All you would need is patience',
    'and the right ingredients.'
  ].join('\n'),
  [
    'So, my friend — if this ever',
    'happens to you out there...',
    'cook me the perfect plate',
    'and I will sail to find you.'
  ].join('\n')
]

for (const entry of CHEF_DIALOG_LINES) {
  const rows = entry.split('\n')
  if (rows.length !== DIALOG_LINES_PER_ENTRY) {
    throw new Error(
      `chef dialog entry must be ${DIALOG_LINES_PER_ENTRY} lines, got ${rows.length}: ${entry}`
    )
  }
  for (const row of rows) {
    if (row.length === 0) {
      throw new Error(`chef dialog row is empty: ${entry}`)
    }
    if (row.length > DIALOG_MAX_LINE_CHARS) {
      throw new Error(
        `chef dialog row exceeds ${DIALOG_MAX_LINE_CHARS} chars (${row.length}): ${row}`
      )
    }
  }
}

export function getChefFirstDialogLine(): string {
  return CHEF_DIALOG_LINES[0]
}

// Total click states the bubble cycles through: every story line plus
// one extra "hidden" slot at the end. After the final story line, the
// next click hides both the bubble and its text; the click after that
// wraps back to the welcome question (index 0) and shows them again.
const DIALOG_STATE_COUNT = CHEF_DIALOG_LINES.length + 1

export function lobbyChefAnimSystem(_dt: number): void {
  for (const [entity, chef] of engine.getEntitiesWith(LobbyChef)) {
    const clicked = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      chef.clickEntity
    )
    if (!clicked) continue
    advanceDialog(
      entity,
      chef.dialogBubbleEntity,
      chef.dialogTextEntity,
      chef.dialogLineIndex
    )
  }
}

function advanceDialog(
  entity: Entity,
  bubbleEntity: Entity,
  textEntity: Entity,
  currentIndex: number
): void {
  const nextIndex = (currentIndex + 1) % DIALOG_STATE_COUNT
  const showing = nextIndex < CHEF_DIALOG_LINES.length
  setBubbleVisible(bubbleEntity, showing)
  setBubbleVisible(textEntity, showing)
  if (showing) {
    const text = TextShape.getMutableOrNull(textEntity)
    if (text !== null) {
      text.text = CHEF_DIALOG_LINES[nextIndex]
    }
  }
  LobbyChef.getMutable(entity).dialogLineIndex = nextIndex
}

// VisibilityComponent toggle that creates the component on first use
// (the bubble factory ships without it because the bubble starts
// visible) and otherwise just flips the flag. DCL doesn't cascade
// visibility from parent to child, so the bubble plane and its
// TextShape child each need their own component.
function setBubbleVisible(entity: Entity, visible: boolean): void {
  const cur = VisibilityComponent.getMutableOrNull(entity)
  if (cur === null) {
    VisibilityComponent.create(entity, { visible })
    return
  }
  if (cur.visible === visible) return
  cur.visible = visible
}
