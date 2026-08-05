# Playful Redesign — Manual QA Guide

**Branch:** `redesign/playful-app-ui` (merge-base `79004aa`, 49 files, ~1900 insertions)
**Plan:** `docs/plans/2026-08-04-playful-redesign.md`
**Ledger:** `docs/plans/2026-08-04-playful-redesign-progress.md`

This branch is a whole-app visual redesign. Almost every surface moved, including
pages nobody deliberately redesigned — the button and tile resizes reflowed
layouts on inherited screens. That is the main thing this guide is hunting for.

---

## Before you start

### 1. Migrations — all pushed

All four are live as of 2026-08-04, so the dual-state testing this guide
originally called for no longer applies:

```
20260804120000_brighten_palette.sql       # brighter swatches
20260804130000_accounts_last4.sql         # accounts.last4
20260804140000_drop_card_groups_last4.sql # group digits come from the lines
20260804150000_accounts_brand.sql         # inferred network
```

`npm run db:types` was re-run against the live schema and produced no diff.
The pre-migration retry code in `app/(app)/accounts/actions.ts` has been
deleted, since it is now unreachable.

### 2. Start the app

```bash
npm run dev
```

If the dev server runs out of heap on this repo, it needs `--max-old-space-size=6144`.

### 3. Data you need

- At least one **credit card** with a card group, and one **standalone** credit card
- One card whose **name contains four digits** (e.g. "Amex Gold 4821") and one whose
  name contains a **year** (e.g. "Visa 2024") — these exercise opposite inference paths
- At least one card named for a network ("Visa …", "Mastercard …") and one named
  something unrecognisable ("Banco X Platinum")
- One **savings goal** that is *nearly* complete — you will finish it in section 8
- Some **imported statement transactions**, for the long-merchant-name overflow test
- A **category with a colour** and one **without**

### 4. The four axes

Every section below should be swept across: **light / dark**, **en / es**,
**360px / 1440px**. The guide calls out where a specific axis matters most, but
the four-way sweep is the actual acceptance bar.

---

## Priority order

If you only have 30 minutes, do **1, 2, 10, 3** in that order. Those cover the
defects that would be worst in production.

| # | Section | Why it ranks here |
|---|---|---|
| 1 | Figure masking | A leaked figure defeats the feature entirely |
| 2 | Horizontal scroll at 360px | Silently ruins every phone |
| 10 | Pre-migration state | Can break account creation for everyone |
| 3 | Contrast, both themes | Accessibility contract, hard to spot later |
| 4–9 | Everything else | Visual polish and per-feature behaviour |

---

## 1. Figure masking, end to end

Toggle figure masking and confirm **every** money figure masks. Three of these
were unmasked before this branch and were fixed in it, so they are regression
tests, not spot checks.

| Where | Expected |
|---|---|
| Overview hero (net worth) | Masks |
| Overview stat cards — income, spending, budget used | All three mask |
| `/insights` donut — **centre total** | Masks *(fixed on this branch)* |
| `/insights` donut — **tooltip on hover** | Masks *(fixed on this branch)* |
| `/insights` donut — **legend rows** | Masks *(fixed on this branch)* |
| `/budgets` month-switcher totals — budget / used / remaining | All three mask *(fixed on this branch)* |
| `/budgets` category tiles | Mask |
| `/accounts` card faces and per-currency rows | Mask |
| `/accounts/[id]` hero figure | Masks |
| `/transactions` rows | Mask |
| Goal cards and `/budgets/goals/[id]` | Mask |

> **Bug shape:** a figure that stays legible while its neighbours turn to glyphs.
> Check the *masked* state specifically — several of these render correctly
> unmasked and only leak when the toggle is on.

**Also:** with masking **on**, the overview figures must **not** count up. A
masked figure animating is a bug — the glyphs do not change, so it just looks
like a rendering fault.

---

## 2. Horizontal scroll at 360px

At 360px, **no route may scroll sideways**. Walk all of them:

```
/  /accounts  /accounts/[id]  /transactions  /budgets  /budgets/goals/[id]
/subscriptions  /insights  /settings  /help  /login  /welcome  /privacy  /terms
```

> Note: the plan's route list mentions `/budgets/goals`, but no such page exists —
> goals render under `/budgets`. Only `/budgets/goals/[id]` is a real route.

Highest-risk triggers, in order:

1. `/transactions` **with imported statement data** — long merchant names are the
   classic cause. `app-shell.tsx` documents a `min-w-0` fix for exactly this.
2. `/accounts` card faces — the physical card treatment is a fixed-aspect object.
3. `/insights` — the donut and its legend sit side by side above mobile and must
   stack cleanly below it.
4. `/accounts/[id]` with a 8–9 digit balance (large ARS statements). The hero uses
   a `clamp()` font size specifically so these do not clip.

---

## 3. Contrast and both themes

Both themes are first-class on this branch — neither is a filter over the other.

| Check | Expected |
|---|---|
| Every chart series on `/insights`, both themes | Eight distinguishable hues, all clearly readable against the card |
| Chart slot 1 | Is the **brand violet** on both themes, matching the focus ring |
| Colour tiles (categories, accounts, goals) | Filled colour with a **white** glyph, readable on all sixteen swatches |
| Goal and category colours in dark mode | Still legible; no colour that vanishes into the background |
| Login brand panel (**≥1024px only** — hidden below `lg`) | Violet gradient, identical in both themes |
| Overview hero | Violet gradient, identical in both themes |
| Focus rings (tab through a form) | Visible violet ring on every control, both themes |

> **Known eyeball item:** chart slot 1 is now the *same* violet as the brand and
> the hero gradient. On the overview empty state and the marketing feature tiles,
> the first tile therefore no longer reads as a distinct colour from the hero
> above it. This is intentional (the lead data hue *is* the brand) but it is the
> most likely thing you will want to overrule.

**Automated backstop:** `lib/palette.test.ts` parses the shipped values out of
`app/globals.css` and fails if any drops below 3:1. It also asserts slot 1 equals
`--ring` on each theme. So the *numbers* are covered — your job here is whether it
looks right, not whether it computes.

---

## 4. The shell — nav, bottom bar, safe area

| Check | Expected |
|---|---|
| Desktop sidebar, active item | Filled violet pill, not just a tint |
| Mobile bottom bar | Floats clear of the bottom edge; equal-width columns |
| Mobile bottom bar on a device **with a home indicator** | Bar clears the indicator; the pill is **not** lopsided or taller on one side |
| Mobile sticky header + any sticky content below it | Content does not slide *under* the opaque header |
| Scroll a long page on mobile | Bottom bar and FAB stay clear of the last row of content |

> The safe-area inset was folded into the bar's *position* rather than its padding
> on this branch. The bug shape it fixes: a bottom nav pill that looks vertically
> off-centre, with more space under the icons than above them.

---

## 5. Accounts and card faces

| Check | Expected |
|---|---|
| A credit card group | Renders as a **physical card face** |
| A card group whose lines are **all the same currency** | Face shows the summed balance |
| A card group with **mixed currencies** | Face shows **no** figure at all — the per-currency rows below carry it. No converted or unified total. |
| Card named "Visa …" / "Mastercard …" / "Amex …" | Correct network mark in the corner |
| Card named something unrecognisable | **Nothing** in the corner — no neutral chip, no placeholder |
| Amex card, **light** theme | The mark's knockout is visible (not white-on-white) |
| Card named "Amex Gold **4821**" | Shows `4821` |
| Card named "Visa **2024**" | Does **not** show `2024` — a plausible year is treated as a vintage, not a card number |
| Card named "McDonald's card" | Does **not** match Mastercard — word-boundary check |
| Accounts empty state (archive everything, or a fresh account) | Shows the **wallet illustration**, not the old circular icon |

---

## 6. Last 4 digits (new on this branch)

### Card groups — no migration needed, works now

| Step | Expected |
|---|---|
| Add account → credit card → card group → **New group** | A **second, narrower input** appears beside the group name |
| Type letters into it | They are silently dropped — digits only |
| Type more than 4 digits | Capped at 4 |
| Leave it **empty** and save | Saves fine; face falls back to inferring digits from the group name |
| Enter 4 digits and save | Face shows **those** digits, overriding name inference |
| Enter 3 digits and save | Translated error toast; nothing is written |
| Switch to Spanish and repeat the error | Message is in Spanish, not English |

### Standalone accounts — needs `20260804130000_accounts_last4.sql`

| Step | Expected |
|---|---|
| Add/edit a credit card | A **Last 4 digits** field appears, marked optional |
| Leave empty | Card face keeps inferring from the name |
| Enter 4 digits | Face shows those digits |
| **Before pushing the migration**, enter 4 digits and save | **Account still saves.** The digits are silently not stored — that is expected and correct. What must *not* happen is an error. |
| **Before pushing**, save a card with the field empty | Saves normally |

> **This is the single most important test on the branch.** The column ships ahead
> of its migration. If saving an account errors in the pre-migration state, the
> retry guard in `app/(app)/accounts/actions.ts` is not working, and account
> creation is broken for every user until the migration lands.

---

## 7. Insights and charts

| Check | Expected |
|---|---|
| Donut arc thickness | Noticeably a **band**, not a hairline ring |
| Segment caps | Softened, rounded — but small slices still read as slices, not lozenges |
| Gaps between segments | Visible, in the card colour |
| Centre total | Bold, with a de-emphasised cents tail (the `$8,822.⁸⁹` treatment) |
| Centre total with a **long** figure (8–9 digits) | Wraps or shrinks **inside** the hole; never runs out over the arcs |
| Legend | Each row shows its share **and** its amount |
| Cashflow, net worth, spending pace, debt health | All repalette cleanly; no colour that disappears against the surface |
| `/help` | Its mock donut uses the chart colours too — check it repalettes |

---

## 8. Motion and celebration

### Count-up

| Check | Expected |
|---|---|
| Load `/` | Net worth and the three stat figures count up |
| Everything else (transaction rows, budget tiles, card faces) | Does **not** count. Only the overview hero and stat cards opt in. |
| With masking **on** | No counting anywhere |

> **Known artifact, please judge it:** the figure renders at its **final value on
> first paint**, then rewinds to zero and counts. That ordering is deliberate — the
> server has no animation, so any other initial value would be a hydration
> mismatch. On a fast load it reads as a flicker before the count. If you find it
> distracting, the fix is to start the count from a `useLayoutEffect` or to drop
> the animation on first paint entirely; say the word.

### Press

| Check | Expected |
|---|---|
| Click and hold any card or nav pill | It visibly presses **in**, and springs back fast |

The previous press was `scale(0.995)` — below the threshold the eye can register
at all. If you cannot clearly feel the click land, the change did not take.

### Goal celebration

Requires a **transition into completion**, not a completed goal on load.

| Step | Expected |
|---|---|
| Open a nearly-complete goal, add a contribution that takes it to 100% | A ring **bursts** out of the progress bar **once**, and the success sound plays |
| Stay on the page, interact with other things | The burst does **not** re-fire |
| Reload the page with the goal already complete | **No** burst, **no** sound — it did not just arrive |
| Complete a second goal in the same session | That one bursts too (the animation restarts properly) |

> **Bug shape to watch for:** the burst firing repeatedly, or firing on every page
> load of a finished goal. Both were live failure modes during implementation.

### Reduced motion

In DevTools, emulate `prefers-reduced-motion: reduce`, then **reload** `/`,
`/accounts`, `/budgets`, `/insights`.

| Check | Expected |
|---|---|
| Every figure, bar, card and heading | **Visible and final.** Nothing invisible, nothing stranded at zero opacity. |
| Overview figures | Show their real value immediately, no counting |
| Progress bars | At full measured width, not zero |
| Goal burst | Does not animate (correct — it carries no information) |
| Goal success **sound** | **Still plays.** Reduced motion is a statement about motion, not about feedback. |

> This is the check most likely to find a real bug. `animation: none` with
> `fill-mode: both` strands elements at `opacity: 0`, and every new animation on
> this branch had to be given an explicit end-state reset. If **anything** is
> invisible under `reduce`, that is a blocking defect.

---

## 9. Login, marketing and empty states

| Check | Expected |
|---|---|
| `/login` at **≥1024px** | Left panel is the **violet gradient** with a wallet illustration bottom-right |
| `/login` below 1024px | Brand panel is hidden entirely; form only. This is correct, not a bug. |
| `/login` — the old decorative outline rings | **Gone**, replaced by the illustration |
| `/` signed out (marketing) | Net-worth preview is the **real gradient HeroCard**, not a flat card |
| Marketing feature tiles | Filled colour tiles with white glyphs |
| Marketing bottom CTA | Has a bar-chart illustration above the heading |
| Accounts empty state | Wallet illustration |
| Overview empty state (no accounts) | Gradient hero with a chart illustration in the corner, clipped by the card |
| All illustrations, **both themes** | Legible — tints of one hue, never invisible against their surface |

> **Regression fixed here:** the login brand panel previously rendered with **no
> background at all** — it referenced Tailwind utilities that had been deleted, and
> Tailwind emits nothing for an unknown utility rather than erroring, so the build
> stayed green. If you see a bare white/black panel at ≥1024px, it regressed.

---

## 10. Card art inference (LLM)

Art is resolved from the card's name via Gemini, using the same key and call
path as the statement extractor. The gate is **"no accent stored yet"**.

| Step | Expected |
|---|---|
| Create a card named after a real product ("Amex Platinum", "Chase Sapphire Reserve") | Face takes that card's real colour; network mark appears if the name makes it certain |
| Create a card with an unrecognisable name ("test 1234") | Face falls back to the deep **finance blue** default — a finished look, not a placeholder |
| **Edit** a card that already has a colour | Colour does **not** change, and no inference call is made |
| Open `/accounts` with cards created before this feature | They resolve shortly after load, then the page refreshes once |
| Open `/accounts` again | Nothing re-fires — everything already has an accent |
| Create a card group | The group's face gets art from the group name |

> **Bug shapes:** inference running on every edit (it must not); a card getting
> a wrong colour written that never gets revisited; the backfill re-firing on
> every visit; a save failing because inference failed (it must be silent).

Colours are validated before storage — a model answering `"navy"` or `"#FFF"`
is rejected rather than stored, since `#FFF` misparses as `rgb(0, 15, 255)` in
the colour maths. That is covered by `lib/accounts/llm/card-art.test.ts`.

---

## 11. Inherited pages (nobody redesigned these)

The button and tile resizes moved layouts on pages that got tokens only. Give each
a fast look at 360px and 1440px, both themes:

`/settings` · `/help` · `/subscriptions` · `/transactions` · `/privacy` · `/terms` · `/welcome`

Looking for: buttons that now overflow their row, tiles that wrap awkwardly,
headings that collide, tables that no longer fit.

---

## 12. Automated checks

These should already pass — re-run them after any fix you make.

```bash
npm run lint                        # expect: No issues found
npm run build                       # expect: succeeds
./node_modules/.bin/vitest run      # expect: 38 files, 272 tests
```

> **Do not** use `npm test` through the rtk proxy to judge the suite. It hides
> file-level collection failures — it reported this suite as fully passing while an
> entire file failed to load. Always run the vitest binary directly and read the
> **`Test Files`** line, not just the test count.

---

## Reporting

For anything you find, the useful shape is: **route + theme + locale + width**,
then what you saw. Most of the risky changes on this branch are conditional on one
of those four, so a finding without them usually cannot be reproduced.
