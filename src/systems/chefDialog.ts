import {
  Entity,
  InputAction,
  PointerEventType,
  TextShape,
  VisibilityComponent,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'

import { ChefNpc } from '../components'

// Per-frame interact handler for every chef NPC (lobby greeter,
// in-game boat passenger, future variants). The Animator on the chef
// holds a single state — the idle loop — so animations never change at
// runtime; this system only drives the dialog bubble parented above
// the chef's head. The bubble opens on the welcome line (index 0) and
// advances ONLY on click. After the final line, the next click hides
// the bubble; the click after that wraps back to index 0.
//
// The dialog script is per-instance (stored on `ChefNpc.dialogLines`),
// so each chef carries its own conversation without the system having
// to know about the scene context.

const DIALOG_MAX_LINES_PER_ENTRY = 5
const DIALOG_MAX_LINE_CHARS = 32

// Lobby-greeter script. Index 0 is the always-on welcome question that
// invites the player to click; subsequent entries advance one per
// click. English with sprinkled Italian for character. Newlines are
// intentional — TextShape doesn't auto-wrap nicely inside the bubble
// texture, so each entry is hand-broken to land inside the parchment
// area. The asserts below catch regressions when the script is edited.
export const LOBBY_CHEF_DIALOG_LINES: ReadonlyArray<string> = [
  [
    'IMAGINE WAKING UP ALONE...',
    'adrift somewhere off Sicily,',
    'on just a tiny wooden raft.',
    'What would you do?',
    'CLICK ME TO KNOW MORE...'
  ].join('\n'),
  [
    'Picture it: only sea and sky.',
    'Hunger. Thirst. Sharks circle',
    'in the deep. And yet I ask:',
    'is your kitchen ready, friend?'
  ].join('\n'),
  [
    'Your hook pulls floating loot.',
    'Wood, scraps, barrels — yours.',
    'A fishing rod catches the fish.',
    'Both are your lifelines, friend.'
  ].join('\n'),
  [
    'The sea is salt. Never sip.',
    'A purifier makes it safe.',
    'Hammer planks. Grow the raft.',
    'Survival is craft, my friend.'
  ].join('\n'),
  [
    'Then comes the real test:',
    'cook a plate worthy of Sicily.',
    'Spaghetti, clams, garlic, oil —',
    'fettuccine, shark, squid, crab.'
  ].join('\n'),
  [
    'Bring the plate to my heart',
    'and I will sail for you.',
    'No storm, no shark will stop',
    'a chef on a mission. Andiamo.'
  ].join('\n')
]

// In-game boat-chef script. Placeholder until the gameplay around the
// boat passenger is designed — keeps the click → bubble loop alive so
// the NPC reads as interactive while the rest is iterated on.
export const BOAT_CHEF_DIALOG_LINES: ReadonlyArray<string> = ['HELLO']

assertDialogShape(LOBBY_CHEF_DIALOG_LINES)
assertDialogShape(BOAT_CHEF_DIALOG_LINES)

function assertDialogShape(lines: ReadonlyArray<string>): void {
  for (const entry of lines) {
    const rows = entry.split('\n')
    if (rows.length > DIALOG_MAX_LINES_PER_ENTRY) {
      throw new Error(
        `chef dialog entry exceeds ${DIALOG_MAX_LINES_PER_ENTRY} lines (${rows.length}): ${entry}`
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
}

export function chefDialogSystem(_dt: number): void {
  for (const [entity, chef] of engine.getEntitiesWith(ChefNpc)) {
    const clicked = inputSystem.isTriggered(
      InputAction.IA_POINTER,
      PointerEventType.PET_DOWN,
      chef.clickEntity
    )
    if (!clicked) continue
    advanceDialog(entity)
  }
}

function advanceDialog(entity: Entity): void {
  const chef = ChefNpc.get(entity)
  const lines = chef.dialogLines
  if (lines.length === 0) return
  // (lines.length + 1) states cycled per click: indices 0..N-1 show the
  // matching line, the trailing state hides the bubble entirely. The
  // next click after the hidden state wraps back to index 0.
  const stateCount = lines.length + 1
  const nextIndex = (chef.dialogLineIndex + 1) % stateCount
  const showing = nextIndex < lines.length
  setBubbleVisible(chef.dialogBubbleEntity, showing)
  setBubbleVisible(chef.dialogTextEntity, showing)
  if (showing) {
    const text = TextShape.getMutableOrNull(chef.dialogTextEntity)
    if (text !== null) {
      text.text = lines[nextIndex]
    }
  }
  ChefNpc.getMutable(entity).dialogLineIndex = nextIndex
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
