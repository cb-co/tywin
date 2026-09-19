# Papel Moneda across the signed-in app — redesign brief

Status: **shape brief, awaiting confirmation.** No code. Produced with
`/impeccable shape`; every build phase below re-enters impeccable (see
*Process per phase*).

The home page and `/login` shipped in the Papel Moneda world (commit `39c7302`,
`DESIGN.md`, `components/marketing/papel/`). DESIGN.md currently says "the
signed-in app keeps its own system". This brief plans retiring that split: the
whole domain (public pages, `/welcome`, the `(app)` group, `/help`, `/terms`,
`/privacy`) moves into one world.

## Decisions already made

1. **Notes for hero figures, paper for everything else.** Each screen gets at
   most one violet or peso *note* for its main figure. Everything else is the
   security-paper ledger: rules, ink density, Archivo. Guilloche, microprint
   and serials live only on notes, the splash, and empty states.
2. **Categories and accounts become ink stamps in the user's colour.** The
   stored hex is the *ink* of a small printed stamp or seal (outlined glyph in an
   ink ring), not a filled tile. It must work for any hex, not just the 16
   shipped swatches.
3. **Foundation first, then screen families.** Phase 0 promotes tokens, type
   and primitives app-wide and rebuilds the shell. Each later phase is one
   screen family, shipped and merged on its own branch.

## 1. Job and audience

- **Who:** Dominican consumers with several cards across several banks, paid
  by quincena, mostly on a phone (installable PWA), in Spanish first. They open
  the app for a glance ("¿cuánto me queda?"), after a new *estado de cuenta* is
  uploaded, and for a monthly check-in.
- **Scene:** a phone in daylight on a bus or at a desk, often one-handed, with
  sessions under 30 seconds. Evening use is real, so dark mode is first-class,
  but **light is the default** (security paper by day).
- **Mode: Operate** for every signed-in surface. `/help` and legal are
  **Read**. The home page and login stay **Persuade** and already exist.
  Expression can never hide the task, state, or familiar affordance. The brand
  lives in precise details (type, rules, stamps, one note per screen), not in
  decoration.

## 2. Outcome and proof

- **Primary task per visit:** read the one figure that matters (Disponible,
  net worth, a card's due amount), then import a statement or fix what the
  import could not categorise.
- **Success:** someone who signed up from the Papel home page feels the same
  document continuing after login. The app reads like a statement that has
  been checked and sorted, not a generic dashboard. The glance task on the
  Overview takes no longer than it does today.
- **Product truth the design must make visible:** statement-anchored balances,
  locked FX rates, checksums that must match, cuotas, and quincena periods.
  These already exist as data. The redesign renders them as printed
  facts, such as a "cuadra ✓" proof mark, a cuota perforation, or a quincena
  timeline, never as marketing claims.

## 3. Selected direction

**Visual authority: the Papel Moneda world already in DESIGN.md.** The world is
settled, so there is no new world roll. What changes is its **reach**, from public pages
to the whole product, with an Operate register.

**Structural thesis: "the app is your statement, re-issued."** Every screen is
a sheet of security paper printed in intaglio ink. The one figure each screen
exists to answer is printed as a small banknote (the *note*), like the
denomination on a bill. Lists are ledger rows under hairline rules, not cards
in a grid. State is ink density: settled figures print full ink, projected or
pending figures print as underprint (lighter ink, dotted rule).

It refuses the category default: a violet gradient hero slab over a grid of
white rounded cards with coloured icon discs, which is exactly the incumbent
`HeroCard` + `Card` + `ColorTile` + `StatPill` pattern.

**Focal moment:** the Overview *Disponible* note. It is a peso-orange note
with the figure in Archivo expanded denomination numerals, a quincena timeline
engraved along its bottom edge, and a serial line that encodes the period
(`QNA 2026-09 B`). It replaces `AvailableHero` / `HeroCard`. Net worth stays
on the same note as a secondary figure, as it does today.

**The shared vocabulary (built in Phase 0, reused everywhere):**

| Papel object | Replaces | Used for |
| --- | --- | --- |
| **Note** (violet or peso field, guilloche underprint, serial, microprint edge) | `HeroCard`, gradient `--hero` | the one hero figure per screen |
| **Sheet** (paper surface, hairline frame, no radius above ~4px, no drop shadow) | `Card` | every grouped surface |
| **Ledger row** (date · stamp · description · tabular amount, rule below) | card rows, `divide-y` cards | transactions, upcoming, triage, rules, statements |
| **Stamp** (ink ring + Lucide glyph in the stored hex) | `ColorTile` | categories, accounts, merchants |
| **Proof mark** (small engraved check or cross with a label) | `StatPill`, success badges | "cuadra", "sin categoría", over-budget |
| **Perforation strip** (cuota cells, punched when paid) | progress bars for cuotas and loans | cuotas, loans, goal contributions |
| **Rule meter** (a ruled scale filled with ink) | `Progress`, `bar-fill` | budgets, goals, card utilisation |
| **Specimen frame** (dashed frame + "Ejemplo" microprint) | help mocks, empty-state previews | `/help` mocks, empty states |

**Implementation consequence:** the work is mostly a new primitive layer plus
restyling the shadcn primitives. Screen logic, queries and copy keys stay. The
`papel.module.css` tokens become global tokens, so the marketing module
consumes them instead of redefining them.

## 4. Scope and boundaries

**In scope (whole domain):** shell (sidebar, mobile header, bottom nav,
activity sheet, splash, quick-add FAB and dialog), Overview, Accounts + detail
(payment cards, card groups, card lines, statements panel, amortisation,
balance chart), Transactions (ledger, row, form, dialogs), Imports triage,
Budgets + groups + goals, Recurring/subscriptions, Insights (all charts), Ask,
Settings + rules, `/welcome` onboarding, `/help` (page, chapters, mocks),
`/terms`, `/privacy`, toasts, dialogs, selects, menus, empty/loading/error
states, OG and app icons, and the PWA manifest theme colour.

**Must remain untouched:** routes, data fetching, server actions, queries,
message keys (copy may be *added*, never silently replaced), the sound system,
the figure-mask behaviour, quick-add behaviour, the Onboarding gate, and every
correctness guard (FX-degraded notice, checksum refusals, clamped goal
funding).

**Anti-goals, which would feel wrong even if polished:**
- Guilloche or microprint on list rows, forms, or anything read repeatedly.
  Ornament fatigue kills an Operate app.
- More than one note per screen.
- Decorative colour. Colour is either the user's own category or account ink,
  or the two note fields, or state (teal/red), backed by a non-colour cue.
- A "vintage" or sepia rendition. The paper is cool lilac by day and
  ink-dark at night, never cream.
- Specimen-style fake numbers anywhere a real figure belongs. Only `/help`
  mocks and empty-state previews may show specimens, and they are labelled
  (DESIGN.md rule).
- Losing the incumbent's hard-won mobile fixes (safe-area insets, `min-w-0`,
  label truncation at 360px Spanish, FAB clearance). They move over as-is.

## 5. States and ranges

- **Figures:** RD$0 to eight digits, negative Disponible, and mixed RD$/US$ on
  one card. Denomination numerals must fit a 360px phone at eight digits plus
  the `RD$` prefix: the note figure scales down, it never wraps or clips.
- **Lists:** 0 to about 1,000 transactions, and about 100 lines per imported
  statement. Ledger rows must hold a 60-character imported merchant name
  (truncate) and a two-currency amount.
- **User colour:** any hex, including near-white and near-black. Stamp ink needs
  a contrast rule (darken or lighten toward ink on paper, per theme) so a
  pale user colour still reads at 3:1 as a glyph, and text is never set in
  the user's hex.
- **Material states per screen:** first-run/empty (statement import is the
  primary action, a principle from PRODUCT.md), loading (skeleton sheets as
  unprinted ruled paper, no shimmer), FX-degraded, a pending migration (the UI
  must render before and after it), import in progress, import failed, triage
  done, over budget, overdue bill, and figure-mask on (masked figures keep
  their width).
- **Themes:** light and dark are both first-class. The notes never invert and
  the paper does, which is already the rule in the marketing module.
- **Motion:** the note's guilloche "cuts in" once per session (splash or first
  Overview paint), not on every navigation. Numbers keep `CountUp` but print
  in, rather than bounce. Everything is honoured under
  `prefers-reduced-motion`.

## 6. Interaction and layout

- **Shell.** On desktop, the sidebar becomes a narrow paper strip with a
  vertical microprint edge and the Cashly mark as an engraved seal. Nav items
  are text in ink, and the active item prints full ink with a thick rule while
  inactive items are underprint. On mobile, the bottom nav keeps its five cells and
  Overview-centre order but loses the floating blurred capsule. It becomes a
  ruled paper band on the safe area with the active cell in full ink. The quick-add
  FAB becomes a round violet *seal*, the one violet object on the shell.
- **Overview.** The Disponible note (focal moment), then the "Este período"
  ledger (three figures as one ruled table, not three cards), then the coach
  recommendation as a printed margin note, then Ask as a single ruled input
  line, then Upcoming as ledger rows with due-date stamps.
- **Accounts.** The net-worth note (violet). Cards stay *drawn as the physical
  card* (the positioning claim) but sit on the sheet as specimens with a
  hairline frame. Card lines become per-currency ledger sections. Cuotas and
  loans use perforation strips. The statements panel is a ledger of issued
  statements, each with a proof mark (cuadra / no cuadra).
- **Transactions.** A pure ledger: a sticky date rule, stamp, description,
  tabular amount, and a category rail as a stamp strip. The form and dialogs
  become paper slips (see primitives). There is no note on this screen.
- **Imports triage.** The statement being processed prints as a ruled sheet,
  and merchant groups are ledger blocks with one stamp-picker each. "Done" is
  a proof mark stamped across the sheet, the one moment of celebration.
- **Budgets and goals.** The period total is a peso note, and categories are rule meters
  with the user's stamp. Groups are ruled sections. Goals use perforation
  strips for contributions.
- **Recurring.** Ledger by next date, with income and expense separated by a double rule.
- **Insights.** Charts are redrawn as engraved plates: ink lines, hatched fills
  instead of flat colour, series told apart by pattern plus stamp ink, and
  hairline axes. The dataviz skill applies when this phase is built.
- **Ask.** A ruled conversation sheet. Answers print as ledger excerpts when
  they carry figures.
- **Settings.** Plain ruled sections with no note. Rules list as a ledger.
- **`/welcome`.** Continues the login's note band. Each step is a slip, and
  step progress is a serial counter (`1 / 7`) with a perforation strip.
- **`/help`.** Read mode: a paper page with a chapter rail. Mocks are
  rebuilt with the same primitives inside specimen frames (they must match the
  real UI, per the help-guide upkeep rule).
- **Primitives (shadcn reskin).** Buttons are ink slabs (primary: violet
  note ink; secondary: ruled outline). Inputs are a baseline rule with a
  label above it, as the login form does. Dialogs and sheets are paper slips
  with a torn or perforated top edge (drawn with CSS/SVG, no raster). Toasts
  are receipt slips. Select and menu items are ledger rows. Every focus ring
  is a 2px currentColor outline, as on the marketing pages.

## 7. Constraints and open decisions

**Binding constraints**
- Next.js App Router + Tailwind v4 + shadcn. Tokens move from
  `papel.module.css` into `app/globals.css` as the single source. `lib/palette.ts`
  stays as the user-colour source.
- **One family: Archivo** (width axis) replaces Plus Jakarta Sans and Inter
  app-wide, and `.figure` becomes Archivo tabular. Check that Archivo's
  tabular figures hold at 11–12px before Phase 0 closes (this is the reason
  Inter was added).
- WCAG 2.2 AA: 4.5:1 for body text, including note ink on violet and peso ink on
  orange (already true in the marketing tokens). Keyboard-complete, and
  reduced motion honoured.
- i18n: en and es ship together, with no hardcoded copy. Microprint and bank terms stay
  Spanish in both. The help guide is updated in the same phase as the screen
  it documents.
- Performance: guilloche canvases are bounded to notes (at most one per
  screen). Nothing runs on list rows. Charts stay lazy.
- Supabase: none of this needs a migration. If a phase discovers it needs
  one, the human pushes it and the UI must render both before and after.

**Resolved decisions (2026-09-19, user)**
1. **Logo: re-engraved.** Phase 0 redraws the Cashly mark as an engraved seal
   (concentric guilloche ring + the mark in intaglio line, SVG, `currentColor`),
   used in the sidebar, splash, app icons, OG image and the FAB seal.
2. **Payment cards: re-rendered as far as recommended, matching the homepage
   card face exactly.** The drawn card on the marketing page
   (`components/marketing/marketing-home.tsx` cards section, `papel.module.css`)
   is the single card-face source. Phase 2 extracts it into a shared component
   used by the home page *and* every in-app card (gallery, group tile, detail,
   onboarding, help mocks). Recommendation adopted: keep brand colour, network
   mark and name inference (the positioning claim) as the card's field; add the
   homepage's line work and engraved lettering on top. Anything the homepage
   face does not show, the in-app face does not add.
3. **Sound: a stamp sound replaces the success sound.** Only the success cue
   changes; every other cue keeps its current sound.
4. **Native app adopts the tokens.** Phase 0 exports the Papel tokens as a
   platform-neutral file (`design/tokens.json`) that `app/globals.css` is
   checked against and the Expo repo can consume.

## Phases

Each phase is its own branch, merged to main and deleted when done.

| Phase | Scope | Note on screen | Notes |
| --- | --- | --- | --- |
| **0 · Foundation** | global tokens, Archivo, dark mode, primitives (Note, Sheet, LedgerRow, Stamp, ProofMark, Perforation, RuleMeter, SpecimenFrame), shadcn reskin, shell, splash, FAB, toasts, icons, manifest colour; marketing module switched to global tokens | — | Changes every screen at once. Screens must still read correctly with old layouts on new primitives. |
| **1 · Overview** | Disponible note, period ledger, coach margin note, Ask line, Upcoming | peso | Focal moment. Comp-led. |
| **2 · Accounts** | gallery, net-worth note, drawn cards, card groups/lines, statements panel, detail, amortisation, balance chart, account form | violet | Resolve open decision 2. |
| **3 · Transactions + Imports** | ledger, row, category rail, transaction form/dialogs, quick-add dialog, statement import dialog, triage | — | The heaviest-used screens. Density first. |
| **4 · Budgets + Goals + Recurring** | budget grid, groups, rule meters, goals, perforated contributions, subscriptions view/forms | peso | |
| **5 · Insights + Ask** | engraved chart plates, spend donut, pace, debt health/cost, Ask chat | — | Load the dataviz skill. |
| **6 · Settings, Welcome, Help, Legal** | settings panel, rules, `/welcome` steps, `/help` page + all mocks, `/terms`, `/privacy` | welcome: violet band | Help mocks from phases 1–5 are re-checked here. |
| **7 · Close-out** | one DESIGN.md for the whole domain, a whole-app audit, removal of dead incumbent tokens (`--hero`, chart palette, `ColorTile`, `HeroCard`, `StatPill`) | — | |

### Process per phase (impeccable)

1. `/impeccable shape <screen family>`: confirm the states and tasks for that
   family against this brief.
2. For a whole screen whose composition is still open (Overview, Accounts, Insights),
   run the concept roll at surface scope
   (`concept-seed.mjs --scope surface --mode operate`) inside the fixed world.
   Build path is **comp** (`.impeccable/config.json`): anchor comps on a
   screenshot of the Papel home or login plus DESIGN.md.
3. Build under `reference/craft-floor.md`, using the direction contract comment in
   the artifact.
4. One batched screenshot round (desktop + 360px mobile, light + dark, es),
   one fix batch, and at most one confirm round.
5. Run `detect.mjs`, then the `impeccable-finish-reviewer`, then the
   `impeccable-documenter` to extend DESIGN.md with the new scope.
6. `/impeccable audit` for a11y/perf/responsive on the phase's routes, then
   `polish`. Update the help guide (en + es), check typecheck, lint and key parity, and merge.

Dev-server runs for review follow the machine rules: one server, fixed port,
started only after asking, and stopped in the same turn.
