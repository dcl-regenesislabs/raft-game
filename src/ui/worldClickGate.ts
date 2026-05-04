// One-frame "click was already handled by an in-world entity interaction"
// flag. Set by the cup-fill, purifier-interact, and grill systems when
// they consume a fire press; read by global click consumers (food-eat
// and similar) so a click meant for a placed construction or for the
// water surface doesn't double as a tool action.
//
// Reset every frame by `worldClickGateResetSystem`. Register that
// system AFTER every reader so the flag survives long enough to gate
// each consumer in the same frame.

let consumed = false

export function consumeWorldClick(): void {
  consumed = true
}

export function isWorldClickConsumed(): boolean {
  return consumed
}

export function worldClickGateResetSystem(_dt: number): void {
  consumed = false
}
