# Pay cycle and safe-to-spend (UX-05, UX-06)

**Date:** 8 Sep 2026
**Audit items:**
UX-05 · Fix · High — *"Budgets are calendar-month; Dominican salaries are not"*
UX-06 · Build · High — *"The app computes every input to 'safe to spend' and shows none of them together"*
**Audit doc:** `docs/product-audit-dominican-market.md`

## Why

Two findings, one cause: the product has no concept of a *period* other than the calendar month, and
no concept of *money you can actually spend* other than net worth.

Most of the country is paid *quincenal* — the 15th and the end of the month. A budget that resets on
the 1st tells a user they are on track on the 14th while they are actually broke, and the
spending-pace chart paces against a period their money does not follow. Meanwhile the hero figure on
Overview is net worth, which moves slowly, includes a car, and answers a question nobody asks ten
times a day. The question people do ask is *can I spend this?*

The inputs to that answer are all already computed and correct. `computeFunding` clamps goal
commitments to what an account actually holds (`lib/goals/funding.ts`). `cardAmountDue` nets payments
made since a statement closed (`lib/overview/card-due.ts`). `nextChargeDate` rolls a subscription
forward (`lib/subscriptions/cycle.ts`). `loan_status` carries installments. `getOverview` already
fetches every one of them in a single round of queries. Nothing on this list is displayed together,
and none of it is scoped to a period the user's money obeys.

This spec adds the period, then composes the answer.

## Scope

In:

1. A pay-cycle setting on the profile — *mensual / quincenal / semanal* — with quincenal as the
   default for a new profile.
2. One pure module that owns every period boundary in the product.
3. Range-based siblings for the four month-keyed SQL routines and the cashflow view, with the
   existing month signatures kept as wrappers.
4. Budget amounts stay monthly and prorate onto the active period, with the arithmetic shown.
5. A `Disponible hasta el <payday>` hero on Overview, leading with the card-minimum basis and
   carrying the full-clearance figure beneath it. Net worth demoted to a secondary stat.
6. The Budgets grid and the Insights spending-pace chart follow the pay cycle. A Mes/Quincena toggle
   keeps the monthly view available.
7. Copy at en/es parity, Spanish written first, and the help guide updated.

Out, with reasons in §10: the onboarding pay-cycle question and income baseline (UX-11), the Insights
restructure (UX-07), `lib/ask/`, budget groups, the cut list.

## 1 · The period model

A new pure module, `lib/period/cycle.ts`, is the single definition of a period boundary. Nothing else
in the product — TypeScript or SQL — derives one. SQL receives explicit `p_start` / `p_end` dates;
it never computes a period from a cycle.

```ts
export type PayCycle = "monthly" | "semimonthly" | "weekly";
export type Period = { start: string; end: string };   // inclusive, "YYYY-MM-DD"

export function periodFor(date: string, cycle: PayCycle, anchor: number | null): Period;
export function nextPayday(date: string, cycle: PayCycle, anchor: number | null): string;
export function shiftPeriod(p: Period, cycle: PayCycle, anchor: number | null, delta: number): Period;
```

Boundary rules, chosen so that no month needs a special case:

- **`semimonthly`** — `[1 … 15]` and `[16 … last day of month]`. Defined as "the 15th and the end of
  the month" rather than "the 15th and the 30th", so February and the 31-day months fall out of the
  same expression. `pay_anchor_day` is ignored.
- **`monthly`** — `[anchor … day before next anchor]`, `anchor` defaulting to 1 and clamped to the
  month's last day, so a profile anchored on the 31st has a period in September rather than an error.
- **`weekly`** — a 7-day window anchored on an ISO weekday (1–7), `pay_anchor_day` holding the weekday.

All arithmetic is date-only string arithmetic, matching `lib/budgets/month.ts`, which already avoids
`Date` timezone drift for exactly this reason. `nextPayday` is `period.end + 1 day` — the date the
hero counts down to.

## 2 · Schema

One migration, `supabase/migrations/20260908120000_pay_cycle.sql`.

```sql
create type public.pay_cycle as enum ('monthly','semimonthly','weekly');

alter table public.profiles
  add column pay_cycle       public.pay_cycle,
  add column pay_anchor_day  smallint;

-- Existing rows keep exactly today's behaviour rather than silently changing
-- period the moment this lands. The new default applies to new profiles only.
update public.profiles set pay_cycle = 'monthly' where pay_cycle is null;

alter table public.profiles
  alter column pay_cycle set default 'semimonthly',
  alter column pay_cycle set not null;

alter table public.profiles
  add constraint profiles_pay_anchor_day_valid check (
    (pay_cycle = 'semimonthly' and pay_anchor_day is null)
    or (pay_cycle = 'monthly' and pay_anchor_day between 1 and 31)
    or (pay_cycle = 'weekly'  and pay_anchor_day between 1 and 7)
  );
```

The anchor's meaning depends on the cycle, so the check is written per cycle rather than as one loose
`between 1 and 31` that would happily accept a weekday of 30. The consequence for the app: switching
a profile from `monthly` to `semimonthly` must null the anchor in the same update, or the constraint
rejects the write. The settings action does both in one statement.

`semimonthly` as the column default is the audit's *"make quincenal the default for a DOP base
currency"*: `base_currency` already defaults to `DOP` (CHK-02, pushed 17 Aug), so a new Dominican
profile now opens on a quincenal period without touching a setting — the Brand Commitment in
`PRODUCT.md` that Spanish and RD$ are first-run defaults, extended to the pay cycle.

The same migration appends the minimum payment to `card_status`, which does not carry it today. The
column lives on `card_statements` (added 20260722120000) and the view's lateral join already selects
the newest statement, so this is one more column on that select. Appending is safe under
`create or replace view` — the same move and the same reasoning as
`20260727140000_card_status_period_end.sql`, which appended `latest_period_end`.

```sql
-- ... existing lateral join, with minimum_payment added to its select list ...
       s.minimum_payment   as latest_minimum_payment
```

## 3 · The SQL generalisation

Four routines and one view bucket on `date_trunc('month', occurred_at)` and cannot express a
quincena:

| Routine | Defined in |
| --- | --- |
| `category_usage(p_month)` | `20260731130000_card_payment_default_and_cashflow.sql:6` |
| `uncategorized_spend(p_month)` | `20260819131444_null_category_triage.sql:211` |
| `spend_distribution(p_month)` | `20260822143000_accrual_spend_insights.sql:36` |
| `spending_pace(p_month)` | `20260822143000_accrual_spend_insights.sql:75` |
| `monthly_cashflow` (view) | `20260731130000_card_payment_default_and_cashflow.sql` |

Each gains a `_range(p_start date, p_end date)` sibling holding the real body, and the existing month
signature becomes a thin wrapper over it:

```sql
create or replace function public.category_usage(p_month date)
returns table (...)
language sql stable security invoker set search_path = ''
as $$
  select * from public.category_usage_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date);
$$;
```

This is the whole reason for taking the SQL route rather than computing periods in TypeScript. The
inclusion rules — *expenses and payments, not `exclude_from_budget`* for the budget surfaces, and
*expenses plus loan payments only* for the accrual surfaces — stay in exactly one place each.
`20260822143000_accrual_spend_insights.sql` exists precisely because a TypeScript copy of one of
these rules drifted from the SQL one and shipped wrong figures; a second copy would re-open that.

Every current caller keeps working unchanged, which is what makes the equivalence test in §9 the
load-bearing guard for this migration.

### Proration lives in SQL

`category_budgets` is keyed `(category_id, month)` and keeps storing a **monthly** amount. Nothing
about that table changes, no data migrates, and no user re-types a budget.

`category_usage_range` returns both figures — the stored monthly amount and the amount prorated onto
the requested range:

```
prorated = Σ over each month the range overlaps of
             amount(month) × overlapping_days(month) ÷ days_in(month)
```

One expression covers a calendar month (factor 1), either half of a quincena, and a week straddling
two months with different budgets. It also covers the case worth naming before an implementer meets
it and assumes a bug: a `monthly` profile anchored on, say, the 25th has a period spanning two
calendar months, so its budget is a blend of both months' stored amounts. That is the correct
reading — the stored figure is a monthly rate, and the period is drawing 7 days from one month's rate
and 24 from another's. Returning both figures from the same function is what lets the UI
render `RD$5,000/mes · RD$2,500 esta quincena` with no possibility of the two numbers disagreeing.

### `spending_pace_range`

The month version returns 31 rows keyed by day-of-month, comparing this month against last. The
range version keys on **day-offset from period start** and compares the requested period against the
period immediately preceding it, returning as many rows as the longer of the two. A quincena is then
paced against the previous quincena rather than against a month it does not fit inside.

### Guards

Every `_range` function asserts `p_end >= p_start` and rejects a span beyond 366 days, so a malformed
range cannot become an unbounded scan. `lib/ask/guard.ts` allowlists relations by name; the new
functions are not added to it — Ask stays on the month-keyed views (§10).

## 4 · Safe to spend

New pure module `lib/overview/available.ts`, tested without a Supabase client in the same style as
`card-due.ts`. It composes rows `getOverview` already fetches; the only new query is the profile's
pay cycle.

```ts
export type CardBasis = { accountId: string; name: string; basis: "minimum" | "full" };

export type Available = {
  periodEnd: string;                 // the next payday
  liquid: number;                    // base currency
  committed: number;
  cardsMinimum: number;
  cardsFull: number;
  loans: number;
  subscriptions: number;
  available: number;                 // the hero
  availableIfCardsCleared: number;   // the line beneath it
  cardBasis: CardBasis[];
  fxUnconverted: string[];
};
```

| Leg | Source | Rule |
| --- | --- | --- |
| Liquid | `account_balances` joined to `accounts.type` (the `accounts` select in `getOverview` gains `type`, which it does not fetch today) | `checking`, `savings`, `cash` only. `investment` and `asset` are excluded — they are net worth, not money you can spend, and they are the audit's *"it includes a car"*. |
| − Committed | `computeFunding` | Sum the per-account `available` it already returns, restricted to the liquid accounts. The clamp is not re-implemented; `liquid − committed` is by construction Σ `available`. |
| − Cards | `cardAmountDue` and `latest_minimum_payment` | `min(minimum_payment, amountDue)` where the statement printed a minimum, `amountDue` where it did not. Clamping to `amountDue` matters: a user who has already paid below the printed minimum owes the remainder, not the minimum. |
| − Loans | `loan_status` | `installment_amount` where the next due date falls on or before `periodEnd`. |
| − Subs | `nextChargeDate` | `amount` where the next charge falls on or before `periodEnd`. |

`availableIfCardsCleared` is the same sum with `cardsFull` substituted for `cardsMinimum`.

Every leg converts through the existing `convertToBase`, and `fxUnconverted` reuses
`unconvertedCurrencies` so a degraded FX table produces the same warning the page already renders
rather than a silently wrong hero (CHK-03).

**Why the basis is shown, not just applied.** A card whose statement printed no minimum is subtracted
in full, which makes the hero smaller for a reason the user cannot see unless it is named. The
breakdown labels each card with the basis it used. This is Principle 4 — *refuse rather than guess* —
applied to a figure that would otherwise look conservative for no visible reason. It is also why we
do not invent a minimum from a percentage of the balance: no bank in this market publishes one rule,
and a guessed minimum makes the headline number a fiction.

## 5 · The Overview hero

`HeroCard` on `app/(app)/page.tsx:125` currently renders net worth. It becomes:

```
Disponible hasta el 30 sept
    RD$ 18,450.00
    −RD$ 22,300 si saldas las tarjetas

  Balance líquido           RD$ 47,200.00
  − Metas comprometidas        −8,000.00
  − Tarjetas (mínimo)          −6,750.00
      Popular · mínimo del estado
      BHD    · total, sin mínimo impreso
  − Préstamos                  −9,500.00
  − Suscripciones              −4,500.00

  Patrimonio neto  RD$ 312,900  ▸
```

- Net worth stays a real figure as a secondary stat, one tap from its detail. It is demoted, not cut.
- A negative `available` renders in the existing over-budget treatment rather than a new alarm state,
  and the copy stays calm and second-person per the voice in the catalogues. A negative number here
  is information, not a scolding.
- The breakdown is collapsed by default on mobile and expands in place; the two headline figures are
  always visible.
- `hasAccounts === false` keeps today's empty state untouched — the import prompt already owns that
  screen (UX-02) and the hero has nothing to compose.
- A card with no statement ever imported falls back to live `owed` through `cardAmountDue`, basis
  `full`, exactly as the Upcoming list already does.
- The figure honours the existing figure-mask privacy mode like every other money display.

## 6 · Budgets and the pace chart

`app/(app)/budgets/page.tsx` reads `?month=` and normalises it with `normalizeMonth`. It gains a
period: `?from=&to=` when the active cycle is not monthly, with `?month=` still accepted so existing
links and bookmarks keep resolving.

The month picker becomes a period picker driven by `shiftPeriod`, and carries a two-way toggle
between the calendar month and the profile's own cycle — labelled **Mes / Quincena** for a
`semimonthly` profile and **Mes / Semana** for a `weekly` one. The audit is explicit that the monthly
view stays available. The toggle is a view control on the page, not a second setting on the profile;
the profile's `pay_cycle` decides which side the page opens on, and the toggle is hidden entirely for
a `monthly` profile, where both sides would render the same thing.

Each budget bar labels both figures (`RD$5,000/mes · RD$2,500 esta quincena`) whenever the active
period is not a whole month, and labels only the stored figure when it is — so a user who never
leaves monthly sees literally today's page.

On Insights, the **spending-pace chart alone** moves to `spending_pace_range`. The other ten cards
stay monthly (§10).

## 7 · Copy and i18n

Every string lands in both `messages/en.json` and `messages/es.json`, Spanish written first. New keys
cover: the three cycle names, the settings control and its help text, the hero label with its
interpolated payday, the second headline figure, the five breakdown rows, the two card-basis labels,
the prorated budget label, and the period picker's toggle.

The payday in `Disponible hasta el 30 sept` is interpolated as a formatted date, not concatenated, so
Spanish and English can order it differently.

The help guide is updated in the same change — page, mocks, en and es — per the standing rule that no
feature ships ahead of its guide.

## 8 · Migration sequencing

The UI calls the `_range` functions directly. There is **no runtime fallback** to the month functions
and no defensive read of a possibly-absent `pay_cycle` column.

A shim's only purpose would be to make a state we never intend to ship — app deployed, migration not
pushed — render correctly, and it would then have to be found and deleted later. The repo already has
a better answer for a live linked project the agent cannot push to: the hard-stop Task 0 that
`docs/plans/2026-08-26-budget-groups-ui.md` opens with. The implementation plan opens the same way.

Sequence: write the migration → **stop** → the human runs `supabase db push --linked` → regenerate
`lib/supabase/types.ts` from the remote → `tsc --noEmit` and `npm test` clean → UI work begins.

## 9 · Testing

**`lib/period/cycle.test.ts`** — the boundaries that actually bite: both February quincenas in a
leap and a common year; a `monthly` anchor of 31 landing in a 30-day month; a `weekly` period
crossing a month boundary and a year boundary; `nextPayday` on the last day of a period and on the
first; `shiftPeriod` round-tripping ±1 across all three cycles.

**`lib/period/prorate.test.ts`** — a full month prorating to a factor of exactly 1; both quincenas of
a 31-day month summing to the stored monthly amount; a week spanning two months with different stored
budgets prorating against each month's own denominator.

**`lib/overview/available.test.ts`** — each leg in isolation and composed; the minimum clamped to
`amountDue` when a payment has already taken the balance below the printed minimum; the no-statement
fallback producing basis `full`; a negative result; a degraded FX table populating `fxUnconverted`
without corrupting the total; an account set with no liquid accounts at all.

**Equivalence, the load-bearing guard.** `category_usage(m)` must return exactly what
`category_usage_range(monthStart(m), monthEnd(m))` returns, and the same for the other three. This is
what makes "every current caller keeps working" a checked claim rather than an assertion, and it is
the test that fails loudly if a future edit touches one body and not the wrapper. Extends
`lib/budgets/queries.test.ts`.

**Browser pass** — Overview and Budgets on a quincenal profile and on a monthly profile, in Spanish,
at a 360px viewport, with `agent-browser`.

## 10 · Out of scope, and why

- **UX-11 — the onboarding pay-cycle question and income baseline.** The setting this spec adds is
  what UX-11 will seed; asking for it during onboarding is a separate finding with its own step
  count and skip behaviour. Shipping the setting first means UX-11 becomes a screen, not a schema
  change.
- **UX-07 — the Insights restructure.** Only the pace chart moves here. The other ten cards keep
  answering a monthly clock, which is exactly the mismatch UX-07 names; fixing it inside this change
  would swallow a High-ranked finding into a footnote of another one.
- **`lib/ask/`.** Its views and its guard allowlist stay month-based. Teaching the model a second
  period vocabulary is a prompt-and-schema-doc change with its own query budget, unrelated to
  whether the budget grid can render a quincena.
- **Budget groups.** `docs/plans/2026-08-26-budget-groups-ui.md` is unstarted and orthogonal — it
  splits the *category* dimension, this splits the *period* dimension. They meet only in
  `q_budget_groups`, which keeps its month keying until that plan runs.
- **An income figure in the hero.** *Disponible* is money you have, not money you expect. Adding a
  forecast salary would make the headline number a projection, and the product's trust argument rests
  on the opposite (Principle 5). It arrives, if ever, with UX-11's income baseline and as a separate
  line.
