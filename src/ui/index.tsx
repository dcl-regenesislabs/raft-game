import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

import { getDestroyHoverTarget } from '../systems/raftBuilder'

const BANNER_BG = Color4.create(0.85, 0.18, 0.18, 0.85)
const BANNER_FG = Color4.White()

// React-ECS render runs every frame; reading scene state directly here is the
// idiomatic pattern (no useState/useEffect). The banner only mounts when the
// player is hovering a destroyable raft in DESTROYING mode.
export function setupUi(): void {
  ReactEcsRenderer.setUiRenderer(ui)
}

function ui(): ReactEcs.JSX.Element {
  const showDestroy = getDestroyHoverTarget() !== null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: { top: 80 }
      }}
    >
      {showDestroy && (
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
      )}
    </UiEntity>
  )
}
