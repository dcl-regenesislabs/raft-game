// Wire-format messages exchanged between the client UI and the
// authoritative server. The server uses Storage.player to persist a
// single JSON-encoded SaveBlob per player; everything
// else (assembling/validating the blob) lives on the client side.
//
// The whole save payload travels as a single string field so the schema
// stays trivially compatible with future SaveBlob shape changes — the
// SaveBlob `version` field gates migrations on the client.

import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const SAVE_MESSAGES = {
  serverHeartbeat: Schemas.Map({}),
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

// Registered during module loading, before the ECS engine seals.
export const saveRoom = registerMessages(SAVE_MESSAGES)

// The authority is the only accepted sender of heartbeat, chunks and results.
export const worldRoom = registerMessages({
  worldHello: Schemas.Map({ protocol: Schemas.Int, session: Schemas.String, resync: Schemas.Boolean }),
  worldJoinRejected: Schemas.Map({ session: Schemas.String, error: Schemas.String }),
  worldCommand: Schemas.Map({ payload: Schemas.String }),
  worldPulse: Schemas.Map({ server: Schemas.String, status: Schemas.String }),
  worldChunk: Schemas.Map({ id: Schemas.String, index: Schemas.Int, total: Schemas.Int, hash: Schemas.String, body: Schemas.String }),
  worldResult: Schemas.Map({ payload: Schemas.String })
})
