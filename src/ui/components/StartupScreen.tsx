import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

import { getStartupGateOpacity } from '../startupGate'

// 2D startup overlay — used to host a logo + three buttons, but the
// player-facing entry point is now a 3D lobby (factories/lobby.ts).
// All this layer renders is a black rectangle that fades IN to opaque
// while the gate's exit timer counts down — so the moment the player
// walks into a portal ring, the screen ramps to black, the lobby
// despawns and the actual game world is built underneath, and the
// overlay unmounts the next frame (when isStartupGateActive flips
// false in src/ui/index.tsx).

export function StartupScreen(): ReactEcs.JSX.Element {
  // getStartupGateOpacity returns 1 while idle and ramps to 0 during
  // the exit fade. Inverting it gives an alpha that's transparent while
  // the lobby is interactive and fades to opaque black for the
  // teardown / game-build moment — masks any single-frame pop-in.
  const fadeAlpha = 1 - getStartupGateOpacity()
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, fadeAlpha) }}
    />
  )
}
