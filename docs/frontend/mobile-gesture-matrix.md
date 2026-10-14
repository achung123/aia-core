# Mobile Gesture & Tap-Target Matrix (T-029 AC-1)

**Spec:** specs/table-3d-revamp-010 — T-029 (S-6.3)
**Scope:** 3D table route and overlays — Playback (`#/playback`), dealer
embed (`TableView3D`), player POV (`#/player/table`).

## Devices verified

| # | Device | OS / Browser | Viewport (portrait) |
|---|---|---|---|
| 1 | iPhone SE (2022, emulated Chrome DevTools device frame) | iOS 17 Safari simulation | **360 × 780** (narrowest supported) |
| 2 | Pixel 5 (emulated Chrome DevTools device frame) | Android 14 Chrome | 393 × 851 |

## Gesture matrix

| Surface | Gesture | Outcome | Status |
|---|---|---|---|
| Canvas (`<PokerCanvas>`) | single-finger drag | OrbitControls rotate | ✅ |
| Canvas | two-finger pinch | OrbitControls dolly (zoom) | ✅ |
| Canvas | two-finger pan | OrbitControls truck | ✅ |
| Canvas | single-finger tap | Pass-through (no selection) | ✅ |
| `CameraPresetToolbar` button | tap | `onChange(preset)` fires | ✅ |
| `HandScrubberPanel` play/pause | tap | toggle play state | ✅ |
| `HandScrubberPanel` street button | tap | jump to street; disabled ones reject | ✅ |
| `TableSettingsPanel` radio swatch | tap | updates theme / tier; tier flips `manualOverride` | ✅ |
| `SessionScrubber` prev / next | tap | advances hand index | ✅ |
| `SessionScrubber` range thumb | drag | scrubs session | ✅ (thumb sized 48×48) |
| `QualityToast` Dismiss | tap | clears `tierToast` | ✅ |
| Orientation flip | portrait ↔ landscape | No flicker; overlays re-layout via CSS flex | ✅ |

## Tap-target compliance

All interactive overlay controls expose inline `minWidth` / `minHeight` ≥
**44 px** (iOS HIG) — asserted by
[mobileAudit.test.tsx](../../frontend/test/scenes3d/mobileAudit.test.tsx)
AC-2 block.

## 360px layout compliance

At `window.innerWidth = 360`:

- `HandScrubberPanel` minimum inline sum = 44 + 8 + 5×44 + 4×4 + 16 = **304 px** ≤ 360.
- `CameraPresetToolbar` minimum sum = 3×44 + 2×8 = **148 px** ≤ 360.
- `TableSettingsPanel` radio groups use `flexWrap: 'wrap'` → swatches reflow instead of scrolling horizontally.
- `SessionScrubber` fixed-width controls (prev + label + next + padding) = 180 px; fluid slider consumes the remaining 180 px.

Asserted by the AC-3 block of
[mobileAudit.test.tsx](../../frontend/test/scenes3d/mobileAudit.test.tsx).

## Orientation change

Portrait ↔ landscape flips dispatch `resize` and `orientationchange`
events; overlay components render without throwing and preserve their
state. Asserted by the AC-4 block of
[mobileAudit.test.tsx](../../frontend/test/scenes3d/mobileAudit.test.tsx).
