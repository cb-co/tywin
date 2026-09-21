---
name: Cigua (Papel Moneda)
description: Money's own print language. Your statement, re-issued as a checked, sorted banknote-and-ledger document, on cool lilac security paper in intaglio ink.
colors:
  note: "#4a1f8c"
  note-deep: "#2b1157"
  note-line: "#a488ec"
  note-ink: "#f8f5ff"
  note-ink-soft: "#d9ccfa"
  peso: "#e0661c"
  peso-line: "#ffb27a"
  peso-ink: "#1f0e22"
  peso-ink-soft: "#4a2410"
  paper: "#eeebf5"
  paper-2: "#ffffff"
  paper-line: "#cdc3e3"
  ink: "#1b1530"
  ink-soft: "#544a6c"
  rule: "#1b1530"
  teal: "#0e6e60"
  red: "#b3302a"
  paper-night: "#15111f"
  paper-2-night: "#1d1829"
  paper-line-night: "#3b3252"
  ink-night: "#efebf8"
  ink-soft-night: "#b2a8c9"
  teal-night: "#4fc2ae"
  red-night: "#f0766c"
typography:
  legend:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "0"
rounded:
  sheet: "4px"
  control-sm: "3px"
  note: "6px"
spacing:
  card: "16px"
  card-sm: "12px"
components:
  button-primary:
    backgroundColor: "{colors.note}"
    textColor: "{colors.note-ink}"
    rounded: "{rounded.sheet}"
    height: "40px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.note-deep}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    height: "40px"
  sheet:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "16px 0"
  note-violet:
    backgroundColor: "{colors.note}"
    textColor: "{colors.note-ink}"
    rounded: "{rounded.note}"
    padding: "24px"
  note-peso:
    backgroundColor: "{colors.peso}"
    textColor: "{colors.peso-ink}"
    rounded: "{rounded.note}"
    padding: "24px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    height: "32px"
---

# Design System: Cigua (Papel Moneda)

## Overview

**Creative North Star: "Your statement, re-issued"**

Cigua is printed like a Dominican banknote and kept like a checked ledger. Every screen is a sheet of cool lilac security paper (never cream, never sepia) printed in intaglio ink. The one figure a screen exists to answer is printed as a small banknote, the *note*, the way a bill prints its denomination. Everything else is ledger: rows under hairline rules, tabular amounts, one face. It refuses the category default of a gradient hero slab over a grid of white rounded cards with coloured icon discs.

The register differs by surface. The public pages (`/`, `/login`) persuade: a full-bleed violet note in a microprint frame, a statement sheet printing into a ledger. The signed-in app operates: glance, import, fix. There the brand lives in precise details (type, rules, stamps, one note per screen), never in decoration that would slow a 30-second session on a phone in daylight. `/help` and legal are Read mode. Light is the default (paper by day); dark is first-class (paper goes ink-dark).

Product truth is rendered as printed fact, not marketing: statement-anchored balances, locked FX rates, checksums that must match ("cuadra"), cuotas, quincena periods. State is ink density, rule weight or a glyph, never colour alone.

**Key Characteristics:**
- Two things invert with the theme: paper and ink. The note fields (violet, peso) never do.
- At most one note per screen; guilloche, microprint and serials live only on notes, the splash and empty states.
- One family, Archivo, on its width axis: expanded cut for legends and denomination numerals, normal cut for body.
- Engraved, not rounded: 3-6px corners, hairline frames, no drop shadows on paper.
- User colour is data and prints as ink stamps; it is never assumed to be a shipped swatch and text is never set in it.
- All ornament is generated (canvas or SVG line work), never raster or clip-art.

## Colors

A cool-violet-and-orange banknote palette on lilac paper, with teal and red as the only status colours. Tokens live in `design/tokens.json` (source of truth, shared with the Expo app) and `app/globals.css`; `design/tokens.test.ts` fails the build if they drift. Night values are the `-night` entries in the frontmatter.

### Primary
- **Note Violet** (`note`): the note field, the primary action (a primary button is a small piece of note), the FAB seal, the splash. `--primary` is note violet in both themes.
- **Deep Note Violet** (`note-deep`): primary hover, the splash-adjacent shadow, the darker leg of the flat legacy `--hero`.
- **Violet Line** (`note-line`): microprint, guilloche and edge strokes on violet; in dark it is also the ring and the badge/brand ink, and the edge that keeps a primary button above 3:1 on dark paper.

### Secondary
- **Peso Orange** (`peso`): the second note field, used for the Overview Disponible note and the period total. Amber attention (`--warning`, `--gold`) is the peso family, darkened in light (#a14a0f) and `peso-line` in dark.
- **Peso Line** (`peso-line`): serial numbers and line work on orange.

### Neutral
- **Security Paper** (`paper` / `paper-2`): page background and raised sheet (`--background`, `--card`). Night: `paper-night`, `paper-2-night`.
- **Paper Line** (`paper-line`): hairline frame, ruled separators, toast and dialog edge (`--border`).
- **Ink** (`ink`) and **Soft Ink** (`ink-soft`): text, primary rules, active state; soft ink is underprint (secondary text, inactive nav, projected figures).
- **Rule** (`rule`): equals ink; the heavy rule on the shell (sidebar edge, mobile header, bottom band).
- **Note ink** (`note-ink`, `note-ink-soft`) and **peso ink** (`peso-ink`, `peso-ink-soft`): text on the two fields. Note ink and peso-ink clear 4.5:1 at full opacity; peso-ink-soft does not (`#4a2410` on `--peso` `#e0661c` is ~3.93:1) — a known pre-existing gap, out of scope here. `MoneyDisplay` draws cents in `currentColor` at 0.6 opacity, which dims peso-ink (the peso `Note`'s own text colour, not peso-ink-soft, which `MoneyDisplay` never uses) below 4.5:1 on the orange field; the peso `Note` lifts cents to 0.9 opacity (`components/papel/note.tsx`, tone-scoped, violet is untouched) so real figures stay compliant.
- **Matches Teal** (`teal`) and **Error Red** (`red`): in/out, cuadra/no cuadra, over budget. Always paired with a glyph or rule.

### Named Rules
**The Two Inverters Rule.** Only paper and ink change with the theme. A note never goes dark, and `--primary` stays violet in both themes.
**The Stored Hex Rule.** Category and account colour is user data (`lib/palette.ts`). Nothing in CSS may assume one of the sixteen swatches, and text is never set in a user hex; it prints as a stamp.
**The Not Colour Alone Rule.** State reads through ink density, rule weight or a glyph first; teal and red only reinforce.
**The Ladder Rule.** In dark, surfaces climb one unbroken ladder (background < card < muted < popover < accent < secondary < border < input); no two rungs share a value.

## Typography

**Display, Body and Label Font:** Archivo, variable on the `wdth` axis (`app/fonts.ts`, `--font-archivo`), with `system-ui, sans-serif`. `--font-sans`, `--font-serif` and `--font-display` all resolve to it.

**Character:** One family cut two ways, like an engraver's plate: an expanded cut for the printed legend and denomination, a normal cut for reading. No second family, no second numeral system.

### Hierarchy
- **Legend** (`.legend`: 700, `font-stretch: 125%`, uppercase, 0.12em tracking, ~11px in a note label): note labels, specimen captions, section legends. (The wordmark is not legend type; see The Drawn Wordmark Exception.)
- **Figure** (`.figure`: tabular, lining numerals, 0 tracking, weight inherited): every amount, at any size. `MoneyDisplay` sets its own size steps (hero, feature, stat, inline) on top of it.
- **Body** (400, 14px / `text-sm`): ledger titles, fields, copy. Row subtitles at 12px.
- **Denomination numerals:** the Disponible/net-worth figure in expanded Archivo. Note does not size its figure; each call site sets it, and it scales down at 360px and eight digits rather than wrapping or clipping.

### Named Rules
**The One Face Rule.** Archivo only, app-wide. Emphasis comes from the width axis and weight, not a second family.
**The Drawn Wordmark Exception.** The one place Archivo does not appear is the brand wordmark: a soft, rounded, lowercase "cigua" drawn as monoline round-cap strokes (`lib/papel/wordmark.tsx`, `Wordmark` in `components/brand/logo.tsx`). It is outlined geometry, not a second font: nothing loads, it takes `currentColor` (a literal ink in `next/og`), and it scales in `em`. Like the Seal it is a drawn mark, not typeset copy; never set body or UI text in its style.
**The Tabular Rule.** Every amount uses `.figure`; digits must align in ledger columns at 11-12px.

## Layout

Sheets on a paper page. A signed-in screen is a column of ruled sections: at most one note, then ledger blocks separated by hairlines, not a grid of cards.

Desktop shell: a 256px paper sidebar (heavy right rule, vertical microprint strip down the edge, engraved seal and wordmark, nav, then account row with figure-mask and theme toggles); content scrolls in its own pane with 24px padding (48px, then 64px bottom clearance at md/lg). Mobile shell: a 56px sticky paper header (mark, figure-mask, theme, language, Ask, Settings), and a ruled bottom band of five equal `1fr` cells (Activity is a sheet cell) on the safe area, with the round violet FAB above it. Main content clears both (9.5rem plus safe-area inset). `min-w-0` on flex parents and label truncation at 360px Spanish are load-bearing.

Density: Operate is tight and glance-first; ledger rows are `px-4 py-3`. Public pages breathe: full-bleed notes, one primary CTA per band.

## Elevation & Depth

Flat by default. Paper has no drop shadow; a hairline frame does the separating (`--shadow-card: 0 0 0 1px var(--paper-line)`, hover `0 0 0 1px var(--ink-soft)`). Depth is otherwise carried by the ink: heavy rule versus hairline, full ink versus underprint, and a stepped surface ladder in dark.

The one shadow is `--shadow-float` (`0 6px 14px -6px` violet/black), used only by the round `brand` button (the FAB seal). Popovers, dialogs and toasts are paper slips with a perforated top edge (`.perforated-top`, a CSS mask), not floating cards.

### Named Rules
**The Hairline Rule.** Separate with a frame or rule, never a blur. The single exception is the FAB seal.

### Motion

Motion explains hierarchy and marks moments the person caused; it never fires on passive render or navigation and only animates `transform` and `opacity`. Tokens: `--ease-press` / `--ease-out-soft` `cubic-bezier(0.16, 1, 0.3, 1)`, `--dur-fast` 160ms, `--dur-base` 380ms, `--dur-slow` 620ms. Entry reveals `.rise`, `.fade-in`, `.scale-in` stagger by 55ms per `--i`. Every animation has an explicit end state under `prefers-reduced-motion: reduce` (the count-up reads the query in JavaScript). The success cue is a paper stamp sound; other cues are unchanged.

## Shapes

Engraved, not rounded: sheet, button and dialog corners are 4px, small controls and badges 3px, notes 6px. Circles are reserved for stamps, seals, switches and the FAB. `--radius` is 0.25rem and the shadcn radius scale derives from it. Frames are hairline; a note carries an inset 1px ring at ~30% opacity. Inputs are a baseline rule with the label above (no box), except Textarea, which keeps a 3px box.

## Components

Built in Phase 0 and in the code today.

### Papel primitives (`components/papel/`)

| Papel object | Replaces | Used for | Status |
| --- | --- | --- | --- |
| **Note** (violet or peso field, guilloche underprint, serial, inset ring) | `HeroCard`, gradient `--hero` | the one hero figure per screen | built (`note.tsx`); used by Overview (peso) and Accounts (violet) |
| **Card face** (drawn card: two-stop fill from the stored accent, clipped guilloche rosette, engraved name/number/network wordmark) | `PaymentCard`, `NetworkMark` | the marketing home page's two specimens and every in-app card (gallery, group tile, detail hero, the Accounts help mock) | built (`card-face.tsx`); the homepage face is the single source, `PaymentCard`/`NetworkMark` deleted (Phase 2) |
| **Sheet** (paper surface, hairline frame, 4px, no shadow) | `Card` | every grouped surface | built as the restyled `Card` (`ui/card.tsx`); no separate `Sheet` component |
| **Ledger row** (lead, title/subtitle, tabular amount, rule below) | card rows, `divide-y` cards | Overview, and now Accounts: the attention ledger, per-currency card lines, and the statements panel | built (`ledger-row.tsx`); used by Overview, Accounts, Transactions and Imports (Phase 3), and Budgets, Goals and Recurring (Phase 4), where it heads each `LedgerBlock` |
| **Stamp** (double ink ring + glyph/emoji/initial in the stored hex) | `ColorTile` | categories, accounts, merchants, the Accounts attention ledger's lead, and now Phase 3's ledger rows and the `CategoryRail` stamp picker | built (`stamp.tsx`, `lib/papel/ink.ts`); `ColorTile` down to 3 callers |
| **Proof mark** (engraved ring + check, cross or dot + label) | `StatPill`, success badges | "cuadra", "sin categoria", over-budget, and now Accounts: card utilisation flag, statement triage state, attention-ledger reason | built (`proof-mark.tsx`); `StatPill` at 0 callers |
| **Perforation strip** (cuota cells, solid when paid, dashed when not) | progress bars for cuotas and loans | Accounts: loan/cuota progress on the account tile and the detail hero | built (`perforation.tsx`); Accounts (Phase 2) uses it for cuotas and loans, and `GoalStrip` (Phase 4) builds its own 20-cell strip on the same idea |
| **Rule meter** (ruled scale with ink fill; red fill plus double rule when over) | `Progress`, `bar-fill` | budgets, goals, card utilisation | built (`rule-meter.tsx`); used by Overview and Budgets (`BudgetLine`); `near` prints a heavy 2px base rule |
| **Specimen frame** (dashed frame + "Ejemplo" legend) | help mocks, empty-state previews | `/help` mocks, empty states | built (`specimen-frame.tsx`); wraps the Overview, Accounts, Transactions (`LedgerMock`), Imports (`TriageMock`), Budgets (`BudgetsMock`, `BudgetGroupsMock`) and Recurring (`SubscriptionsMock`) help mocks, other help mocks not yet wrapped |

Also built: **Seal** (`seal.tsx`), the engraved Cigua mark (the palmchat, `lib/papel/bird.ts`, engraved in one line weight inside two rings on a note disc; `tone` note or ink). It takes a `rosette` prop, default off: the hairline guilloche ring and the bird's feather line only resolve from about 80px up and smear below, so nav, header and splash sizes leave it off. **Guilloche** (`guilloche.tsx`): canvas hypotrochoid rosettes and sine-wave fields in `currentColor`, cut in over ~1.8s, finished in one frame under reduced motion. **Microprint** and **Serial** (`microprint.tsx`, `ornament.module.css`): bilingual legend frame and corner serial, `aria-hidden`. `lib/papel/rosette.ts` also emits the rosette as a static SVG path for `next/og` icons.

Structural pending: `Sheet` may stay `Card`. Overview (Phase 1) is the first screen built on Note (peso), LedgerRow, RuleMeter and SpecimenFrame (its help mock). Accounts (Phase 2) is the first to build on Note (violet), Card face, Perforation and Proof mark for real card/loan data, and the first to reuse LedgerRow and SpecimenFrame outside Overview. Transactions and Imports (Phase 3) are the first screens to use `ProofMark`'s `lg` size (the triage `DoneStamp`, its first use) and the first to put a row's edit and delete controls in `LedgerRow`'s `trailing` slot (onboarding's parts.tsx passes its own `trailing` prop into `LedgerRow`'s `meta`, so this is the first use of the `trailing` slot itself). Budgets, Goals and Recurring (Phase 4) add `LedgerBlock`, `DoubleRule` and `SectionLegend` (below). Phase 5 adds `Plate` and `PlateDefs` (below); 

### Buttons
- **Shape:** 4px (`xs`/`sm` and icon-xs/sm 3px); 40px default height, 32px sm, 48px lg; 600 weight.
- **Primary:** note violet with near-white ink; hover note-deep; the focus outline takes the foreground ink (near-white would vanish on paper); in dark a `note-line` border holds the edge above 3:1.
- **Outline:** ink border, transparent; hover muted. **Secondary:** flat tinted fill. **Ghost / Link:** underprint until hover. **Destructive:** red outline, fills red on hover.
- **Brand:** round violet seal with `--shadow-float`, intended for the FAB (variant defined; FAB wiring not re-checked).
- **Press:** 1px translate; loading swaps a spinner in and sets `aria-busy`.

### Fields
Input: a 32px baseline rule (`--input`), no fill, 2px ink rule on focus, destructive rule when invalid. Select trigger: 3px box, popup items are ledger rows (hairline between, bold on focus). Switch: pill, primary when on, hairline edge when off. Label: 14px medium, `*` in destructive.

### Tabs, Badges, Progress
Tabs are a hairline baseline with a 2px ink rule and heavier weight on the active tab (no fill). Badges are 3px outlined text in current ink. Progress is the ruled-scale track with an ink fill (the same look as Rule meter); Tabs, Badge and Progress are reskinned but not yet given their final per-screen roles.

### Dialogs, Toasts
Paper slips: 4px, hairline border, popover fill, perforated top edge, ink 40% scrim. Sonner toasts wear the same slip with a hairline border and 4px corners.

### Navigation
Sidebar: text in ink; the active item prints full ink, semibold, with a 3px bar at the left edge; inactive is soft ink underprint. Bottom band: five equal cells, 10px labels, active adds a 3px top rule over the icon and semibold. Both keep `aria-current="page"`. Focus everywhere is one 2px `currentColor` outline offset 2px, set globally.

### Splash
Once per session, full-bleed note violet with a rosette guilloche behind the Seal and wordmark; held 700ms, fades 420ms; skipped on repeat visits and under reduced motion (a pre-paint script sets `.splash-skip`).

### Shipped and marketing-only
The public pages (`components/marketing/papel/`) consume the global tokens (their own token block is gone) and add page-only pieces: the statement specimen, proofs, the Disponible note with a quincena timeline, drawn cards and perforated cuota strips. The drawn card face on the home page is drawn by the shared `CardFace` primitive (Phase 2), the same component every in-app card now uses.

### Overview (Phase 1)
The signed-in Overview (`app/(app)/page.tsx`) is the cheque-stub composition. One peso `Note` (`available-hero.tsx`) carries the Disponible figure, the net-worth line and `QuincenaEdge` (`components/overview/quincena-edge.tsx`), a pay-period timeline engraved along the note's bottom edge: a `QNA yyyy-mm A|B` serial (`aria-hidden`), a today tick with an "HOY" caption clear of it, and, on a negative Disponible, the figure on a white inset with a flag `ProofMark`. A dashed rule perforates the note into `PeriodStub` ("Este período"), a ruled three-`LedgerRow` table for income, spent and budget used, the last driven by `RuleMeter` with an unclamped, worded over-budget flag past 100%. Below the stub sit a margin-note coach tip (`RecommendationCard`, restyled as marginalia, not a card), a baseline-rule `AskEntry`, and Upcoming as `LedgerRow`s with the due date as `meta`. The empty state swaps the peso note for a violet `EmptyOverviewNote` (import is the first action) plus `LedgerRow` starter links, so exactly one Note renders in either state. An `FxDegradedNotice`, when it shows, sits directly under the note. `/help#overview`'s `OverviewMock` (`components/help/mocks.tsx`) is built from the same primitives inside a `SpecimenFrame`, so the guide drifts with the screen instead of describing an old look.

### Accounts (Phase 2)
The Accounts list page (`app/(app)/accounts/page.tsx`) reads Attention First, top to bottom: an **attention ledger** (`components/accounts/attention-ledger.tsx`) of `LedgerRow`s flagging cards that are overdue, due within a week, or still carrying uncategorised statement lines, each with a flag `ProofMark` — the section renders nothing at all, not even a heading, when nothing needs a look, so a quiet month reads as calm rather than broken. Below it, one violet `Note` (`tone="violet"`) carries net worth (`MoneyDisplay size="hero"`), computed by the shared `netWorthTotal` (`lib/accounts/net-worth.ts`) so Overview and Accounts can never disagree about the figure, and skipped entirely on the empty-accounts state so at most one Note ever renders. The card gallery follows: every card face — solo cards (`account-card.tsx`), grouped cards (`card-group-tile.tsx`), and the account detail page's hero — is drawn by the shared `CardFace` (`components/papel/card-face.tsx`), fed by the card's own stored accent and its own typed name (not the cardholder's name; `PaymentCard` showed the cardholder, `CardFace` deliberately does not — the card is the issuer's object, and the name printed on it is the one the user gave the card). A card group's per-currency lines print as `LedgerRow`s under a double rule (a heavy `--rule` line over the existing hairline `divide-y`). Loan and cuota progress print as `Perforation` (`account-card.tsx`'s `LoanBody`, the detail page's loan hero) instead of a plain progress bar. On the detail page, the statements panel (`statements-panel.tsx`) is a `LedgerRow` list with a `ProofMark` per statement — `ok` when its newest import has nothing left to categorise, `flag` (linking to the triage screen) when it does — and the amortisation table and balance chart carry Papel's figure/legend tokens and an ink line on hairline axes respectively, with no new categorical chart colour (Phase 5's territory). `/help#accounts`'s `AccountsMock` is built from the same Note/LedgerRow/CardFace/Perforation/ProofMark primitives inside a `SpecimenFrame`.

### Transactions and Imports (Phase 3)
**Sign glyph.** `TransactionRow` prints the figure through `amountDisplay` (`lib/transactions/display.ts`): income `+` in `--teal`, expense `−` in ink, a payment no sign. A statement-sourced expense with a negative total is money in, so it prints `+` in teal with a refund `Mark`. The sign is text, so state never rides on colour alone. Each row is a `LedgerRow` led by a category `Stamp`, with the statement, refund, budget-exclusion and FX tags as inline `Mark`s (`components/transactions/mark.tsx`: engraved caps in a hairline frame, never a filled pill) and edit/delete in the `trailing` slot.

**Sticky date rules.** The ledger groups by month then day: `MonthLegend` is an engraved heading over a heavy `--rule`; `DateRule` is the day's engraved date over a full-width rule, sticky under the mobile header (`top-14`) and at the top on desktop, on the page background so rows never show through.

**Stamp rail.** `CategoryRail` is the compact category picker: a row of `Stamp`s with names, the chosen one `stamp-inked` (a heavier 3px ring) with a heavy underline, and a dashed-ring "more" stamp opening the full catalogue. It replaces the chip row, and `TriageList` reuses it.

**Paper-slip form.** The transaction form and Quick Add print as slips with a ruled type strip instead of a card of pills and inputs; the field set and behaviour are unchanged.

**Import sheet.** The statement import dialog reads the file as a ruled sheet: `sheetRows` (pure, in `lib/statements`) turns the parsed sections into the rows `StatementSheet` (`components/statements/statement-sheet.tsx`) prints as its own `ol`/`li` ruled grid (not `LedgerRow`), the real lines and nothing invented, with a "more lines" note past the cap.

**Triage sheet.** `TriageList` is one hairline sheet of ledger blocks: a `LedgerRow` head (merchant, lines, dates, total) over a `CategoryRail`, blocks divided by a heavy `--rule`. Finishing the last block prints `DoneStamp`, a `ProofMark tone="ok" size="lg"` tilted across the sheet; it animates (`stamp-down`, no overshoot) only on the transition into done, and arriving at an already-finished triage shows it still.

**No Note.** None of these screens carries a `Note`: they are read and edited repeatedly, and the one-note-per-screen rule is satisfied by having none. `/help#transactions` and `/help#imports` mocks (`LedgerMock`, `TriageMock`) are built from the same primitives inside a `SpecimenFrame`.

### Budgets, Goals and Recurring (Phase 4)
**Budgets note.** The budgets screen carries the one peso `Note` (`budget-note.tsx`): the period's budget total as the figure, with Used and Remaining as ruled lines under it. Overspend is the minus sign on Remaining, never a red figure. With no category rows there is no total to print, so the Note is skipped and the screen carries none: one Note per screen, at most.

**BudgetLine.** Categories and groups print through one component, `BudgetLine` (`components/budgets/budget-line.tsx`): a `LedgerBlock` whose head is a `LedgerRow` (stamp, name, "used of budget", tabular used amount, share) over a body of ruled `RuleMeter`, status mark, the amount editable in place and the edit/delete controls. The status vocabulary: within is nothing at all; approaching is an engraved `Mark` and a heavy 2px meter rule (`RuleMeter near`); over is a flag `ProofMark`, a red fill and a double-rule end cap. An unbudgeted overspend is over too: `meterArgs` hands the meter an infinite `used`, so it fills red with the cap instead of printing a plain ink bar. Lines measure about 131px, 157px with the prorated line.

**Goals.** `GoalStrip` (`components/goals/goal-strip.tsx`) is a 20-cell perforated strip: solid cells are backed, hatched cells are borrowed back, dashed cells remain. It is ink only; the goal's colour lives on its `Stamp`, not the strip. The arrival burst is kept: a goal that completes in view still celebrates, and one that loads complete does not. `PaceSummary` prints its verdict as a `ProofMark`: success is `ok`, warning and destructive both `flag`, because Papel has no amber and the state rides on the glyph and the word.

**Recurring.** The subscriptions screen is a ledger ordered by next charge date, paused rows last, with income above a `DoubleRule` under its own `SectionLegend`. Each row is a `LedgerBlock` whose Record action is deliberately a secondary button, so "add recurring" stays the one high-contrast action. `BrandMark` drops its sheen for a hairline ring.

**New primitives.** `LedgerBlock` (`ledger-block.tsx`) is a `LedgerRow` head with a body of controls or a meter under it; the block owns the single hairline between blocks. `DoubleRule` (`double-rule.tsx`) is two thin ink rules with paper between them, the printed divider between two ledgers (`aria-hidden`; the legends either side carry the meaning). `SectionLegend` (`section-legend.tsx`) is engraved caps over a heavy rule with an optional aside. `RuleMeter` gains `near`. `/help#budgets`, `/help#budget-groups` and `/help#recurring` print `BudgetsMock`, `BudgetGroupsMock` and `SubscriptionsMock` from the same primitives inside a `SpecimenFrame`.

### Insights and Ask (Phase 5)
**Plate.** Every chart prints on a `Plate` (`components/papel/plate.tsx`): a hairline sheet whose head is an engraved caption, `figLabel · title` (for example "Fig. 3 · Spending pace"), over a heavy 2px `--rule`, with an optional `basis` at the right that says how the plate counts money ("when charged" or "when paid"). The caption wraps rather than truncates, and `basis` keeps its width. Insights reads as three legends over captioned plates.

**Chart grammar.** `PlateDefs` (`components/papel/plate-defs.tsx`) emits one hatch `<pattern>` per chart slot (`fill="url(#plate-N)"`, N = slot), and the `HATCHES` table (`lib/papel/plate.ts`) gives each of the eight slots its own angle and gap, so two series never differ by colour alone. A rule is drawn vertical, centred in its tile, then rotated: angle 90 is horizontal, 0 vertical. Slot 4 also carries a crossing rule so cash-flow's two bars differ by more than angle. Axes and grid are hairlines in `--paper-line` with muted tick text and no tick or axis lines (`PLATE_AXIS`, `PLATE_GRID`). The tooltip is a paper slip (`PLATE_TOOLTIP_STYLE`): `--popover` fill, hairline border, `--radius`, no shadow.

**The eight inks.** `--chart-1` to `--chart-8` are Papel now: `--chart-1` is the note violet tied to `--ring`, the rest are ink-derived (light `#4a1f8c #7a5a00 #0a7a6a #a2461e #8b3fa8 #5f7a1c #1a6f9c #b03a68`; dark set lifted for the dark paper). Each is held to 3:1 contrast against the chart ground in both themes, enforced by `lib/palette.test.ts` against `#eeebf5` (`--paper`, the lightest ground charts sit on; plates are `--card`, lighter still) and `#1d1829`. A new ink that fails the test does not ship.

**Spend ledger.** The category donut is gone. `SpendLedger` (`components/insights/spend-ledger.tsx`) prints the month as a stamped ledger: a "this month" legend over the total, then one ruled row per category (a `Stamp`, the name, the amount, its share) with a hairline `RuleMeter` scaled to the largest row. Rows run largest first and the rest row ("Other") is always last, whatever its size (`shareRows`, `lib/insights/share.ts`). The account page's card-spend panel reuses the same component. Its loading skeleton is a stack of full-width ruled rows, not a disc.

**Budget and debt ledgers.** Budgets, debt health and debt cost print as ruled ledgers of `LedgerBlock`s. Budget rows show the true percent (it can pass 100) and the meter clamps its own fill; over-budget takes the same flag `ProofMark` as Budgets.

**Ask sheet.** The conversation is a ruled sheet: a question is a hairline box with a "You" legend, an answer sits between two hairlines and uses the whole column, and the input is the house `Input` (a baseline rule, 2px ink rule on focus) beside the send button. The empty state is a ruled strip. `/help#insights` and `/help#ask` print `InsightsMock` (its `other` row last, like the real one) and `AskMock` inside a `SpecimenFrame`.

### Settings, Welcome, Help and legal (Phase 6)
**Settings** is ruled sections between heavy rules with no Note and no card; the rules list is a ledger on the same rules. The danger zone is a hairline-ruled band with an engraved legend. **`/welcome`** continues the login's violet band (guilloche, microprint, serial) beside a paper column holding the flow; each step is a hairline slip, and progress is a `Perforation` strip plus a serial-style `1 / 7` counter. **`/help`** is Read mode: chapters are engraved legends over heavy rules, the rail marks the current chapter with an ink rule, and every mock sits in a `SpecimenFrame`. **Terms and Privacy** are paper with Archivo, engraved legend headings and a 70ch measure.

### Close-out (Phase 7)
The incumbent system is gone: `HeroCard`, `ColorTile`, `StatPill`, the flat `--hero` slab, `--gold`, `.lift`, `.tile-sheen` and the marketing-only font module (Archivo now lives in `app/fonts.ts`). Use `Note`, `Stamp` and `ProofMark`. Papel Moneda is the whole-domain visual world.

**Primitives** (`components/papel/`): `Note` (the one per-screen figure), `Stamp` (category and account identity in the user's colour), `LedgerRow` and `LedgerBlock` (printed lines), `SectionLegend` and `DoubleRule` (dividers), `ProofMark` (state by glyph and word), `Perforation` and `RuleMeter` (progress), `Plate` and `PlateDefs` (charts), `CardFace`, `SpecimenFrame`, `Seal`, `Guilloche`, `Microprint`.

**Tokens** live in `design/tokens.json`, which `app/globals.css` is checked against (`design/tokens.test.ts`) and which the Expo repo (`cb-co/tywin-native`) consumes. Ornament (guilloche, microprint, serials) appears only on Notes, the Seal, the splash and empty states. Sound: a stamp thud for saves, deletes and errors.

**Still incumbent, unreviewed:** `.burst` and the `CountUp` bounce (used by `GoalStrip` and `MoneyDisplay`), and the `MoneyDisplay` size steps. Known shell issue: the mobile header icon row overflows the 360px viewport by about 8px.

## Do's and Don'ts

### Do:
- **Do** print one note per screen for the screen's main figure, violet or peso, never inverted by theme.
- **Do** build lists as ledger rows under `--paper-line` hairlines, and group surfaces as sheets (4px, hairline, no shadow).
- **Do** render user category and account colour as a Stamp; compute the per-theme ink from the stored hex (`stampInk`) so any hex clears 3:1.
- **Do** show state as ink density, rule weight or a glyph first (proof mark, double rule, underprint for projected figures).
- **Do** use `.figure` for every amount and `.legend` for caps; keep copy in `messages/{en,es}.json` in parity, with microprint and bank terms (cuotas, quincena) Spanish in both.
- **Do** label every specimen number as such (`SpecimenFrame`, `sampleData`, `specimenLabel`); only `/help` mocks and empty-state previews may show them.
- **Do** keep all ornament generated (Guilloche, Microprint, Serial, `.perforated-top`), `aria-hidden`, on notes, the splash and empty states only.
- **Do** carry over the mobile fixes as-is: safe-area insets, `min-w-0`, 360px Spanish truncation, FAB clearance.

### Don't:
- **Don't** put guilloche, microprint or serials on list rows, forms or anything read repeatedly.
- **Don't** use more than one note per screen, or a violet gradient hero slab over a grid of white rounded cards with coloured icon discs.
- **Don't** add decorative colour: colour is user ink, the two note fields, or teal/red state with a non-colour cue.
- **Don't** set text in a user hex, or assume a shipped swatch in CSS.
- **Don't** render the Seal rosette below about 80px, or size a figure inside Note (call sites do that).
- **Don't** go sepia or cream; paper is cool lilac by day and ink-dark at night.
- **Don't** use a drop shadow to separate paper, or add raster ornament.
- **Don't** present illustrative figures as real anywhere a real figure belongs.

## Provenance and Resolved decisions

No shipping raster assets: everything is CSS, SVG, canvas or Lucide icons, and the only font is Archivo via `next/font`. PNGs in `.impeccable/review/` are review screenshots, not shipped. Source brief: `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md`.

**Resolved decisions (2026-09-19, user)**
1. **Logo: re-engraved.** The Cigua mark is redrawn as an engraved seal (concentric guilloche ring plus the palmchat in intaglio line, SVG, `currentColor`), used in the sidebar, mobile header, splash, app icons, OG image and the FAB seal. Built (Phase 0).
2. **Payment cards: re-rendered to match the homepage card face exactly.** The drawn card on the marketing page is the single card-face source; Phase 2 extracts it into a shared component for the home page and every in-app card (gallery, group tile, detail, onboarding, help mocks). Keep brand colour, network mark and name inference as the card's field; add the homepage's line work and engraved lettering on top; add nothing the homepage face does not show. Pending (Phase 2).
3. **Sound: a stamp sound replaces the success sound.** Only the success cue changes. Built (`29362bd`).
4. **Native app adopts the tokens.** Papel tokens are exported as `design/tokens.json` (fixed, light, dark), which `app/globals.css` is checked against and the Expo repo consumes. Built.

This file was written from the built code; it was not re-verified against a live render.
