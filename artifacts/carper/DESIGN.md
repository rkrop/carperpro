# Carper — Design System (do not break)

This document is the **source of truth for the Carper visual language**. Any new
feature, refactor, or "improvement" MUST keep the app looking and feeling exactly
like this. If a change would alter the aesthetic below, stop and reconsider — the
design is intentional and approved.

> **Concept:** "Polestar editorial" — near-monochrome, engineered, calm. The
> catalog does the talking; the chrome stays out of the way.

---

## 1. Color — monochrome + ONE accent

~95% of every screen is black / white / neutral gray. A single electric blue is
the **only** color and is reserved for deal / CTA / compatibility moments.

| Token | Value | Use |
|-------|-------|-----|
| `background` | `#ffffff` | Primary surface |
| `neutral50` / `backgroundAlt` | `#fafafa` | Quiet section background |
| `foreground` | `#0a0a0a` | Text, icons, strong borders |
| `primary` / `accent` | `#0055FF` | **Only** accent — CTAs, deal, compatibility |
| `primaryPressed` | `#0044CC` | Pressed accent |
| `primarySoft` | `#eef2ff` | Accent panel fill (compatibility) |
| `success` | `#16a34a` | Status only — stock / compatibility confirmed |
| `destructive` | `#dc2626` | Status only — errors, "cerrar sesión", agotado |
| `border` | `#e5e5e5` | Hairline dividers |
| `borderStrong` | `#0a0a0a` | Emphasized border (pressed cards) |
| `mutedForeground` | `#737373` | Secondary text |
| `neutral400` | `#a3a3a3` | Tertiary text / chevrons |

**Rules**
- Never introduce a new accent color. Blue is it. Green/red are status signals
  only, never decoration.
- Never use gradients, drop shadows, or soft glows. Surfaces are flat.
- Always read colors from `useColors()` — never hard-code hex in components.

## 2. Shape & spacing

- **`radius: 0` everywhere.** Sharp corners. No rounded cards, buttons, or inputs.
- Dividers are **1px hairlines** (`borderColor: c.border`), never thick rules.
- Section horizontal padding is `24`. Section vertical rhythm is `28`–`32`.
- Grids are built from bordered cells (top+left on the container, right+bottom on
  each cell) — see the home quick-actions grid and category grids.

## 3. Typography

Two families only:
- **Inter** — the grotesk workhorse. The editorial scale leans on the heaviest
  weights (`Fonts.black` / `Fonts.bold`).
- **Space Mono** (`Fonts.mono` / `Fonts.monoBold`) — renders all SKUs, prices,
  folios, counts as "engineered data".

**Rules**
- Headings: `Fonts.black`, large size, **negative letter-spacing** (`-1` to `-2`),
  `textTransform: "uppercase"`.
- Section labels: `Fonts.bold`, ~10px, **positive** letter-spacing (`1`–`1.5`),
  uppercase, muted color. Use the shared `<SectionLabel>`.
- Body: `Fonts.medium`, 11–12px.
- Numbers/codes/prices: always `Fonts.mono` / `Fonts.monoBold`.
- Always read families from `constants/fonts.ts` (`Fonts.*`).

## 4. Components & language

- Mexican Spanish UI, throughout. Keep copy short and direct.
- Interactive surfaces use `Pressable` with a `pressed` state that shifts the
  background to `c.neutral50` and/or border to `c.borderStrong` — never opacity-only
  unless that's the existing pattern (e.g. image cards use `opacity: 0.85`).
- Reuse the shared primitives in `components/CarperUI.tsx` (`SectionLabel`,
  `Hairline`, `Skeleton`, `EmptyState`) instead of re-styling inline.

## 5. Images & aspect ratio (critical RN-Web gotcha)

`aspectRatio` on `<Image>` is **unreliable in this Expo Web setup**. It distorts or
collapses images.

- For images: wrap in a **fixed-height `View`** (height computed from the asset's
  real pixel ratio) and set the `Image` to `width:"100%" height:"100%"` with
  `resizeMode="cover"` (or `"contain"` for logos).
- Derive responsive heights from `useWindowDimensions()` (not `Dimensions.get()`),
  so they track resize/orientation. Example: `imgH = width * (assetH / assetW)`.
- `aspectRatio` on a **`View`** is fine (logo wall, square category cells).
- Store each asset's intrinsic ratio next to its `require()` (see
  `lib/brandAssets.ts` `SupplierBanner.ratio`) so sizing stays distortion-free.

## 6. Brand / catalog facts that shape the UI

- The catalog is mostly **"SIN MARCA"**, so brand logos are a non-tappable
  *credibility wall*, not per-product badges.
- Deep links into results use `?q=` (search) or `?category=<id>` — **never**
  `?brand=` (`resultados.tsx` only reads `q` / `category` / `compat`).
- Metro requires **static literal `require()` paths** — no dynamic requires.

---

### Before merging any change, check:
1. No new colors (blue is the only accent; green/red are status only).
2. `radius: 0`, hairline borders, flat surfaces — still true.
3. Headings black + tight tracking + uppercase; data in mono.
4. Images use fixed-height wrappers (no `aspectRatio` on `<Image>`).
5. Colors/fonts read from tokens, not hard-coded.
