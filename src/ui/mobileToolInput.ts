import { InputAction } from '@dcl/sdk/ecs'

// Dedicated mobile tool channel: IA_POINTER also fires for unrelated UI taps.
// ACTION_6 is unused on mobile; desktop retains its existing hotbar binding.
export const MOBILE_TOOL_ACTION = InputAction.IA_ACTION_6
