// TODO(sdk): temporary stand-in for `registerMessages` from
// '@dcl/sdk/network'. That export (and the '@dcl/sdk/server' subpath the
// server counterpart needs) only ever existed on the feature-branch build
// we were pinned to (7.23.2-25521226778.commit-1828100) and is absent from
// the controls-customization snapshot (7.24.6-30025802374.commit-9e2e6a7)
// installed for the native TouchScreenControls work. The save/ranking
// feature is already dormant (wiring commented out in src/index.ts); this
// shim only keeps the dormant modules compiling. Swap the import in
// ./messages.ts back to the real API when it returns.
import type { ISchema } from '@dcl/sdk/ecs'

type Payload<S> = S extends ISchema<infer T> ? T : never

export type MessageCtx = { from?: string }

export type MessageRoom<T extends Record<string, ISchema<any>>> = {
  onMessage<K extends keyof T & string>(
    type: K,
    handler: (data: Payload<T[K]>, ctx?: MessageCtx) => void | Promise<void>
  ): void
  send<K extends keyof T & string>(
    type: K,
    data: Payload<T[K]>,
    opts?: { to?: string[] }
  ): void
}

// Handlers are never invoked and sends go nowhere — the transport behind
// the old API does not exist in this SDK build.
export function registerMessagesShim<T extends Record<string, ISchema<any>>>(
  _messages: T
): MessageRoom<T> {
  return {
    onMessage: () => {},
    send: () => {}
  }
}
