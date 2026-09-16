import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { isMobile } from '@dcl/sdk/platform'
import { beginUiTouch } from '../mobileControlsState'
import { UI_CELL, UI_INK, UI_MUTED } from '../visualTheme'

const pages = new Map<string, number>()
export function resetMenuPage(id: string): void {
  pages.delete(id)
}

export function getMenuPage(
  itemCount: number,
  height: number,
  rowHeight: number,
  requestedPage: number,
  footerHeight = 56
) {
  const paginated = itemCount * rowHeight > height
  const pageSize = Math.max(1, Math.floor((height - (paginated ? footerHeight : 0)) / rowHeight))
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize))
  const page = Math.min(Math.max(0, requestedPage), pageCount - 1)
  return { page, pageSize, pageCount }
}

export function revealMenuItem(id: string, index: number, count: number, height: number, rowHeight: number, compact = false): void {
  const { pageSize } = getMenuPage(count, height, rowHeight, 0, compact ? 112 : 56)
  pages.set(id, Math.floor(Math.max(0, index) / pageSize))
}

// Touch drag scrolling conflicts with Explorer camera input. Use explicit pages
// on mobile; desktop retains wheel scrolling and never changes row sizes.
export function MenuList(props: {
  id: string
  height: number
  rowHeight: number
  compact?: boolean
  children?: (ReactEcs.JSX.Element | null)[]
}): ReactEcs.JSX.Element {
  const items = (props.children ?? []).filter(Boolean)
  const mobile = isMobile()
  const { page, pageSize, pageCount } = getMenuPage(
    items.length,
    props.height,
    props.rowHeight,
    pages.get(props.id) ?? 0,
    props.compact ? 112 : 56
  )
  const shown = mobile ? items.slice(page * pageSize, (page + 1) * pageSize) : items
  return (
    <UiEntity uiTransform={{ width: '100%', height: props.height, flexShrink: 0, flexDirection: 'column' }}>
      <UiEntity
        uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column', overflow: mobile ? 'hidden' : 'scroll' }}
      >
        {shown}
      </UiEntity>
      {mobile && pageCount > 1 && (
        <UiEntity
          uiTransform={{
            width: '100%',
            height: props.compact ? 104 : 48,
            flexShrink: 0,
            margin: { top: 8 },
            flexDirection: props.compact ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <PageButton label="‹" enabled={page > 0} onPress={() => pages.set(props.id, page - 1)} />
          {!props.compact && (
            <Label
              value={`${page + 1} / ${pageCount}`}
              fontSize={14}
              color={UI_MUTED}
              uiTransform={{ flexGrow: 1, height: 48 }}
            />
          )}
          <PageButton label="›" enabled={page < pageCount - 1} onPress={() => pages.set(props.id, page + 1)} />
        </UiEntity>
      )}
    </UiEntity>
  )
}
function PageButton(props: { label: string; enabled: boolean; onPress: () => void }): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{ width: 56, height: 48, borderRadius: 8, opacity: props.enabled ? 1 : 0.4 }}
      uiBackground={{ color: UI_CELL }}
      onMouseDown={beginUiTouch}
      onMouseUp={() => {
        beginUiTouch()
        if (props.enabled) props.onPress()
      }}
    >
      <Label value={props.label} fontSize={28} color={UI_INK} uiTransform={{ width: '100%', height: '100%' }} />
    </UiEntity>
  )
}
