import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

import { getCollectedCount } from '../inventoryState'
import { type ItemDef } from '../items'
import {
  COUNT_BADGE_BG,
  COUNT_BADGE_FG
} from '../theme'

// Reusable per-cell count chip. Renders nothing for items that aren't
// stackable, or for stackable items the player has zero of, so empty
// material slots stay visually clean.
export function ItemCountBadge(props: {
  item: ItemDef | null
  key?: number | string
}): ReactEcs.JSX.Element | null {
  const item = props.item
  if (item === null || !item.stackable) return null
  const count = getCollectedCount(item.id)
  if (count <= 0) return null
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { bottom: '4%', right: '4%' },
        minWidth: 20,
        height: 20,
        padding: { left: 4, right: 4 },
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: COUNT_BADGE_BG }}
    >
      <Label value={`${count}`} fontSize={14} color={COUNT_BADGE_FG} />
    </UiEntity>
  )
}
