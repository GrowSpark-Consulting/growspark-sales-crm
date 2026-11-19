# Grow Spark Workspace

One visual language for the three Grow Spark business apps — **Sales & CRM**, **Project Management** and **HR & People** — so they look and feel like one product family. Calm, warm and readable: black and white at the core, earthy moss and clay for colour, and nothing that tires the eyes over an eight-hour workday.

This file is the source of truth. If a screen needs something that isn't here, ask before inventing it, and add it here once agreed.

---

## 1. Principles

1. **Easy on the eyes, all day.** No pure white (#FFF) backgrounds and no pure black (#000) text. Warm off-white `bg`/`surface` and warm near-black `ink` reduce glare and harsh contrast while still passing WCAG AA by a wide margin. Every product ships a **dark theme** too.
2. **Colour means something.** Most of the screen is neutral. Colour is used for actions (`primary`), status (`success`, `warning`, `danger`, `info`) and a few brand moments (`accent`). If everything is coloured, nothing stands out.
3. **One family, three products.** Same sidebar, same tables, same buttons, same status colours. Products differ only by the small coloured chip in the sidebar header.
4. **Data first.** These are working tools. Prefer clear tables, readable numbers and generous row height over decoration.

## 2. Colour

### The palette

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Canvas | `bg` | #F5F2EC | #1A1917 | App background |
| Surface | `surface` | #FCFAF6 | #22201D | Cards, tables, inputs, modals |
| Sunken | `surface-sunken` | #EEEAE2 | #151412 | Table headers, read-only fields |
| Sidebar | `sidebar` | #26231F | #121110 | Navigation rail (dark in both themes) |
| Text | `ink` | #211E1A | #ECE7DE | Primary text |
| Muted text | `ink-muted` | #5E574D | #ABA397 | Secondary text, placeholders |
| Primary (moss) | `primary` | #4A5A36 | #A9B98F | Primary buttons, links, active states |
| Accent (clay) | `accent` | #9A5034 | #DA8E6B | Brand moments only |
| Success | `success` | #3D6B48 | #8EC29B | Won, done, approved |
| Warning (ochre) | `warning` | #855F12 | #D8AF5E | Due soon, pending |
| Danger (brick) | `danger` | #A13A2C | #E68D7F | Overdue, lost, errors, delete |
| Info (slate) | `info` | #3B5E71 | #8FB4C8 | Notices, in review |

Each status colour has a `-soft` partner for badge and alert backgrounds. The full list, with a usage note on every token, is in the **Colors** tab.

### Why these colours

- **Moss green as primary** instead of the usual bright blue: green is among the most restful hues for the eye, and a muted moss reads as "go / confirm" without glowing on screen.
- **Clay (terracotta) as accent** is the "spark" — warm and human, used sparingly so it keeps meaning.
- **Ochre, brick and slate** replace the usual traffic-light yellow, red and blue. They're less saturated, so status badges don't shout across a table full of them.
- **Contrast is checked, not guessed:** `ink` on `surface` is 15.9:1, `ink-muted` is ≥5.9:1 on every surface, and every status colour is ≥4.5:1 on its soft background, in both themes. Input borders (`line-strong`) are ≥3:1, as WCAG requires for controls.

### Rules

- Text goes on `bg`, `surface` or `surface-sunken` in `ink` or `ink-muted`. On a `primary` fill, use `on-primary`. On the sidebar, use `on-sidebar` / `on-sidebar-muted`.
- Never put coloured text on another coloured fill, except a status colour on its own `-soft` background.
- Status always comes with a word or an icon, never colour alone (about 1 in 12 men has some colour-vision deficiency).
- `accent` never appears on buttons. Use it for the logo chip, "New" badges, onboarding highlights, and at most one hero number on a dashboard.
- Charts use `data-1` … `data-6`, in that order. In light theme, use `data-4` (ochre) and `data-6` (sage) as bar/area fills, not thin lines.
- Product colours (`product-sales`, `product-projects`, `product-people`) appear **only** on the sidebar header chip.

### Light and dark theme

Light is the default. Offer a toggle in the user menu (Light / Dark / System) and remember the choice per user. Set the theme on the root element: `<html data-theme="light">` or `data-theme="dark"`. All tokens switch automatically — never hard-code a hex value in a component.

## 3. Typography

**Inter** for everything, with **JetBrains Mono** for IDs and codes. Both are free Google Fonts, built for screens, and fall back cleanly to Segoe UI / Roboto / Arial if they fail to load.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 36 | 600 | Dashboard hero numbers, welcome title |
| `h1` | 22 / 30 | 600 | Page title |
| `h2` | 18 / 26 | 600 | Section and card titles |
| `h3` | 15 / 22 | 600 | Modal titles, form groups |
| `body` | 14 / 22 | 400 | Default text |
| `body-strong` | 14 / 22 | 500 | Names, emphasised values |
| `label` | 13 / 18 | 500 | Form labels, table headers, tabs |
| `small` | 13 / 20 | 400 | Helper text, timestamps |
| `caption` | 12 / 16 | 500 | Badges, sidebar headings — the minimum size |
| `mono` | 13 / 20 | 400 | EMP-00412, INV-2026-118 |

- Only three weights: 400, 500, 600. No bold 700, no light 300 (thin text strains the eyes).
- Line height ~1.5 for reading text; paragraphs max ~72 characters wide.
- Numbers in tables and KPIs use tabular figures: `font-variant-numeric: tabular-nums` (class `gs-num`).
- Sentence case everywhere ("Add employee"). No ALL CAPS except 12px sidebar headings.
- Money: Indian grouping — ₹ 4,82,000; short form ₹ 48.2 L / ₹ 1.2 Cr. Dates: 19 Nov 2026. Time: 2:30 PM.

## 4. Spacing, radius, elevation

- **4px grid.** Use only `space-1` (4) … `space-12` (48). Common: 8 between controls, 16 between fields, 24 card padding and page gutter, 32 between sections.
- **Radius:** `radius-sm` 4 (badges), `radius-md` 6 (buttons, inputs), `radius-lg` 10 (cards, modals), `radius-full` (avatars, pills).
- **Elevation:** borders first, shadows second. Cards = 1px `line` + `shadow-sm`. Menus/popovers = `shadow-md`. Modals/drawers = `shadow-lg` over a scrim of `ink` at 40% opacity.
- **Sizes:** controls 36px (`control-md`), 30px in dense areas, 44px on login and mobile. Table rows 44px. Top bar 56px. Sidebar 240px (64px collapsed).

## 5. App layout (same in all three products)

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Top bar 56px: page title (h1) · search · bell · avatar
│  Sidebar   ├──────────────────────────────────────────────┤
│  240px     │  Content on `bg`, 24px padding, max 1440px    │
│  `sidebar` │   ┌ Card ─────────┐ ┌ Card ─────────┐         │
│            │   └───────────────┘ └───────────────┘         │
└────────────┴──────────────────────────────────────────────┘
```

- Record detail opens in a **right-side drawer** (480–640px, `shadow-lg`) so the list stays visible; full page only for complex records.
- Breakpoints: ≥1280 full layout · 1024–1279 sidebar collapses to icons · <1024 sidebar becomes an overlay menu.
- Every list page has the same toolbar order: search · filters · (spacer) · secondary actions · primary action.

## 6. Iconography

[Lucide](https://lucide.dev) icons (free, consistent stroke): 18px (`icon-md`) with 1.75 stroke in UI, 16px inside small buttons and badges, 24px only in empty states. Icons take the text colour (`currentColor`). Don't mix icon sets.

## 7. Motion

Subtle and quick: 120ms for hovers and colour changes, 200ms for drawers, dropdowns and modals, `ease-out` when entering. No bouncing or looping animation. Respect `prefers-reduced-motion` by turning transitions off.

## 8. Eye-comfort checklist

- [ ] No `#FFFFFF` page backgrounds and no `#000000` text anywhere.
- [ ] Body text 14px minimum; nothing under 12px.
- [ ] Every text/background pair uses the token pairs above (all ≥4.5:1).
- [ ] Dark theme works on every screen.
- [ ] Status uses word + colour, not colour alone.
- [ ] No large areas of saturated colour; colour fills stay under ~10% of a screen.
- [ ] Visible focus ring on every interactive element (`focus-ring`, 2px, 2px offset).
- [ ] Respects `prefers-reduced-motion`.

## 9. Voice and UI copy

Plain, short and helpful. Verb-first buttons ("Save changes", "Approve leave"). Error messages say what to do next ("Enter a 10-digit mobile number"). No exclamation marks, no jargon, no blame. Empty states explain what the page is for and offer one action.

## 10. For developers — how to use this system

1. **Tokens are CSS variables.** Load `project/tokens.css` (generated from `tokens.json`; download from the Files view) once in your app's global stylesheet. It defines every `--token` for `:root`/`[data-theme="light"]` and `[data-theme="dark"]`, plus `--font-sans` and `--font-mono`.
2. **Never hard-code values.** Write `color: var(--ink)`, `padding: var(--space-4)`, `border-radius: var(--radius-md)` — not hex codes or pixel numbers.
3. **Reference styles:** `components/bundle.css` contains working CSS for every component shown in the Components tab (prefix `gs-`). Copy it, or re-implement the same look in your framework.
4. **Tailwind users** — map the tokens instead of using Tailwind's default palette:

```js
// tailwind.config.js
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors: {
      transparent: 'transparent',
      bg: 'var(--bg)', surface: 'var(--surface)', sunken: 'var(--surface-sunken)', hover: 'var(--surface-hover)',
      sidebar: 'var(--sidebar)', line: 'var(--line)', 'line-strong': 'var(--line-strong)',
      ink: 'var(--ink)', muted: 'var(--ink-muted)',
      primary: { DEFAULT: 'var(--primary)', hover: 'var(--primary-hover)', soft: 'var(--primary-soft)', on: 'var(--on-primary)' },
      accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)' },
      success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
      warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
      danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
      info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
    },
    fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
    borderRadius: { none: '0', sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', full: 'var(--radius-full)' },
    boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)', none: 'none' },
  },
};
```

5. **Component libraries** (MUI, Ant Design, shadcn/ui, Chakra): set their theme to these tokens rather than shipping their default blue. All three products should use the **same** library if possible.
6. **Shared package (recommended):** put `tokens.css`, the Tailwind preset and shared components (Button, Field, Badge, Table, Sidebar) in one shared folder or npm package that all three apps import, so a colour change happens once.

Anything missing from this system (date picker, charts, kanban card, file upload…) — build it from these tokens, then send it back so it's added here for the other two teams.
