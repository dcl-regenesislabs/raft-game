// Wire-format messages exchanged between the client UI and the
// authoritative server. The server uses Storage.player to persist a
// single JSON-encoded SaveBlob per player per scene mode; everything
// else (assembling/validating the blob) lives on the client side.
//
// The whole save payload travels as a single string field so the schema
// stays trivially compatible with future SaveBlob shape changes — the
// SaveBlob `version` field gates migrations on the client.

import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const SAVE_MESSAGES = {
  save: Schemas.Map({
    mode: Schemas.String,
    payload: Schemas.String
  }),
  load: Schemas.Map({
    mode: Schemas.String
  }),
  loadResult: Schemas.Map({
    mode: Schemas.String,
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
    mode: Schemas.String,
    timeS: Schemas.Number,
    debug: Schemas.Boolean
  }),
  submitScoreAck: Schemas.Map({
    ok: Schemas.Boolean,
    error: Schemas.String
  }),
  requestRankings: Schemas.Map({
    mode: Schemas.String
  }),
  rankingsResult: Schemas.Map({
    mode: Schemas.String,
    entries: Schemas.String
  })
}

export type SaveMessages = typeof SAVE_MESSAGES

export const saveRoom = registerMessages(SAVE_MESSAGES)
