import { UI_ACCENT, UI_INK, UI_MUTED } from '../visualTheme'
import { beginUiTouch } from '../mobileControlsState'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { Panel } from '../panel'
import { isTutorialExpanded, dismissTutorial, hasTutorialAction, isTutorialEnabled, showTutorial, type TutorialAction } from '../tutorialState'

type Step = { action: TutorialAction; title: string; text: string }
export function Tutorial(): ReactEcs.JSX.Element {
  const fire = isMobile() ? 'hold the item action icon, then release' : 'hold left-click, then release'
  const interact = isMobile() ? 'tap the contextual interaction icon' : 'press E'
  const steps: Step[] = [
    { action: 'collect', title: 'Catch your first supplies', text: `${isMobile() ? 'Your hook starts equipped.' : 'Select your hook in the bottom bar.'} Aim at debris, ${fire} to cast. Tap CHANGE TOOL at the top right to equip another tool. Grab nearby supplies with the interaction icon.` },
    { action: 'inventory', title: 'Check your backpack', text: isMobile() ? 'Open the backpack at the top right. All 30 slots hold any item. Tap two slots to move items. Close the backpack and tap CHANGE TOOL to equip any tool, food or container.' : 'Open the backpack at the top right. Collected materials go into your inventory. Pick an item in the backpack and choose EQUIP. The bottom bar retains keyboard shortcuts.' },
    { action: 'rope', title: 'Make rope', text: 'Collect 2 plants from the ocean. Open crafting with the saw button at the top right, select ROPE, and craft it.' },
    { action: 'hammer', title: 'Build your first tool', text: 'Craft a HAMMER using 2 wood and 1 rope. Need more rope? Collect plants and craft another length.' },
    { action: 'expand', title: 'Give yourself more room', text: `Equip the hammer. Collect 2 wood, 2 plastic and 1 rope per tile. Aim beside your raft until the preview is green, then ${isMobile() ? 'use the small tool icon to switch Build/Erase; tap the large hammer to place' : 'left-click'} to place.` },
    { action: 'purifier', title: 'Set up drinking water', text: 'Craft a WATER PURIFIER: 3 wood, 2 rope, 2 plastic and 1 metal. Equip it, aim at an empty raft tile and confirm the green placement preview.' },
    { action: 'saltWater', title: 'Fill a cup', text: `Craft and equip a CUP. Aim down at nearby ocean water and ${interact} to fill it. Do not drink salt water: it lowers your thirst bar.` },
    { action: 'freshWater', title: 'Purify the water', text: `Aim at the purifier with your salt-water cup and ${interact} to pour. ${isMobile() ? 'Tap the wood icon to add fuel. Wait for fresh water, then tap the water icon to drink directly.' : 'Add wood with F. Wait for fresh water, then press E to drink directly.'}` },
    { action: 'drink', title: 'Take a drink', text: `Equip your fresh-water cup and ${isMobile() ? 'use the small tool icon to switch Build/Erase; tap the large hammer to place' : 'left-click'} to drink. Your thirst improves and you keep the empty cup.` },
    { action: 'grill', title: 'Start your kitchen', text: 'Craft a GRILL: 2 metal, 3 wood and 2 rope. Equip it and place it on another empty raft tile. Expand again if you need space.' },
    { action: 'eat', title: 'Cook your first meal', text: `Gather ingredients from barrels or fishing. Aim at the grill and ${interact}. Add ingredients and wood, cook, then collect the result. Equip the meal and use fire to eat.` }
  ]
  const index = steps.findIndex(step => !hasTutorialAction(step.action))
  const step = steps[index]
  if (isMobile() && (!isTutorialEnabled() || !isTutorialExpanded())) return <UiEntity uiTransform={{ display: 'none' }} />
  if (!isTutorialEnabled()) {
    return <UiEntity uiTransform={{ positionType: 'absolute', position: isMobile() ? { top: 0, right: 408 } : { top: 8, left: 12 }, width: 135, height: 36 }} onMouseDown={beginUiTouch} onMouseUp={showTutorial} uiBackground={{ color: Color4.create(0.1, 0.15, 0.15, 0.9) }}><Label value="TUTORIAL" fontSize={17} uiTransform={{ width: '100%', height: '100%' }} /></UiEntity>
  }
  return (
    <UiEntity uiTransform={{ positionType: 'absolute', position: isMobile() ? { top: 0, right: 408 } : { top: 8, left: 12 }, width: isMobile() ? 296 : 350 }}>
      <Panel uiTransform={{ width: '100%', padding: 14, flexDirection: 'column' }}>
        <Label value={step ? `SURVIVAL GUIDE   ${index + 1} / ${steps.length}` : 'SURVIVAL GUIDE COMPLETE'} fontSize={16} color={UI_MUTED} uiTransform={{ width: '100%', height: 24 }} />
        <Label value={step?.title ?? 'You know the basics!'} fontSize={isMobile() ? 19 : 23} color={UI_INK} uiTransform={{ width: '100%', height: isMobile() ? 44 : 35 }} />
        <Label value={step?.text ?? 'Keep collecting supplies, watch your hunger and thirst, and defend your raft. Craft a spear before the sharks attack. Explore new recipes and encounters at your own pace.'} fontSize={isMobile() ? 15 : 17} color={UI_INK} textAlign="top-left" uiTransform={{ width: '100%', height: isMobile() ? 142 : 130 }} />
        <UiEntity onMouseDown={beginUiTouch} onMouseUp={dismissTutorial} uiTransform={{ width: '100%', height: 32 }} uiBackground={{ color: UI_ACCENT }}><Label value={step ? 'HIDE GUIDE' : 'KEEP SURVIVING'} fontSize={16} uiTransform={{ width: '100%', height: '100%' }} /></UiEntity>
      </Panel>
    </UiEntity>
  )
}
