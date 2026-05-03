import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getDestroyHoverTarget } from '../../systems/raftBuilder'
import { BANNER_BG, BANNER_FG } from '../theme'

// Top-of-screen warning shown while the destroy tool is hovering a raft.
// Clicking commits the destroy; the banner is the at-rest "DELETE PLATFORM"
// label so the player knows the click won't fire the throw/spear instead.
export function DestroyBanner(): ReactEcs.JSX.Element | null {
  if (getDestroyHoverTarget() === null) return null
  return (
    <UiEntity
      uiTransform={{
        width: 320,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: BANNER_BG }}
    >
      <Label value="DELETE PLATFORM" fontSize={24} color={BANNER_FG} />
    </UiEntity>
  )
}
