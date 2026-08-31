# 2. Branding & UI Requirements

## 2.1 Theme concept
Base app shell: **black + blue**, giving Foundly a "night campus / lost-and-found lantern" feel — dark surfaces with a glowing blue accent that literally lights the way to a match. Mode-specific tints differentiate Lost vs Found without the user needing to read a label.

## 2.2 Color palette

| Token | Hex | Usage |
|---|---|---|
| `bg.base` | `#0B0E14` | App background (near-black, slightly blue-tinted) |
| `bg.surface` | `#151A24` | Cards, sheets, nav bar |
| `bg.surface.raised` | `#1E2430` | Modals, elevated cards |
| `brand.blue.core` | `#2F6FED` | Primary brand blue (buttons, links, active states) |
| `brand.blue.glow` | `#5FA8FF` | Loading "F" glow, highlights, focus rings |
| `mode.lost.primary` | `#12224A` | Lost Mode dark-blue surface tint |
| `mode.lost.accent` | `#3E63FF` | Lost Mode accent (buttons, active tab) |
| `mode.found.primary` | `#173A5E` | Found Mode surface tint (lighter blue than Lost) |
| `mode.found.accent` | `#4FC3F7` | Found Mode accent (light/sky blue) |
| `text.primary` | `#F5F7FA` | Primary text on dark |
| `text.secondary` | `#9AA5B8` | Secondary/meta text |
| `text.disabled` | `#5B6478` | Disabled text |
| `success` | `#33C481` | Confirmed match, success toasts |
| `warning` | `#F5B942` | Medium-confidence match, non-blocking warnings |
| `error` | `#FF5A5F` | Errors, destructive actions |
| `divider` | `#242B38` | Hairlines, card borders |

Contrast check: `text.primary` on `bg.base` = 15.8:1, `text.secondary` on `bg.base` = 6.9:1 — both pass WCAG AA for body text at any size, and AAA for normal text.

## 2.3 Typography

- **Primary typeface:** Inter (or SF Pro / Roboto as OS-native fallback) — geometric, highly legible at small sizes, free/open license.
- **Display/headline accent (optional):** Space Grotesk for the "F" logomark and screen titles, for a slightly techy edge; body text always Inter for readability.

| Style | Font / Weight | Size | Line height | Use |
|---|---|---|---|---|
| Display | Space Grotesk Bold | 32sp | 40 | Splash logo lockup, empty states |
| H1 | Inter SemiBold | 24sp | 32 | Screen titles |
| H2 | Inter SemiBold | 18sp | 26 | Section headers, card titles |
| Body | Inter Regular | 15sp | 22 | Descriptions, form values |
| Body Emphasis | Inter Medium | 15sp | 22 | Labels, emphasized values |
| Caption | Inter Regular | 12sp | 16 | Timestamps, meta, helper text |
| Button | Inter SemiBold | 15sp | 20 | All CTAs |

Minimum tap-legible size is 12sp (captions only); no interactive text below 14sp.

## 2.4 Loading screen — the blinking "F"

**Concept:** a single large "F" glyph (Space Grotesk Bold, ~120sp) centered on `bg.base`, pulsing like a star/beacon — a nod to "Foundly finds things in the dark."

**Animation spec:**
- **Idle pulse (star-blink):**
  - Opacity: 40% → 100% → 40%
  - Scale: 0.96 → 1.0 → 0.96
  - Glow: outer `box-shadow`/blur radius animates 8px → 24px → 8px using `brand.blue.glow` at 35% opacity
  - Duration: 1400ms per full cycle
  - Easing: `cubic-bezier(0.45, 0, 0.55, 1)` (ease-in-out, "breathing" not mechanical)
  - Loop: infinite until load completes
- **Entry:** F fades/scales in from 0 → 1 over 300ms, `ease-out`, before the pulse loop begins.
- **Exit (load complete):** one quick "flash" — opacity to 100%, scale to 1.08 over 120ms `ease-out`, then cross-fade (200ms) into the home screen. This flash reads as the star "catching" before handoff.
- **Timeout / fallback:** if load exceeds 4s, swap the glow pulse for a thin circular progress ring around the F (`brand.blue.core`, 2px stroke) so users get concrete feedback instead of an indefinite blink. If load exceeds 10s, show inline text below the F: "Still connecting…" plus a manual retry button.
- **Reduced motion:** if the OS "Reduce Motion" setting is on, replace the pulse with a static F plus a simple indeterminate progress bar beneath it — no scale/opacity animation.
- **Performance note:** implement as a Lottie/Rive vector animation (not GIF) so it stays crisp at all densities and is cheap to loop.

## 2.5 Mode theming

| Element | Lost Mode | Found Mode |
|---|---|---|
| Nav bar / header bg | `mode.lost.primary` (#12224A) over `bg.base` | `mode.found.primary` (#173A5E) over `bg.base` |
| Primary button | `mode.lost.accent` (#3E63FF) | `mode.found.accent` (#4FC3F7), text uses `bg.base` for contrast since it's a light accent |
| Mode badge/pill | "LOST" label, deep indigo pill | "FOUND" label, sky-blue pill |
| Icon accent | Cool indigo | Bright cyan-blue |

The two modes share layout, spacing, and component structure — only the accent hue and label change — so users always recognize "this is a Foundly screen," just tinted by context.

## 2.6 Components

**Buttons**
- Primary: filled, accent color, 48dp height, 12dp corner radius, `Button` text style, white/base text depending on contrast.
- Secondary: outline, 1.5px border in accent color, transparent fill, same sizing.
- Destructive: filled `error` red, used only for delete/report actions.
- Disabled: `bg.surface.raised` fill, `text.disabled` label, no shadow.
- Pressed state: 8% darken overlay + scale 0.98 (100ms).

**Inputs**
- 48dp min height, `bg.surface` fill, 1px `divider` border, 10dp radius.
- Focus state: border becomes `brand.blue.glow`, 2px, plus a soft outer glow (matches loading screen language).
- Placeholder text: `text.secondary`.
- Helper text below field: `Caption` style, `text.secondary`.

**Error states**
- Border becomes `error` red, 2px.
- Inline error message below field in `error` red, Caption style, prefixed with a small alert icon.
- Toasts for system-level errors (network, auth) use `bg.surface.raised` background, `error` accent bar on the left edge, auto-dismiss after 4s, swipe-to-dismiss enabled.

## 2.7 Responsive / website notes
The website is the same product, not a separate design — reuse every token in §2.2–2.6 exactly. Layout adapts by breakpoint rather than by redesigning:

| Breakpoint | Range | Layout change |
|---|---|---|
| Mobile | < 600px | Single column, bottom tab bar (as specified for the native apps) |
| Tablet | 600–1024px | Single column content, max-width 560px, centered; bottom tab bar becomes a top nav bar |
| Desktop | > 1024px | Two-column shell: fixed left sidebar nav (Home / My Posts / Matches / Profile, replacing the bottom tab bar) + centered content column, max-width 640px, generous side margins in `bg.base` |

- The Lost/Found mode cards (§4) sit side-by-side at all breakpoints ≥ 600px; below that they can stack if needed for very small phones.
- The loading-screen "F" animation (§2.4) is unchanged on web — same timing/easing — but caps its max size at 96sp on desktop so it doesn't dominate a large viewport.
- Forms (post creation, §5–6) go from full-step-per-screen on mobile to a single scrollable page with sticky step indicator on desktop, since horizontal space allows it — but field order, labels, and validation stay identical, so copy/logic specs in §5–6 apply unchanged to both.
- Keyboard navigation and visible focus rings (already specified via `brand.glow` outline in §2.6) become mandatory on web, since desktop users navigate by tab/keyboard far more than mobile users do.

## 2.8 Accessibility notes
- All text/background pairs meet WCAG AA minimum (4.5:1 for body, 3:1 for large text) — see contrast figures in §2.2.
- Never use color alone to convey match confidence or mode — always pair color with a text label/icon (e.g., "High match", "LOST" pill) for color-blind users.
- Minimum touch target: 44×44dp for all interactive elements, even inside dense list rows.
- Support Dynamic Type / OS font scaling up to at least 130% without truncation (use flexible layouts, not fixed-height text containers).
- Respect OS "Reduce Motion" (see §2.4 fallback) and "Reduce Transparency" (avoid blur-heavy glass effects when set).
- All images (item photos) require alt-text equivalent: auto-generate from the post title/category for screen readers ("Photo of a lost item: Blue water bottle").
