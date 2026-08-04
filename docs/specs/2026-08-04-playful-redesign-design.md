# Cashly — playful app redesign

Date: 2026-08-04
Status: approved design, ready for planning

## Problem

The current design language, documented at length in `app/globals.css:87-122`, is
internally consistent and deliberately restrained: warm "ink and paper" neutrals,
no third brand hue, and a rule that colour is spent only where it carries meaning.

It works, and it reads as a corporate dashboard. The user wants the product to
look and feel like a consumer finance app.

The restraint rule is the root cause, not the palette values. Repalettng without
replacing the rule would drift straight back to muted, because every future
decision would still be resolved by "is this colour earning its place?" The rule
is therefore replaced: **colour carries identity, not just meaning.**

Three secondary causes, each verified in the code:

1. **Control density.** Buttons default to `h-8` (32px) with `h-6`/`h-7` variants
   in active use (`components/ui/button.tsx:24-34`). References use 48-56px.
   Nothing reads as an app while the controls are toolbar-sized.
2. **Homeopathic category colour.** A full per-category colour system already
   exists and is rendered at 5% opacity (`lib/palette.ts:57-62`).
3. **Undifferentiated numerals.** Money is set at one weight and one size
   throughout. The references make the balance the loudest object on screen.

## Constraints

- **No migrations.** Category and account colours are stored as literal hex on
  user rows. Render treatment can change freely; stored values cannot be
  repaletted without a migration the user must push manually. The design must
  work with the existing 16 swatches.
- **Contrast.** Stored swatches sit in a luminance band of 0.126-0.300, giving
  ~4:1 against white. Usable behind emoji and single glyphs, **not** behind small
  text.
- **Both themes stay first-class.** Light is the default and must not become an
  inverted afterthought.
- **`prefers-reduced-motion` is honoured** for every animation added.
- **i18n intact.** en/es via next-intl; no hardcoded copy.
- **Figure masking intact.** `useFigureMask` must keep working through any new
  money-rendering component.

## Decisions

| Question | Decision |
|---|---|
| Palette scope | New cool neutrals + vivid brand + pervasive category colour |
| Desktop | App-like centred column, richer sidebar rail (not a phone frame) |
| Bespoke surfaces | 8: shell, overview, transactions, budgets, accounts, insights, login, marketing |
| Hero gradient | Deep navy → violet (`#141A3D → #4326C9`), premium reading |
| Playfulness | Big numerals, colour tiles, illustrations, celebration + richer motion |

Because the hero reads premium rather than toy, playfulness is carried
disproportionately by the category tiles, the numerals and the motion layer.
Those three must not be scaled back during implementation without revisiting
this decision.

## Foundation

### Neutrals — warm to cool

The ivory cast (OKLCH h 70-85) is the largest single contributor to the corporate
read. The light page stops being pure white so that white cards separate on tone
rather than on a four-layer shadow.

| Token | Light now | Light new | Dark now | Dark new |
|---|---|---|---|---|
| `background` | `#ffffff` | `#f5f6fb` | `#090807` | `#0a0a0f` |
| `card` | `#ffffff` | `#ffffff` | `#191714` | `#16161f` |
| `foreground` | `#211d1a` | `#14141c` | `#dfdad1` | `#e8e8f0` |
| `muted-foreground` | `#6d6862` | `#6b6b7b` | `#96928b` | `#9494a6` |

The dark surface ladder documented at `app/globals.css:216-225` still applies:
`background < card < muted < popover < accent < secondary < border < input`, no
two rungs sharing a value. Re-verify after retinting.

### Brand

`--brand`: `#2f55ab` → `#6C4EF5` (dark `#8B72FF`). Both clear 5:1 against white,
so unlike the outgoing blue it works as fill *and* as link text.

Usage widens: brand now owns identity — hero, primary actions, active nav,
brand moments — not only interactive state.

### Hero surface

`--brand-panel` (currently ink in both themes) becomes `--hero`: a diagonal
gradient `#141A3D → #4326C9`, identical in both themes, always white-on. It is
the anchor object on the dashboard, login and marketing pages.

The rename is contained: `--brand-panel` and `--brand-panel-foreground` are
consumed in exactly one file, `app/login/page.tsx:26-46`.

### Semantics

Re-tuned to sit with cooler neutrals and read app-bright rather than
ledger-sober: success `#317e42 → #12B76A`, destructive `#ba362e → #F04438`,
warning `#966c1e → #F79009`. Each needs re-validation against both card surfaces.

### Radius

`--radius`: `0.8rem → 1.25rem`. The existing derived scale
(`app/globals.css:78-84`) carries the change through. Primary buttons go fully
round.

### Type

No new fonts. Plus Jakarta Sans is a variable font (200-800) already loaded.

- **Hero and stat numerals** — Jakarta 800, tabular figures, tight tracking.
- **Ledger rows** — Inter tabular, unchanged. Scanning beats character here.

This finally gives the two faces distinct jobs instead of near-duplicate ones.

### Elevation

The four-layer light shadow exists to separate white on white. On a tinted page
tone does that work, so it collapses to two layers, and cards drop
`ring-1 ring-foreground/10` — the hairline is a significant part of what reads as
"data table".

## Component language

### New primitives

**`MoneyDisplay`** — the headline number. `MaskedMoney` returns a flat string
(`components/figure-mask/masked-money.tsx:19`) and so cannot render split
integer/cents. The new component splits on the **locale** decimal separator,
renders the integer at full size in Jakarta 800 and the cents at 60% size and
muted, and routes through the same `useFigureMask` hook so masking still works.
Sizes: `hero | stat | inline`.

Edge cases it must handle: currencies with no decimal part, negative and signed
values, the existing `compact` option, and masked state (which renders the
existing mask output without splitting).

**`ColorTile`** — replaces four duplicated copies of the same pattern
(`components/transactions/transaction-row.tsx:87-95`,
`components/budgets/budget-grid.tsx:246-254` and `:328-336`,
`components/accounts/account-card.tsx:33-43`). Takes `{color, emoji, name, icon}`
and renders a filled rounded-square tile. Fill goes from 5%/16% to **100%** with
the glyph on top. Falls back to the initial letter, then to a type icon, exactly
as the current call sites do. Sizes: `sm 36px | md 44px | lg 56px`.

**`StatPill`** — the `▲ +8%` chip. Rounded-full, tinted success/destructive/muted,
tabular figures. No equivalent exists today; deltas are currently plain text.

**`HeroCard`** — the gradient slab, with slots for label, `MoneyDisplay`, a delta
pill and an action row.

### Changed primitives

**`Button`** — size scale shifts up one notch: `default h-8→h-10`, `lg h-9→h-12`,
`sm h-7→h-8`, `xs h-6→h-7`, with icon sizes following. New `brand` variant:
violet fill, `rounded-full`, white text.

This is the highest-risk change in the redesign. It moves every toolbar in the
app, including pages outside the bespoke list, and needs a visual pass on the
dense ones (transactions header, budget grid actions, account detail actions).

**`Card`** — `rounded-xl → rounded-2xl`, ring removed, two-layer shadow.

**`Badge`** — pill-shaped by default. The four hand-rolled inline badges in
`transaction-row.tsx:101-124` swap over to it.

`dialog`, `select`, `tabs`, `input`, `progress`, `switch` and `separator` inherit
tokens and radius with no structural change.

## Surfaces

### Shell (`components/shell/`)

- Sidebar keeps its structure; active nav becomes a filled violet pill rather
  than a tint, and the rail takes its own surface instead of near-matching the
  page.
- Bottom nav lifts off the edge into a floating rounded bar with a filled pill
  behind the active icon. Must preserve `env(safe-area-inset-bottom)` handling
  and the equal-column grid that stops long Spanish labels reflowing
  (`components/shell/bottom-nav.tsx:12-17`).
- Quick-add FAB goes violet, sized to 60px. The main content bottom padding
  (`app-shell.tsx:45`) is tuned to the current FAB size and must be re-derived.

### Overview (`app/(app)/page.tsx`)

Reorganises around the hero. `HeroCard` replaces the flat net-worth card
(`:93-112`): gradient, `MoneyDisplay` at hero size, `StatPill` delta, and
white pill actions on the gradient. The three stat cards become tinted rather
than white, each carrying a `ColorTile`. Upcoming rows take `ColorTile` and pill
badges. The empty state (`:38-82`) gets the same treatment plus illustration.

### Transactions (`components/transactions/`)

44px filled `ColorTile` with emoji, two-line title/merchant, inline badges
swapped to pill `Badge`, sticky date-pill section headers. Amounts stay Inter
tabular.

### Budgets (`components/budgets/budget-grid.tsx`)

The largest visual jump. The 5% wash becomes a saturated tile: filled colour,
emoji, `MoneyDisplay`, percentage as `StatPill`, ring-style progress.

### Accounts (`components/accounts/`)

Credit cards render as card-shaped surfaces: gradient derived from the account's
stored colour, wide aspect, masked number, mark in the top-right. Depository and
asset accounts keep the current card shape with the new tile and `MoneyDisplay`.
Loan and credit-card bodies keep their existing data logic untouched.

### Insights (`components/insights/`)

`--chart-*` series repaletted with violet at slot 1, re-validated for both
surfaces under the existing criteria (lightness band, chroma floor,
adjacent-pair separation under CVD simulation, 3:1 against surface). The donut
gains thick rounded arcs with the total in the centre. Structure unchanged.

Note `lib/insights/queries.ts:98` falls back to the chart palette by index when a
category has no stored colour; that path stays.

### Login and marketing (`app/login/`, `components/marketing/`)

Gradient panel, flat SVG character illustration, oversized headline, round arrow
CTA.

### Illustrations

Hand-built flat SVGs in the brand palette, inline as components. Scope: login
hero, overview empty state, accounts empty state. Deliberately simple geometric
figures — not editorial illustration. Each needs a theme-correct treatment and
`aria-hidden`, since they are decorative.

## Motion

Documented `MOTION_INTENSITY` rises from 5/10 to ~7/10 (`app/globals.css:326-337`
needs its note updated to match).

- Hero and stat figures **count up** on mount. Masked figures skip it.
- Presses become springier: `scale .995 → .96`.
- Value bars gain a slight overshoot.
- Goal completion fires a burst plus the existing `success.wav`
  (`components/sound/sound-provider.tsx:31`).

Every addition sits inside the existing `prefers-reduced-motion: no-preference`
gate, and the `reduce` block (`app/globals.css:533-557`) is extended to collapse
each new animation to its end state. Count-up under `reduce` renders the final
value immediately.

## Risks

1. **Button size shift** moves layouts app-wide, including inherit-only pages.
   Blast radius: 29 files import `ui/button`, 17 of them pass an explicit `size`.
   Mitigation: explicit visual pass over every route, not just bespoke ones.
2. **Stored colours cannot be repaletted.** Existing categories render in the
   current, slightly muted hues. Acceptable as tile fills. A brightening
   migration can be written later for the user to push.
3. **Contrast on filled tiles** — emoji and single glyphs only, never small text.
4. **Dark surface ladder** can silently collapse when retinting; two rungs
   sharing a value made a tab track vanish inside a dialog once already.
   Re-verify each rung against its neighbours, not against the background.
5. **Hero reads premium, not toy.** If the result still feels too corporate, the
   correction is more saturation in tiles/numerals/motion, not a louder hero.

## Out of scope

Settings, Help, Goals, Subscriptions, Privacy and Terms receive tokens and
components only, with no bespoke layout work. Schema changes. New fonts. New
dependencies. Any change to financial calculation logic.

## Success criteria

- Every bespoke surface renders correctly in light and dark, en and es, at mobile
  and desktop widths.
- No route scrolls horizontally on mobile.
- Figure masking works through `MoneyDisplay` everywhere money renders.
- `prefers-reduced-motion: reduce` leaves no element stranded at `opacity: 0`.
- Chart palette passes the existing validation criteria on both surfaces.
- `npm run lint`, `npm run build` and `npm test` pass.
- The four duplicated tile blocks are replaced by one `ColorTile`.
