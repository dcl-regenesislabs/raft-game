---
name: mobile-ui-scaling
description: Make Decentraland SDK7 scene UI scale and resize the same way godot-explorer's native HUD does — fixed pixel sizes, edge-anchored positions, and safe-area-aware layout. Use when the user wants their scene UI to "feel native", behave consistently across resolutions, support mobile, or coexist with the explorer's chrome (chat, minimap, notch). Do NOT use for proportionally-scaling fullscreen UIs (cinematic intros, splash screens, art) — those need a virtual canvas instead.
---

# Mobile-Style UI Scaling for SDK7 Scenes

> **Goal:** UI that holds its pixel size when the window resizes, repositions when explorer chrome opens/closes, and respects mobile safe-area insets. Same behavior as godot-explorer's own HUD.

## TL;DR — three rules

1. **Do NOT pass `virtualWidth`/`virtualHeight` to `setUiRenderer`.**
2. **Size every UI element with pixel literals** (`width: 66`, not `'50%'`, not `'10vw'`).
3. **Position with edge anchors** (`right: N`, `bottom: M`, `top: '50%' + margin`) — never raw X/Y.

Wrap interactive content in `<SafeAreaContainer>` (from `@dcl/react-ecs`, available since the `getSafeAreaInsets` PR — see _decentraland/js-sdk-toolchain#1386_).

> **Project note (hackathon-scene):** the wrapper is applied only when `isMobile()` returns `true`. Desktop renders into a plain full-canvas `<UiEntity>` instead. Rationale: on desktop the chat/minimap chrome is rendered *outside* the scene's UI canvas, so `interactableArea` is `(0,0,0,0)` and the wrapper would only consume a render layer for no behavioural change. Mobile is the only platform here where insets reflect real chrome (notch, home indicator) overlapping the canvas. Do not flag the conditional wrapper as a violation.
>
> **Project note 2 (hackathon-scene):** Rule 1 (no virtual canvas) does **not** apply in this project. Both platforms render through the same `{ virtualWidth: 1366, virtualHeight: 768 }` canvas — proportional scaling was preferred over godot-style pixel-stable sizing for this scene. See `src/ui/index.tsx`.

## Why each rule matters

### Rule 1 — no virtual canvas

```ts
// ✅ Pixel-stable
ReactEcsRenderer.setUiRenderer(MyUI)

// ❌ Items rescale every frame as window resizes
ReactEcsRenderer.setUiRenderer(MyUI, { virtualWidth: 1920, virtualHeight: 1080 })
```

With a virtual canvas the SDK applies `Math.min(canvasW/virtualW, canvasH/virtualH)` to every plain-number value (see `packages/@dcl/react-ecs/src/components/uiTransform/utils.ts:60` — `scalePixelValue(value) = value * uiScaleFactor`). The `min` clamps to whichever dimension is *more* constrained, so width and height resizes affect sizes asymmetrically — exactly the "items shrink when I make the window shorter but not when I make it narrower" surprise.

Without a virtual canvas, `uiScaleFactor` stays pinned at 1.0, the multiplication is a no-op, and `width: 20` is always 20 logical pixels.

### Rule 2 — pixel literals everywhere

```tsx
// ✅
uiTransform={{ width: 66, height: 66, borderRadius: 33 }}

// ❌ couples size to canvas dimensions
uiTransform={{ width: '5vw', height: '10%' }}
```

Reserve `'100%'` for containers that should *fill* their parent (the root, full-bleed backgrounds, grid containers). Reserve `'50%'` only for the centering trick (`left: '50%' + margin: { left: -halfWidth }`).

### Rule 3 — edge-anchored positioning

```tsx
// ✅ stays 24 px from the bottom-right corner forever
position: { right: 24, bottom: 24 }

// ✅ stays vertically centered against the right edge
position: { right: 24, top: '50%' }
margin: { top: -halfHeight }

// ❌ breaks the moment the canvas size differs from your assumption
position: { left: 1837, top: 696 }
```

## SafeAreaContainer — the multiplier

`UiCanvasInformation.interactableArea` reports four insets (top/left/right/bottom in canvas px) — pixels reserved on each edge for explorer chrome (chat, minimap on desktop) or hardware (notch, home indicator on mobile). `SafeAreaContainer` reads those each frame and re-anchors its children to the *safe* rectangle:

```tsx
import { SafeAreaContainer, getSafeAreaInsets } from '@dcl/sdk/react-ecs'

const Hud = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
    <SafeAreaContainer>
      {/* `right: 24` here means 24 px from the safe-right edge */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { right: 24, bottom: 24 },
          width: 66,
          height: 66,
          borderRadius: 33,
        }}
        uiBackground={{ color: HUD_DARK }}
      />
    </SafeAreaContainer>
  </UiEntity>
)
```

Without `SafeAreaContainer`, your bottom-right button would render under the chat icon when chat opens. With it, the button slides inward as the safe area shrinks. The shift is automatic — children don't need to read insets themselves.

For non-React code paths (or when you want the raw values for math), call `getSafeAreaInsets()`:

```ts
const { top, left, right, bottom } = getSafeAreaInsets()
```

## Centering tricks (no flexbox dependency)

Edge anchoring composes well with the `'50%' + negative-margin` centering trick:

```tsx
// Centered horizontally, anchored to top
uiTransform={{
  positionType: 'absolute',
  position: { top: 28, left: '50%' },
  margin: { left: -halfWidth },
  width: 220,
  height: 56,
}}

// Centered both axes (modal / debug panel)
uiTransform={{
  positionType: 'absolute',
  position: { left: '50%', top: '50%' },
  margin: { left: -halfWidth, top: -halfHeight },
  width: 520,
  height: 280,
}}

// Stretched edge-to-edge with insets
uiTransform={{
  positionType: 'absolute',
  position: { top: 0, left: 0, right: 0, bottom: 0 },
}}
```

## Anchor cluster pattern (godot-style)

godot-explorer's HUD groups buttons into corner clusters with absolute positioning. Mirror it:

```tsx
function ChatbarCluster() {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { top: 28, left: 3 },
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Button size={66} icon='chat' margin={{ right: 12 }} />
      <Button size={66} icon='compass' margin={{ right: 12 }} />
      <Button size={172} icon='share' text='0,0' />
    </UiEntity>
  )
}
```

The container is positioned absolutely; flex inside the container handles inter-button spacing. Container moves with the safe-area edge, internal layout stays correct.

For radial / fan layouts (action button cluster), compute each child's `right` and `bottom` from a center point + per-button angle and radius:

```tsx
const cx = 123  // jump-button center, distance from safe-bottom-right
const cy = 67
const D = (deg: number) => (deg * Math.PI) / 180

const pos = (angleDeg: number, radius: number, btnSize: number) => {
  const dx = radius * Math.sin(D(angleDeg))
  const dy = radius * Math.cos(D(angleDeg))
  return {
    right: cx + dx - btnSize / 2,
    bottom: cy + dy - btnSize / 2,
  }
}

// angle 0° = directly above center; 90° = directly left; negative = right of center
<Button position={pos(-9, 139, 52)} />   // F: slightly right, longest arm
<Button position={pos(8, 114, 52)} />    // 12: nearly straight up
<Button position={pos(52, 91, 52)} />    // E: diagonal up-left
<Button position={pos(79, 116, 48)} />   // pointer: nearly horizontal-left
```

Use **per-button radius** rather than a shared one — godot's fan isn't uniformly circular.

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Items shrink when window resizes height but not width (until width also drops) | `virtualWidth/Height` set + `Math.min` formula | Drop the virtual canvas |
| HUD sits under chat panel when chat opens | Anchored to canvas edges, not safe-area edges | Wrap in `<SafeAreaContainer>` |
| Items in different sizes on different displays | Some elements use `vw`/`vh`, others use literals | Convert to pixel literals everywhere |
| Cross-runtime inconsistency (looks fine in godot, broken in unity) | unity-explorer reports `interactableArea: (0,0,0,0)` always | Known protocol gap — see `decentraland/bevy-explorer#754`. Until that converges, use `isMobile()` + a hardcoded preset insets fallback when `getSafeAreaInsets()` returns zeros on mobile |
| 20 px is invisible on a 4K display | No virtual canvas means no DPR amplification | Multiply sizes by `canvas.devicePixelRatio` manually for the affected elements, or accept the trade-off (godot's own UI has the same limitation) |

## When NOT to apply this skill

- **Cinematic / fullscreen art** that should fill the screen proportionally (intro splashes, modal videos, logos). Use `virtualWidth/Height` for those — proportional scaling is the goal.
- **Strict aspect-ratio scenes** (e.g. a chess board UI) where you want letterboxing. `virtualWidth/Height` gives you that for free.

The two patterns can coexist: use `addUiRenderer` with a virtual canvas for the cinematic layer, and `setUiRenderer` without one for the persistent HUD. Each renderer applies its own scale.

## Cross-references

- **`build-ui` skill** — full React-ECS API surface (`UiEntity`, `Label`, `Button`, props, events).
- **godot-explorer's mobile HUD source** — `godot/src/ui/components/joypad/joypad.tscn`, `godot/src/ui/components/chatbar/chatbar.tscn`, `godot/src/mobile/joystick/virtual_joystick.tscn`. Concrete reference for sizes, anchors, and theme constants.
- **godot-explorer's `_push_scene_interactable_area`** — `godot/src/ui/explorer.gd:365` — the producer side of `UiCanvasInformation.interactableArea`.
- **bevy-explorer issue #754** — discussion on aligning `UiCanvasInformation` semantics across the three explorers (logical vs physical px, default insets, engine-side clipping).
- **js-sdk-toolchain PR #1386** — landed `SafeAreaContainer` + `getSafeAreaInsets()` in `@dcl/react-ecs`. Required to follow this skill verbatim.

## Reference: godot palette and metrics

Useful when matching godot-explorer's visual style exactly:

| Token | Value | Purpose |
|---|---|---|
| `Color(0, 0, 0, 0.70)` | dark translucent | `touchable_normal` button fill |
| `Color(0, 0, 0, 0.90)` | darker pill | `Chatbar PanelContainer` background |
| `Color(0.99, 0.99, 0.99, 1)` | off-white | Borders, icon glyph color |
| `Color(0.93, 0.92, 0.93, 1)` | light grey | Avatar placeholder |
| 4 px | border width on touchable buttons | All circular buttons |
| 28 px | font size | Coords pill (`Label_Coordinates`) |
| 66 / 80 / 120 px | button diameters | Standard / avatar / jump |
| 1561 × 720 | landscape mobile reference | Used for HUD anchor offsets |

Reference image safe-area insets (godot-explorer at 1561×720 landscape with chat panel docked): `top:0, left:108, right:108, bottom:38`. Useful as a sanity check that your scene UI is reading insets correctly.
