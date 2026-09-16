import ReactEcs,{ Label,UiEntity } from '@dcl/sdk/react-ecs'
import { beginUiTouch } from '../mobileControlsState'
import { getMobileLayout } from '../mobileLayout'
import { UI_ACCENT,UI_CELL,UI_GLASS,UI_GOLD,UI_INK,UI_MUTED } from '../visualTheme'
import { MenuList } from './MenuList'

import { type CookableItem,getCookableById } from '../cookableItems'
import { canStartCook,startCook } from '../cookSession'
import {
applyRecipeToCells,
getCookFuel,
getCookInput,
getMatchingRecipe,
getPickedIngredient,
pickIngredient,
placeInFuelCell,
placeInInputCell,
removeFromFuelCell,
removeFromInputCell
} from '../cookSlots'
import { closeCookMenu,isCookOpen } from '../cookToggle'
import { getCatalogItem,getInventorySlot,getItemDisplayName } from '../items'
import { getLearnedRecipeIds } from '../learnedRecipes'
import { Panel } from '../panel'
import { createPressPulse } from '../pressPulse'
import { collectStorageItemIds,getCombinedCount } from '../storageSession'
import {
COOK_DETAILS_HEIGHT,
COOK_DETAILS_WIDTH,
COOK_LAYOUT_HEIGHT,
COOK_LAYOUT_WIDTH,
COOK_LIST_GAP,
COOK_LIST_HEIGHT,
COOK_LIST_PADDING_X,
COOK_LIST_WIDTH,
COOK_OUTPUT_ICON_SIZE_PCT,
COOK_RECIPE_ICON_SIZE,
COOK_SHORTAGE_BG,
COOK_SHORTAGE_FG,
CRAFT_BUTTON_FG,
CRAFT_BUTTON_FRAME_H,
CRAFT_BUTTON_FRAME_W,
CRAFT_BUTTON_H,
CRAFT_BUTTON_W,
CRAFT_DIVIDER_COLOR,
CRAFT_HAVE_LOW_COLOR,
CRAFT_HAVE_OK_COLOR,
CRAFT_PANEL_PADDING_BOTTOM,
CRAFT_PANEL_PADDING_TOP,
CRAFT_PANEL_PADDING_X,
CRAFT_ROW_SELECTED_BG,
CRAFT_TEXT_COLOR,
CRAFT_TEXT_DIM_COLOR,
CRAFT_TEXT_LIGHT_COLOR
} from '../theme'
import { CloseButton } from './CloseButton'

// Module-level pulse so the same animation clock survives across the
// React-ECS render rebuilds.
const cookActionPulse = createPressPulse()

// Drop-and-cook flow:
//   1. Player picks an inventory slot whose item is `ingredient: true`
//      (handled by `BottomBar` / `InventoryPanel` while the menu is up).
//   2. Player clicks an empty cook cell — one unit moves from inventory
//      into that cell.
//   3. When the placed cells match a recipe (and the burner has the
//      recipe's fuel), the output cell shows a preview and the COOK
//      button enables.
//
// The recipes list on the right shows every recipe the player has
// LEARNED. It starts seeded with all 1-ingredient plates; new entries
// only unlock when the player free-form-discovers a recipe by guessing
// the right ingredient set (see `learnedRecipes.ts`). Clicking a row
// auto-fills the cook cells with that recipe's ingredients — handy
// shortcut once a recipe is known, but the menu still lets the player
// place ingredients manually for try-and-error discovery.
export function CookMenu(): ReactEcs.JSX.Element | null {
  if (!isCookOpen()) return null
  // Inventory + cook panel ride together as one row, centered on the
  // canvas. The inventory hugs the left side of the cook panel so the
  // player's slot list is always visible right next to the recipe.
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
      }}
    >
      <CookSupplies />
      {/* COOK_PANEL_GAP is applied as a left margin on the cook panel
          wrapper. Negative values pull the cook panel left so its
          painted wood frame overlaps the inventory's right edge — the
          two surfaces read as one cooking station. (A negative WIDTH
          spacer would just be clamped to 0 by the layout engine, so
          margin is the only knob that works here.) */}
      <UiEntity uiTransform={{ margin: { left: 12 } }}>
        <CookPanel />
      </UiEntity>
      {/* Recipes list — same overlap trick as the cook panel so the
          three surfaces (inventory, cook, recipes) read as one wide
          book spread. */}
      <UiEntity uiTransform={{ margin: { left: COOK_LIST_GAP } }}>
        <CookRecipeList />
      </UiEntity>
    </UiEntity>
  )
}

function CookPanel(): ReactEcs.JSX.Element {
  return (
    <Panel
      uiTransform={{
        width: COOK_DETAILS_WIDTH,
        height: Math.min(COOK_DETAILS_HEIGHT, getMobileLayout().height - 32),
        flexDirection: 'column',
        alignItems: 'center',
        padding: {
          top: CRAFT_PANEL_PADDING_TOP,
          bottom: CRAFT_PANEL_PADDING_BOTTOM,
          left: CRAFT_PANEL_PADDING_X,
          right: CRAFT_PANEL_PADDING_X
        }
      }}
    >
      <CookHeader />
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 1,
          margin: { top: 6, bottom: 12 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      <Label
        value="Choose a recipe, or pick ingredients and tap + to experiment."
        fontSize={15}
        color={UI_MUTED}
        textAlign="middle-left"
        uiTransform={{ width: '100%', height: 44 }}
      />
      <UiEntity
        uiTransform={{ width: '100%', flexGrow: 1, flexDirection: 'column', alignItems: 'center', overflow: 'scroll' }}
      >
        <CookRecipeLayout />
        <UiEntity uiTransform={{ height: 12, width: 1 }} />
        <Label
          value={cookHint()}
          fontSize={14}
          color={canStartCook() ? UI_GOLD : UI_MUTED}
          textAlign="middle-left"
          uiTransform={{ width: '100%', height: 48, flexShrink: 0 }}
        />
      </UiEntity>
      <CookActionRow />
    </Panel>
  )
}

function CookHeader(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 44,
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <Label
        value="COOKING"
        fontSize={22}
        color={CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ flexGrow: 1, height: '100%' }}
      />
      <UiEntity
        uiTransform={{
          margin: {
            top: 0,
            right: 0
          }
        }}
      >
        <CloseButton onPress={() => closeCookMenu()} />
      </UiEntity>
    </UiEntity>
  )
}

// The whole recipe shape — 2x2 input grid, arrow, output cell, fuel
// cell with up-arrow + flame — is painted into a single PNG. Item
// icons are positioned absolutely on top at the painted cell centers.
// Cells are interactive: click empty cell to place the picked
// ingredient, click filled cell to send it back to the inventory.
function CookRecipeLayout(): ReactEcs.JSX.Element {
  const recipe = getMatchingRecipe()
  return (
    <UiEntity
      uiTransform={{
        width: COOK_LAYOUT_WIDTH,
        height: COOK_LAYOUT_HEIGHT,
        flexShrink: 0,
        borderRadius: 8
      }}
      uiBackground={{
        color: UI_CELL
      }}
    >
      <Label
        value="INGREDIENTS"
        fontSize={11}
        color={UI_MUTED}
        uiTransform={{ positionType: 'absolute', position: { top: 0, left: 0 }, width: 164, height: 20 }}
      />
      <Label
        value="MEAL"
        fontSize={11}
        color={UI_MUTED}
        uiTransform={{ positionType: 'absolute', position: { top: 0, right: 0 }, width: 90, height: 20 }}
      />
      <Label
        value="WOOD / FUEL"
        fontSize={11}
        color={UI_MUTED}
        uiTransform={{ positionType: 'absolute', position: { top: 164, left: 8 }, width: 140, height: 20 }}
      />
      {(
        [
          [14, 23],
          [40, 23],
          [14, 52],
          [40, 52]
        ] as const
      ).map((center, i) => (
        <CookInputCell key={i} index={i} centerPct={center} recipe={recipe} />
      ))}
      <CookFuelCellOverlay recipe={recipe} />
      <CookOutputCellOverlay previewTexture={recipe?.texture ?? null} />
    </UiEntity>
  )
}

// "have/need" badge for a placed cell when the matched recipe wants
// more of this ingredient than the player currently has. Returns null
// when there's nothing to flag — empty cell, no recipe matched, or
// inventory is already sufficient — so the cell stays clean in the
// common case.
function shortageBadge(itemId: string | null, recipe: CookableItem | null): { text: string } | null {
  if (itemId === null || recipe === null) return null
  const ing = recipe.ingredients.find((i) => i.itemId === itemId)
  const required = ing?.amount ?? (recipe.fuel.itemId === itemId ? recipe.fuel.amount : 0)
  if (required <= 0) return null
  // Aggregated across player + every storage so the shortage indicator
  // matches what the inventory overview shows. The COOK button still
  // gates on player-pocket counts (see `canStartCook`), so it can stay
  // dim even with this badge hidden.
  const have = getCombinedCount(itemId)
  if (have >= required) return null
  return { text: `${have}/${required}` }
}

function CookInputCell(props: {
  index: number
  centerPct: readonly [number, number]
  recipe: CookableItem | null
  key?: number | string
}): ReactEcs.JSX.Element {
  const id = getCookInput(props.index)
  return (
    <CookCellOverlay
      centerPct={props.centerPct}
      sizePct={20}
      texture={idToTexture(id)}
      shortage={shortageBadge(id, props.recipe)}
      onPress={() => {
        if (id !== null) {
          removeFromInputCell(props.index)
          return
        }
        if (getPickedIngredient() !== null) placeInInputCell(props.index)
      }}
    />
  )
}

function CookFuelCellOverlay(props: { recipe: CookableItem | null }): ReactEcs.JSX.Element {
  const id = getCookFuel()
  return (
    <CookCellOverlay
      centerPct={[27, 86]}
      sizePct={20}
      texture={idToTexture(id)}
      shortage={shortageBadge(id, props.recipe)}
      onPress={() => {
        if (id !== null) {
          removeFromFuelCell()
          return
        }
        if (getPickedIngredient() !== null) placeInFuelCell()
      }}
    />
  )
}

// Output cell is non-interactive — it just previews what the placed
// cells WILL produce. Faded when no recipe matches so the player
// understands "this is what you're about to make" vs "this is empty".
function CookOutputCellOverlay(props: { previewTexture: string | null }): ReactEcs.JSX.Element {
  return (
    <CookCellOverlay
      centerPct={[80, 36]}
      sizePct={COOK_OUTPUT_ICON_SIZE_PCT}
      texture={props.previewTexture}
      shortage={null}
    />
  )
}

// Generic absolute-positioned cell anchored at the given % of the
// layout texture. `onPress` is optional — output preview cell omits it
// since clicking the cooked-result preview should do nothing.
// `shortage` non-null renders a small red have/need pill in the
// bottom-right corner; null hides it (the common case).
function CookCellOverlay(props: {
  centerPct: readonly [number, number]
  sizePct: number
  texture: string | null
  shortage: { text: string } | null
  onPress?: () => void
  key?: number | string
}): ReactEcs.JSX.Element {
  const w = Math.round((COOK_LAYOUT_WIDTH * props.sizePct) / 100)
  const cx = Math.round((COOK_LAYOUT_WIDTH * props.centerPct[0]) / 100)
  const cy = Math.round((COOK_LAYOUT_HEIGHT * props.centerPct[1]) / 100)
  const left = cx - Math.round(w / 2)
  const top = cy - Math.round(w / 2)
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top, left },
        width: w,
        height: w,
        borderRadius: 8
      }}
      uiBackground={{ color: UI_GLASS }}
      onMouseDown={beginUiTouch}
      onMouseUp={props.onPress}
    >
      {props.texture === null && (
        <Label
          value={props.onPress ? '+' : '?'}
          fontSize={26}
          color={UI_MUTED}
          uiTransform={{ width: '100%', height: '100%' }}
        />
      )}
      {props.texture !== null && (
        <UiEntity
          uiTransform={{ width: '100%', height: '100%' }}
          uiBackground={{
            textureMode: 'stretch',
            texture: { src: props.texture }
          }}
        />
      )}
      {props.shortage !== null && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { right: -2, bottom: -2 },
            minWidth: 28,
            height: 18,
            padding: { left: 4, right: 4 },
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: COOK_SHORTAGE_BG }}
        >
          <Label value={props.shortage.text} fontSize={12} color={COOK_SHORTAGE_FG} textAlign="middle-center" />
        </UiEntity>
      )}
    </UiEntity>
  )
}

function CookActionRow(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexShrink: 0,
        height: CRAFT_BUTTON_FRAME_H
      }}
    >
      <CookActionButton />
    </UiEntity>
  )
}

function CookActionButton(): ReactEcs.JSX.Element {
  const scale = cookActionPulse.getScale()
  const w = Math.round(CRAFT_BUTTON_W * scale)
  const h = Math.round(CRAFT_BUTTON_H * scale)
  const enabled = canStartCook()
  return (
    <UiEntity
      uiTransform={{
        width: CRAFT_BUTTON_FRAME_W,
        flexShrink: 0,
        height: CRAFT_BUTTON_FRAME_H,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: w,
          height: h,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center'
        }}
        uiBackground={{
          // Dim the button when no recipe matches so the player gets a
          // visual cue that pressing it won't start a cook.
          color: enabled ? UI_ACCENT : UI_CELL
        }}
        onMouseDown={beginUiTouch}
        onMouseUp={() => {
          if (!enabled) return
          cookActionPulse.press()
          startCook()
        }}
      >
        <Label
          value="COOK"
          fontSize={17}
          color={enabled ? CRAFT_BUTTON_FG : UI_INK}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function idToTexture(id: string | null): string | null {
  if (id === null) return null
  // Catalog-wide so placed cells render even when the ingredient isn't
  // in the player's inventory layout (e.g. storage-only picks).
  return getCatalogItem(id)?.texture ?? null
}

// Right-hand panel: the "recipe book". Lists every recipe the player has
// LEARNED — initially just the 1-ingredient plates, growing every time
// the player guesses a new combo via free-form placement and cooks it.
// Clicking a row symbolically fills the cook cells with that recipe's
// ingredients; missing ingredients show their `0/X` shortage badge.
function CookRecipeList(): ReactEcs.JSX.Element {
  const learnedIds = getLearnedRecipeIds()
  const matchedId = getMatchingRecipe()?.id ?? null
  return (
    <Panel
      uiTransform={{
        width: COOK_LIST_WIDTH,
        height: Math.min(COOK_LIST_HEIGHT, getMobileLayout().height - 32),
        flexDirection: 'column',
        padding: {
          top: CRAFT_PANEL_PADDING_TOP,
          bottom: CRAFT_PANEL_PADDING_BOTTOM,
          left: COOK_LIST_PADDING_X,
          right: COOK_LIST_PADDING_X
        }
      }}
    >
      <Label
        value="KNOWN RECIPES"
        fontSize={20}
        color={CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ width: '100%', height: 32 }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 1,
          margin: { top: 6, bottom: 8 }
        }}
        uiBackground={{ color: CRAFT_DIVIDER_COLOR }}
      />
      {/* Scroll container — once the player has discovered enough
          recipes the list overflows the panel height, so the inner
          column scrolls (drag / mouse wheel) while the wood frame
          stays put. flexGrow: 1 makes it eat the remaining vertical
          space below the title + divider. */}
      <MenuList id="recipes" height={Math.min(COOK_LIST_HEIGHT, getMobileLayout().height - 32) - 110} rowHeight={60}>
        {learnedIds.length === 0
          ? [
              <Label
                value="Cook ingredients to discover recipes."
                fontSize={12}
                color={CRAFT_TEXT_DIM_COLOR}
                textAlign="top-left"
                uiTransform={{ width: '100%', height: 60 }}
              />
            ]
          : learnedIds.map((id) => {
              const recipe = getCookableById(id)
              if (recipe === null) return null
              return <CookRecipeRow key={id} recipe={recipe} selected={matchedId === id} />
            })}
      </MenuList>
    </Panel>
  )
}

// One learned-recipe row. Displays icon + name + a have/need count of
// distinct ingredients the player can currently supply. Clicking the
// row clears any in-progress placement and drops the recipe's
// ingredients (and fuel) into their cells, so the player can cook it
// straight away when they have everything, or see exactly which
// ingredients are missing via the existing shortage badges.
function CookRecipeRow(props: { recipe: CookableItem; selected: boolean; key?: string }): ReactEcs.JSX.Element {
  const recipe = props.recipe
  let owned = 0
  for (const ing of recipe.ingredients) {
    if (getCombinedCount(ing.itemId) >= ing.amount) owned++
  }
  const total = recipe.ingredients.length
  const enough = owned >= total
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 56,
        flexShrink: 0,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        margin: { bottom: 4 },
        padding: { left: 6, right: 6 }
      }}
      uiBackground={props.selected ? { color: CRAFT_ROW_SELECTED_BG } : undefined}
      onMouseDown={beginUiTouch}
      onMouseUp={() => applyRecipeToCells(recipe)}
    >
      <UiEntity
        uiTransform={{ width: COOK_RECIPE_ICON_SIZE, height: COOK_RECIPE_ICON_SIZE }}
        uiBackground={{
          textureMode: 'stretch',
          texture: { src: recipe.texture }
        }}
      />
      <Label
        value={recipe.name}
        fontSize={14}
        color={props.selected ? CRAFT_TEXT_LIGHT_COLOR : CRAFT_TEXT_COLOR}
        textAlign="middle-left"
        uiTransform={{ flexGrow: 1, height: '100%', margin: { left: 8 } }}
      />
      <Label
        value={`${owned}/${total}`}
        fontSize={12}
        color={enough ? CRAFT_HAVE_OK_COLOR : CRAFT_HAVE_LOW_COLOR}
        textAlign="middle-right"
        uiTransform={{ width: 40, flexShrink: 0, height: '100%' }}
      />
    </UiEntity>
  )
}

function cookHint(): string {
  const recipe = getMatchingRecipe()
  if (!recipe) return 'Select a known recipe, or combine ingredients to discover one.'
  const needs = [...recipe.ingredients, recipe.fuel].filter((i) => getCombinedCount(i.itemId) < i.amount)
  if (needs.length)
    return `Missing: ${needs.map((i) => `${i.amount - getCombinedCount(i.itemId)} ${i.itemId}`).join(', ')}`
  if (getCookFuel() !== recipe.fuel.itemId) return 'Pick wood from your supplies, then tap the fuel slot.'
  return `Ready: ${recipe.name}. Collect it from the grill when cooked.`
}

function CookSupplies(): ReactEcs.JSX.Element {
  const ids = new Set<string>(collectStorageItemIds())
  for (let i = 0; i < 30; i++) {
    const item = getInventorySlot(i)
    if (item) ids.add(item.id)
  }
  const items = Array.from(ids)
    .map(getCatalogItem)
    .filter((item) => item?.ingredient && getCombinedCount(item.id) > 0)
  return (
    <Panel
      uiTransform={{
        width: 240,
        height: Math.min(540, getMobileLayout().height - 32),
        padding: 16,
        flexDirection: 'column'
      }}
    >
      <Label
        value="SUPPLIES"
        fontSize={20}
        color={UI_INK}
        textAlign="middle-left"
        uiTransform={{ width: '100%', height: 36 }}
      />
      <Label
        value="Pick an ingredient, then tap an empty slot."
        fontSize={13}
        color={UI_MUTED}
        textAlign="top-left"
        uiTransform={{ width: '100%', height: 48, flexShrink: 0 }}
      />
      {items.length === 0 && (
        <Label
          value="No ingredients yet. Fish or search barrels for food."
          fontSize={15}
          color={UI_MUTED}
          uiTransform={{ width: '100%', height: 80 }}
        />
      )}
      <MenuList id="supplies" height={Math.min(540, getMobileLayout().height - 32) - 116} rowHeight={52}>
        {items.map(
          (item) =>
            item && (
              <UiEntity
                key={item.id}
                uiTransform={{
                  width: '100%',
                  height: 48,
                  flexShrink: 0,
                  margin: { bottom: 4 },
                  padding: 4,
                  borderRadius: 6,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                uiBackground={{ color: getPickedIngredient() === item.id ? UI_ACCENT : UI_CELL }}
                onMouseDown={beginUiTouch}
                onMouseUp={() => {
                  pickIngredient(item.id)
                }}
              >
                <UiEntity
                  uiTransform={{ width: 32, height: 32 }}
                  uiBackground={{ textureMode: 'stretch', texture: { src: item.texture } }}
                />
                <Label
                  value={getItemDisplayName(item)}
                  fontSize={13}
                  color={UI_INK}
                  textAlign="middle-left"
                  uiTransform={{ width: 124, height: 40, margin: { left: 4 } }}
                />
                <Label
                  value={`${getCombinedCount(item.id)}`}
                  fontSize={13}
                  color={UI_MUTED}
                  uiTransform={{ width: 36, height: 40 }}
                />
              </UiEntity>
            )
        )}
      </MenuList>
    </Panel>
  )
}
