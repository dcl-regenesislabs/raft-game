import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getDestroyHoverTarget } from '../../systems/raftBuilder'
import { BANNER_BG, BANNER_FG } from '../theme'

// Top-center warning shown while the destroy tool is hovering a raft.
// Clicking commits the destroy; the banner is the at-rest "DELETE PLATFORM"
// label so the player knows the click won't fire the throw/spear instead.
const BANNER_WIDTH = 320
const BANNER_HEIGHT = 56
const BANNER_TOP = 80
export function DestroyBanner(): ReactEcs.JSX.Element | null {
  if (getDestroyHoverTarget() === null) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: BANNER_TOP, left: '50%' },
        margin: { left: -Math.round(BANNER_WIDTH / 2) },
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: BANNER_BG }}
    >
      <Label value="DELETE PLATFORM" fontSize={24} color={BANNER_FG} />
    </UiEntity>
  )
}
