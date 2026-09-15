// Wire-format messages exchanged between the client UI and the
// authoritative server. The server uses Storage.player to persist a
// single JSON-encoded SaveBlob per player; everything
// else (assembling/validating the blob) lives on the client side.
//
// The whole save payload travels as a single string field so the schema
// stays trivially compatible with future SaveBlob shape changes — the
// SaveBlob `version` field gates migrations on the client.

import { Schemas } from '@dcl/sdk/ecs'
import { registerMessagesShim } from './messagesShim'

export const SAVE_MESSAGES = {
  save: Schemas.Map({
    payload: Schemas.String
  }),
  load: Schemas.Map({}),
  loadResult: Schemas.Map({
    payload: Schemas.String,
    found: Schemas.Boolean
  }),
  wipe: Schemas.Map({}),
  ack: Schemas.Map({
    op: Schemas.String,
    ok: Schemas.Boolean,
    error: Schemas.String
  }),
  submitScore: Schemas.Map({
    timeS: Schemas.Number,
    debug: Schemas.Boolean
  }),
  submitScoreAck: Schemas.Map({
    ok: Schemas.Boolean,
    error: Schemas.String
  }),
  requestRankings: Schemas.Map({}),
  rankingsResult: Schemas.Map({
    entries: Schemas.String
  })
}

export type SaveMessages = typeof SAVE_MESSAGES

// Shimmed no-op room while the messaging API is absent from the current
// SDK snapshot — see ./messagesShim.ts.
export const saveRoom = registerMessagesShim(SAVE_MESSAGES)
