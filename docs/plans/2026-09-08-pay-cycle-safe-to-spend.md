# Pay Cycle and Safe-to-Spend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the product a period its users' money actually obeys — *quincenal*, monthly or weekly — and replace Overview's net-worth hero with `Disponible hasta el <payday>`, the figure that answers "can I spend this?".

**Architecture:** One pure module (`lib/period/`) owns every period boundary; SQL never derives one, it receives explicit `p_start`/`p_end`. The four month-keyed routines gain `_range` siblings holding the real body, with the existing `p_month` signatures kept as thin wrappers so every current caller is untouched and each inclusion rule stays in exactly one place. `category_budgets` keeps storing a monthly amount and prorates onto the active period inside SQL. Safe-to-spend is a pure composition of rows `getOverview` already fetches.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase/Postgres with RLS, next-intl (en/es), Vitest, Tailwind + shadcn/ui, Recharts.

**Spec:** `docs/specs/2026-09-08-pay-cycle-safe-to-spend-design.md` — read it before Task 1. The plan argues from it and does not repeat its reasoning.

## Global Constraints

- **Locale parity is mandatory.** Every user-facing string gets a key in BOTH `messages/en.json` and `messages/es.json`. Spanish is the primary audience: **write the Spanish first, then the English.**
- **Never a bare `$`.** Dominican pesos render as `RD$`. Use the existing `MoneyDisplay` / currency formatters; never hand-format money.
- **Money is `numeric` in Postgres and arrives as a string.** Always `Number(x ?? 0)` before arithmetic.
- **Server actions return `{ error?: string }`**, never throw, and route DB failures through `dbError(error, "actionName")` from `@/lib/errors`.
- **Never trust a client-supplied row id.** Actions derive rows from the scope they were given; RLS is the backstop, not the check.
- **Supabase is a live linked project.** The agent cannot push migrations; the human does. Task 2 is a hard stop.
- **Tests:** `npm test` (Vitest, globals enabled, `@` aliased to the repo root). Unit tests sit beside the file under test as `<name>.test.ts`. Every test in this repo exercises a pure function over hand-built rows — no test touches a database, and none in this plan should either.
- **Date arithmetic is date-only string arithmetic.** Follow `lib/budgets/month.ts`: build `YYYY-MM-DD` strings, never a `Date` that can drift a day across a timezone.
- **The help guide is updated in the same change as the feature** (Task 10) — page, mocks, en + es.
- **A monthly profile must see today's app.** Every task is written so the `monthly` path is byte-for-byte the current behaviour. This is the constraint that makes the change safe to ship, and Task 7 gives it a test of its own.

---

### Task 1: `lib/period/cycle.ts` — the period boundaries

The pure core. No database, no imports from the app. Everything else in this plan consumes it, so it is first and it is fully tested before anything else starts.

**Files:**
- Create: `lib/period/cycle.ts`
- Test: `lib/period/cycle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export const PAY_CYCLE_VALUES = ["monthly", "semimonthly", "weekly"] as const;
  export type PayCycle = (typeof PAY_CYCLE_VALUES)[number];
  export type Period = { start: string; end: string };   // inclusive, "YYYY-MM-DD"

  export function periodFor(date: string, cycle: PayCycle, anchor: number | null): Period;
  export function nextPayday(date: string, cycle: PayCycle, anchor: number | null): string;
  export function shiftPeriod(p: Period, cycle: PayCycle, anchor: number | null, delta: number): Period;
  export function isWholeMonth(p: Period): boolean;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/period/cycle.test.ts
import { describe, it, expect } from "vitest";
import { periodFor, nextPayday, shiftPeriod, isWholeMonth } from "./cycle";

describe("periodFor · semimonthly", () => {
  it("puts the 1st through the 15th in the first half", () => {
    expect(periodFor("2026-09-08", "semimonthly", null)).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("puts the 16th onward in the second half, ending on the month's last day", () => {
    expect(periodFor("2026-09-16", "semimonthly", null)).toEqual({
      start: "2026-09-16",
      end: "2026-09-30",
    });
  });

  it("ends February's second half on the 28th in a common year", () => {
    expect(periodFor("2026-02-20", "semimonthly", null)).toEqual({
      start: "2026-02-16",
      end: "2026-02-28",
    });
  });

  it("ends February's second half on the 29th in a leap year", () => {
    expect(periodFor("2028-02-20", "semimonthly", null)).toEqual({
      start: "2028-02-16",
      end: "2028-02-29",
    });
  });

  it("ends a 31-day month's second half on the 31st", () => {
    expect(periodFor("2026-08-31", "semimonthly", null)).toEqual({
      start: "2026-08-16",
      end: "2026-08-31",
    });
  });
});

describe("periodFor · monthly", () => {
  it("is the calendar month when anchored on the 1st", () => {
    expect(periodFor("2026-09-08", "monthly", 1)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("treats a null anchor as the 1st", () => {
    expect(periodFor("2026-09-08", "monthly", null)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  it("spans two calendar months when anchored mid-month", () => {
    expect(periodFor("2026-09-08", "monthly", 25)).toEqual({
      start: "2026-08-25",
      end: "2026-09-24",
    });
  });

  it("clamps a 31st anchor to the last day of a 30-day month", () => {
    // September has no 31st: the period starts on the 30th and runs to the
    // day before October's 31st.
    expect(periodFor("2026-09-30", "monthly", 31)).toEqual({
      start: "2026-09-30",
      end: "2026-10-30",
    });
  });
});

describe("periodFor · weekly", () => {
  it("starts on the anchored ISO weekday", () => {
    // 2026-09-08 is a Tuesday (ISO 2). Anchored to Monday (ISO 1).
    expect(periodFor("2026-09-08", "weekly", 1)).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("returns the current week when the date is the anchor day itself", () => {
    expect(periodFor("2026-09-07", "weekly", 1)).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
  });

  it("crosses a month boundary without special-casing it", () => {
    expect(periodFor("2026-10-01", "weekly", 1)).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
  });

  it("crosses a year boundary without special-casing it", () => {
    expect(periodFor("2027-01-01", "weekly", 1)).toEqual({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });
});

describe("nextPayday", () => {
  it("is the day after the period ends", () => {
    expect(nextPayday("2026-09-08", "semimonthly", null)).toBe("2026-09-16");
  });

  it("rolls into the next month from the second half", () => {
    expect(nextPayday("2026-09-20", "semimonthly", null)).toBe("2026-10-01");
  });

  it("rolls into the next year from December", () => {
    expect(nextPayday("2026-12-20", "semimonthly", null)).toBe("2027-01-01");
  });
});

describe("shiftPeriod", () => {
  it("round-trips ±1 for semimonthly across a month boundary", () => {
    const p = periodFor("2026-09-08", "semimonthly", null);
    const back = shiftPeriod(p, "semimonthly", null, -1);
    expect(back).toEqual({ start: "2026-08-16", end: "2026-08-31" });
    expect(shiftPeriod(back, "semimonthly", null, 1)).toEqual(p);
  });

  it("round-trips ±1 for monthly", () => {
    const p = periodFor("2026-09-08", "monthly", 1);
    const back = shiftPeriod(p, "monthly", 1, -1);
    expect(back).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(shiftPeriod(back, "monthly", 1, 1)).toEqual(p);
  });

  it("round-trips ±1 for weekly across a year boundary", () => {
    const p = periodFor("2027-01-01", "weekly", 1);
    const back = shiftPeriod(p, "weekly", 1, -1);
    expect(back).toEqual({ start: "2026-12-21", end: "2026-12-27" });
    expect(shiftPeriod(back, "weekly", 1, 1)).toEqual(p);
  });
});

describe("isWholeMonth", () => {
  it("is true for a calendar month", () => {
    expect(isWholeMonth({ start: "2026-09-01", end: "2026-09-30" })).toBe(true);
  });

  it("is false for a quincena", () => {
    expect(isWholeMonth({ start: "2026-09-01", end: "2026-09-15" })).toBe(false);
  });

  it("is false for a period that spans two months", () => {
    expect(isWholeMonth({ start: "2026-08-25", end: "2026-09-24" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- lib/period/cycle.test.ts`
Expected: FAIL — `Failed to resolve import "./cycle"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/period/cycle.ts
/**
 * The single definition of a period boundary in the product.
 *
 * Nothing else — TypeScript or SQL — derives one. The range functions in
 * 20260908120000_pay_cycle.sql take explicit p_start/p_end dates precisely so
 * that a period is computed once, here, and passed down.
 *
 * All arithmetic is on "YYYY-MM-DD" strings, following lib/budgets/month.ts:
 * a Date carries a time and a zone, and a period boundary that drifts by a day
 * across a timezone would silently move money between periods.
 */

export const PAY_CYCLE_VALUES = ["monthly", "semimonthly", "weekly"] as const;
export type PayCycle = (typeof PAY_CYCLE_VALUES)[number];

/** Inclusive on both ends. `end` is a real day the user can spend on. */
export type Period = { start: string; end: string };

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const parse = (date: string): [number, number, number] =>
  date.split("-").map(Number) as [number, number, number];

/** Days in a 1-indexed month. `new Date(y, m, 0)` is the last day of month m. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** `date` shifted by whole days, as a date-only string. Uses UTC so the shift
 *  can never land on a DST-shortened local day and lose an hour into the
 *  previous date. */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday, Monday = 1 … Sunday = 7. */
export function isoWeekday(date: string): number {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // Sunday = 0
  return dow === 0 ? 7 : dow;
}

/** The anchor day as it lands in a given month: a 31st anchor becomes the 30th
 *  in September rather than rolling into October. */
function anchorInMonth(year: number, month: number, anchor: number): number {
  return Math.min(anchor, daysInMonth(year, month));
}

export function periodFor(date: string, cycle: PayCycle, anchor: number | null): Period {
  const [y, m, d] = parse(date);

  if (cycle === "semimonthly") {
    // "The 15th and the end of the month", not "the 15th and the 30th" — which
    // is what makes February and the 31-day months fall out of one expression.
    return d <= 15
      ? { start: iso(y, m, 1), end: iso(y, m, 15) }
      : { start: iso(y, m, 16), end: iso(y, m, daysInMonth(y, m)) };
  }

  if (cycle === "weekly") {
    const target = anchor && anchor >= 1 && anchor <= 7 ? anchor : 1;
    // Days since the most recent anchor weekday, 0 when today is the anchor.
    const back = (isoWeekday(date) - target + 7) % 7;
    const start = addDays(date, -back);
    return { start, end: addDays(start, 6) };
  }

  // monthly
  const a = anchor && anchor >= 1 && anchor <= 31 ? anchor : 1;
  const thisMonthAnchor = anchorInMonth(y, m, a);
  // Before this month's anchor, the period began in the previous month.
  const [sy, sm] = d >= thisMonthAnchor ? [y, m] : m === 1 ? [y - 1, 12] : [y, m - 1];
  const start = iso(sy, sm, anchorInMonth(sy, sm, a));
  const [ny, nm] = sm === 12 ? [sy + 1, 1] : [sy, sm + 1];
  const end = addDays(iso(ny, nm, anchorInMonth(ny, nm, a)), -1);
  return { start, end };
}

/** The day the money arrives — the day after the current period ends. This is
 *  the date the Overview hero counts down to. */
export function nextPayday(date: string, cycle: PayCycle, anchor: number | null): string {
  return addDays(periodFor(date, cycle, anchor).end, 1);
}

/** The period `delta` steps away. Implemented by stepping off the end of the
 *  current period rather than by adding a fixed span, so a quincena of 15 days
 *  and one of 16 both land correctly. */
export function shiftPeriod(
  p: Period,
  cycle: PayCycle,
  anchor: number | null,
  delta: number,
): Period {
  let cur = p;
  for (let i = 0; i < Math.abs(delta); i++) {
    const probe = delta > 0 ? addDays(cur.end, 1) : addDays(cur.start, -1);
    cur = periodFor(probe, cycle, anchor);
  }
  return cur;
}

/** True when a period is exactly one calendar month — the case where the UI
 *  shows one budget figure instead of two, and where the page must look
 *  identical to today's. */
export function isWholeMonth(p: Period): boolean {
  const [sy, sm, sd] = parse(p.start);
  const [ey, em, ed] = parse(p.end);
  return sd === 1 && sy === ey && sm === em && ed === daysInMonth(ey, em);
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- lib/period/cycle.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/period/cycle.ts lib/period/cycle.test.ts
git commit -m "feat(period): the one place a period boundary is defined"
```

---

### Task 2: The migration — HARD STOP

Writes the schema and the range functions, then **stops**. The agent cannot push to the linked project; the human does. Nothing in Tasks 3–10 may begin until the push has landed and types are regenerated, because `lib/supabase/types.ts` would otherwise describe functions the remote does not have — code that compiles and 404s at runtime.

**Files:**
- Create: `supabase/migrations/20260908120000_pay_cycle.sql`
- Modify: `lib/supabase/types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing from Task 1 — SQL receives dates, not cycles.
- Produces, for Tasks 5–9:
  ```
  profiles.pay_cycle       public.pay_cycle not null default 'semimonthly'
  profiles.pay_anchor_day  smallint null
  card_status.latest_minimum_payment  numeric

  category_usage_range(p_start date, p_end date)
    -> (category_id uuid, budget_monthly numeric, budget numeric,
        used numeric, remaining numeric, status public.budget_status)
  uncategorized_spend_range(p_start date, p_end date) -> numeric
  spend_distribution_range(p_start date, p_end date) -> (category_id uuid, total numeric)
  spending_pace_range(p_start date, p_end date)
    -> (day_offset integer, this_period numeric, last_period numeric)
  cashflow_range(p_start date, p_end date) -> (income numeric, expense numeric)
  ```

- [ ] **Step 1: Write the schema half of the migration**

```sql
-- supabase/migrations/20260908120000_pay_cycle.sql
--
-- UX-05 and UX-06. Spec: docs/specs/2026-09-08-pay-cycle-safe-to-spend-design.md
--
-- Most of the DR is paid quincenal — the 15th and the end of the month. Every
-- aggregate in this schema buckets on date_trunc('month', occurred_at), so a
-- budget resets on the 1st and tells a user they are on track on the 14th
-- while they are actually broke.
--
-- The shape of the fix: each month-keyed routine gains a _range sibling
-- holding the real body, and the p_month signature becomes a thin wrapper over
-- it. Every current caller keeps working, and each inclusion rule still exists
-- in exactly one place — which matters here specifically, because
-- 20260822143000 exists because a TypeScript copy of one of these rules
-- drifted from the SQL one and shipped wrong figures.
--
-- Periods are NOT derived here. The app computes p_start/p_end in
-- lib/period/cycle.ts and passes them down, so a boundary is defined once.

create type public.pay_cycle as enum ('monthly', 'semimonthly', 'weekly');

alter table public.profiles
  add column pay_cycle       public.pay_cycle,
  add column pay_anchor_day  smallint;

-- Existing rows keep exactly today's behaviour rather than silently changing
-- period the moment this lands. The new default applies to new profiles only,
-- which is where "quincenal by default for a DOP base currency" belongs:
-- base_currency already defaults to DOP (CHK-02), so a new Dominican profile
-- now opens on a quincenal period without touching a setting.
update public.profiles set pay_cycle = 'monthly' where pay_cycle is null;

alter table public.profiles
  alter column pay_cycle set default 'semimonthly',
  alter column pay_cycle set not null;

-- The anchor's meaning depends on the cycle, so the check is written per cycle
-- rather than as one loose `between 1 and 31` that would accept a weekday of
-- 30. Consequence for the app: switching monthly -> semimonthly must null the
-- anchor in the same statement, or this rejects the write.
alter table public.profiles
  add constraint profiles_pay_anchor_day_valid check (
    (pay_cycle = 'semimonthly' and pay_anchor_day is null)
    or (pay_cycle = 'monthly' and pay_anchor_day between 1 and 31)
    or (pay_cycle = 'weekly'  and pay_anchor_day between 1 and 7)
  );

-- card_status does not expose the statement's minimum payment, and the
-- safe-to-spend figure needs it. The column lives on card_statements (added in
-- 20260722120000) and the lateral join here already picks the newest
-- statement, so this is one more column on that select. Appending is safe
-- under create or replace view — same move, same reasoning, as
-- 20260727140000_card_status_period_end.sql.
create or replace view public.card_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.current_balance as owed,
       a.credit_limit,
       case when a.credit_limit is null or a.credit_limit = 0 then null
            else round(a.current_balance / a.credit_limit * 100, 2) end as utilization_pct,
       s.statement_balance as latest_statement_balance,
       s.due_date          as latest_due_date,
       a.statement_closing_day,
       a.payment_due_day,
       s.period_end        as latest_period_end,
       s.minimum_payment   as latest_minimum_payment
from public.accounts a
left join lateral (
  select statement_balance, due_date, period_end, minimum_payment
  from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

comment on view public.card_status is
  'Credit cards with their newest statement (by period_end). latest_period_end '
  'is that statement''s closing date: payments occurring after it settle the '
  'statement, payments before it are already reflected in its balance. '
  'latest_minimum_payment is null when the bank printed no minimum — callers '
  'must fall back to the full amount due rather than inventing one.';
```

- [ ] **Step 2: Write `category_usage_range` and rewrite `category_usage` as its wrapper**

Append to the same file:

```sql
-- The budget surfaces' inclusion rule, unchanged from
-- 20260731130000_card_payment_default_and_cashflow.sql: expenses and payments,
-- excluding anything flagged exclude_from_budget.
--
-- occurred_at is timestamptz and every existing routine buckets it with
-- date_trunc(..., occurred_at), which resolves in the database's timezone. The
-- range predicate below is written `>= p_start and < p_end + 1` so its
-- implicit date-to-timestamptz cast lands on that same midnight boundary. Not
-- incidental: 20260822143000 exists partly because two charts on one page
-- bucketed in different timezones and disagreed about a late-night charge.
--
-- Proration: category_budgets keeps storing a MONTHLY amount and nothing about
-- that table changes. `budget` is that amount prorated onto the requested
-- range as the sum, over each month the range touches, of
--   amount(month) * overlapping_days(month) / days_in(month)
-- which covers a calendar month (factor 1), either half of a quincena, and a
-- week straddling two months with different budgets. `budget_monthly` is the
-- stored amount for the month containing p_start — the figure the UI shows
-- beside the prorated one ("RD$5,000/mes · RD$2,500 esta quincena"). Returning
-- both from one function is what stops the two numbers disagreeing.
create or replace function public.category_usage_range(p_start date, p_end date)
returns table (
  category_id    uuid,
  budget_monthly numeric,
  budget         numeric,
  used           numeric,
  remaining      numeric,
  status         public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    -- A malformed or unbounded range must not become a table scan.
    select p_start as s, p_end as e
    where p_end >= p_start and p_end - p_start <= 366
  ),
  months as (
    select gs::date as month,
           extract(day from (gs + interval '1 month' - interval '1 day'))::int as month_days,
           (least(b.e, (gs + interval '1 month' - interval '1 day')::date)
              - greatest(b.s, gs::date) + 1) as overlap_days
    from bounds b
    cross join generate_series(date_trunc('month', b.s),
                               date_trunc('month', b.e),
                               interval '1 month') gs
  ),
  budgets as (
    select cb.category_id,
           sum(cb.amount * mo.overlap_days::numeric / mo.month_days) as prorated,
           max(cb.amount) filter (
             where mo.month = (select date_trunc('month', s)::date from bounds)
           ) as monthly
    from months mo
    join public.category_budgets cb
      on cb.month = mo.month and cb.user_id = (select auth.uid())
    group by cb.category_id
  ),
  spend as (
    select t.category_id, sum(t.base_total_amount) as used
    from public.transactions t, bounds b
    where t.user_id = (select auth.uid())
      and t.category_id is not null
      and t.type in ('expense', 'payment')
      and not t.exclude_from_budget
      and t.occurred_at >= b.s
      and t.occurred_at <  b.e + 1
    group by t.category_id
  )
  select c.id as category_id,
         coalesce(bu.monthly, 0)  as budget_monthly,
         coalesce(bu.prorated, 0) as budget,
         coalesce(sp.used, 0)     as used,
         coalesce(bu.prorated, 0) - coalesce(sp.used, 0) as remaining,
         case
           when coalesce(sp.used, 0) > coalesce(bu.prorated, 0)
             then 'over'::public.budget_status
           when coalesce(bu.prorated, 0) > 0
             and coalesce(sp.used, 0) >= 0.9 * bu.prorated
             then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.categories c
  left join budgets bu on bu.category_id = c.id
  left join spend   sp on sp.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- The month signature becomes a wrapper. Its column list is unchanged from
-- 20260731130000, so every existing caller — lib/budgets/queries.ts,
-- lib/overview/queries.ts, the Insights budget bars — is untouched.
create or replace function public.category_usage(p_month date)
returns table (
  category_id uuid,
  budget      numeric,
  used        numeric,
  remaining   numeric,
  status      public.budget_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.category_id, r.budget, r.used, r.remaining, r.status
  from public.category_usage_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date
  ) r;
$$;
```

- [ ] **Step 3: Write the remaining three range functions and their wrappers**

Append to the same file:

```sql
-- Same inclusion rule as category_usage_range, on the rows it cannot reach:
-- category_usage joins FROM categories, so a null-category row can never
-- appear in it. Copied exactly, as in 20260819131444.
create or replace function public.uncategorized_spend_range(p_start date, p_end date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.base_total_amount), 0)
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.category_id is null
    and t.type in ('expense', 'payment')
    and not t.exclude_from_budget
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366;
$$;

create or replace function public.uncategorized_spend(p_month date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select public.uncategorized_spend_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date);
$$;

-- The accrual rule, unchanged from 20260822143000: an expense from whatever
-- account, plus a payment only when it retires a loan. Card payments are
-- dropped because the underlying charges are counted directly.
create or replace function public.spend_distribution_range(p_start date, p_end date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_total_amount) as total
  from public.transactions t
  left join public.accounts da on da.id = t.to_account_id
  where t.user_id = (select auth.uid())
    and (t.type = 'expense' or (t.type = 'payment' and da.type = 'loan'))
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366
  group by t.category_id
  order by total desc;
$$;

create or replace function public.spend_distribution(p_month date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.spend_distribution_range(
    date_trunc('month', p_month)::date,
    (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date);
$$;

-- Pace, keyed on day-offset from the period start rather than day-of-month, and
-- compared against the period immediately preceding this one. A quincena is
-- then paced against the previous quincena rather than against a month it does
-- not fit inside. Row count is the longer of the two periods; the shorter one's
-- column goes null past its own length, which is what tells the chart to stop
-- drawing that line.
create or replace function public.spending_pace_range(p_start date, p_end date)
returns table (day_offset integer, this_period numeric, last_period numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select p_start as s,
           p_end   as e,
           (p_end - p_start + 1)                     as cur_days,
           p_start - (p_end - p_start + 1)           as prev_s,
           p_start - 1                               as prev_e
    where p_end >= p_start and p_end - p_start <= 366
  ),
  spend as (
    select case when t.occurred_at >= b.s then 0 else 1 end as which,
           (t.occurred_at::date - case when t.occurred_at >= b.s then b.s else b.prev_s end)::int
             as dof,
           sum(t.base_total_amount) as amt
    from public.transactions t
    cross join bounds b
    left join public.accounts da on da.id = t.to_account_id
    where t.user_id = (select auth.uid())
      and (t.type = 'expense' or (t.type = 'payment' and da.type = 'loan'))
      and t.occurred_at >= b.prev_s
      and t.occurred_at <  b.e + 1
    group by 1, 2
  ),
  days as (
    select generate_series(0, (select cur_days from bounds) - 1) as d
  )
  select d.d as day_offset,
         (select coalesce(sum(s.amt), 0) from spend s where s.which = 0 and s.dof <= d.d)
           as this_period,
         (select coalesce(sum(s.amt), 0) from spend s where s.which = 1 and s.dof <= d.d)
           as last_period
  from days d
  order by d.d;
$$;

-- Cashflow over a range. monthly_cashflow (a view, keyed by month) is left
-- exactly as it is — Insights and Ask both still read it.
create or replace function public.cashflow_range(p_start date, p_end date)
returns table (income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when t.type = 'income' then t.base_amount else 0 end), 0) as income,
         coalesce(sum(case
                   when t.type = 'expense' and a.type not in ('credit_card', 'loan')
                     then t.base_total_amount
                   when t.type = 'payment' and da.type in ('credit_card', 'loan')
                     then t.base_total_amount
                   else 0 end), 0) as expense
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  left join public.accounts da on da.id = t.to_account_id
  where t.user_id = (select auth.uid())
    and t.occurred_at >= p_start
    and t.occurred_at <  p_end + 1
    and p_end >= p_start
    and p_end - p_start <= 366;
$$;
```

- [ ] **Step 4: HARD STOP — hand the migration to the human**

The agent cannot push. Print this and wait:

> The migration `supabase/migrations/20260908120000_pay_cycle.sql` is written and needs pushing before any UI work can start:
> ```bash
> ./node_modules/.bin/supabase db push --linked
> ```

Do not proceed to Step 5 until the human confirms the push.

- [ ] **Step 5: Confirm the migration is applied**

Run: `./node_modules/.bin/supabase migration list --linked`
Expected: `20260908120000` shows a value in the `remote` column. If it does not, **stop** — go back to Step 4.

- [ ] **Step 6: Regenerate types from the remote, not from a local stack**

```bash
./node_modules/.bin/supabase gen types typescript --linked > lib/supabase/types.ts
```

Verify: `grep -c "pay_cycle\|category_usage_range\|latest_minimum_payment" lib/supabase/types.ts` returns a non-zero count.

- [ ] **Step 7: Verify the wrappers are equivalent — the load-bearing check**

This repo has no SQL test harness (spec §9), so this is a one-time read-only verification against the linked project rather than an automated test. Run each and confirm **zero rows** come back:

```bash
./node_modules/.bin/supabase db query --linked "
  select 'category_usage' as fn, * from (
    select * from public.category_usage('2026-09-01')
    except select * from public.category_usage_range('2026-09-01','2026-09-30')) x
  union all
  select 'category_usage_rev', * from (
    select * from public.category_usage_range('2026-09-01','2026-09-30')
    except select * from public.category_usage('2026-09-01')) y;"
```

Then confirm the proration identities:

```bash
./node_modules/.bin/supabase db query --linked "
  -- a whole month prorates to a factor of exactly 1
  select 'whole-month' as check,
         bool_and(budget = budget_monthly) as ok
  from public.category_usage_range('2026-08-01','2026-08-31')
  union all
  -- both quincenas of a 31-day month sum back to the stored monthly amount
  select 'quincenas-sum',
         bool_and(abs(h1.budget + h2.budget - h1.budget_monthly) < 0.01)
  from public.category_usage_range('2026-08-01','2026-08-15') h1
  join public.category_usage_range('2026-08-16','2026-08-31') h2
    on h2.category_id = h1.category_id;"
```

Expected: no rows from the first, `ok = true` for both checks in the second.

- [ ] **Step 8: Leave Ask alone, and confirm it**

`lib/ask/guard.ts` allowlists the relations the model may query. The new `_range` functions are
deliberately **not** added to it (spec §10): Ask keeps its month-keyed vocabulary, and teaching it a
second one is a prompt-and-schema-doc change with its own query budget. Confirm nothing drifted in:

```bash
grep -c "_range" lib/ask/guard.ts lib/ask/schema-doc.md
```
Expected: `0` for both.

- [ ] **Step 9: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: both clean. Do not start Task 3 until they are.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260908120000_pay_cycle.sql lib/supabase/types.ts
git commit -m "feat(db): a period the user's money obeys, and the minimum it owes"
```

---

### Task 3: `lib/period/profile.ts` — reading the cycle off a profile row

The defaulting layer, mirroring `baseCurrencyOf` in `lib/profile.ts`: one place decides what a period is when the profile row hasn't loaded.

**Files:**
- Create: `lib/period/profile.ts`
- Test: `lib/period/profile.test.ts`

**Interfaces:**
- Consumes: `PayCycle`, `Period`, `periodFor` from `lib/period/cycle.ts` (Task 1).
- Produces:
  ```ts
  export type PayCycleProfile = { pay_cycle?: string | null; pay_anchor_day?: number | null };
  export function payCycleOf(profile: PayCycleProfile | null | undefined): PayCycle;
  export function payAnchorOf(profile: PayCycleProfile | null | undefined): number | null;
  export function currentPeriod(profile: PayCycleProfile | null | undefined, today: string): Period;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/period/profile.test.ts
import { describe, it, expect } from "vitest";
import { payCycleOf, payAnchorOf, currentPeriod } from "./profile";

describe("payCycleOf", () => {
  it("reads the profile's cycle", () => {
    expect(payCycleOf({ pay_cycle: "semimonthly" })).toBe("semimonthly");
  });

  it("falls back to monthly for a profile that has not loaded", () => {
    // Deliberately monthly, not the column default: an unloaded profile must
    // render today's app, never a period the user did not choose.
    expect(payCycleOf(null)).toBe("monthly");
    expect(payCycleOf(undefined)).toBe("monthly");
    expect(payCycleOf({})).toBe("monthly");
  });

  it("falls back to monthly for an unrecognised value", () => {
    expect(payCycleOf({ pay_cycle: "fortnightly" })).toBe("monthly");
  });
});

describe("payAnchorOf", () => {
  it("reads the anchor", () => {
    expect(payAnchorOf({ pay_cycle: "monthly", pay_anchor_day: 25 })).toBe(25);
  });

  it("is null when absent", () => {
    expect(payAnchorOf({ pay_cycle: "semimonthly" })).toBeNull();
    expect(payAnchorOf(null)).toBeNull();
  });
});

describe("currentPeriod", () => {
  it("gives a quincenal profile the half it is in", () => {
    expect(currentPeriod({ pay_cycle: "semimonthly" }, "2026-09-08")).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
    });
  });

  it("gives an unloaded profile the calendar month", () => {
    expect(currentPeriod(null, "2026-09-08")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- lib/period/profile.test.ts`
Expected: FAIL — `Failed to resolve import "./profile"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/period/profile.ts
import { PAY_CYCLE_VALUES, periodFor, type PayCycle, type Period } from "./cycle";

export type PayCycleProfile = {
  pay_cycle?: string | null;
  pay_anchor_day?: number | null;
};

/**
 * The cycle a profile is paid on, defaulted in one place.
 *
 * The fallback is `monthly`, NOT the column's `semimonthly` default, and the
 * difference is deliberate. The column default decides what a new row is
 * created with; this decides what to render when the row has not loaded. A
 * failed profile read must show the user today's app, not silently re-scope
 * their budget to a period they never chose.
 */
export function payCycleOf(profile: PayCycleProfile | null | undefined): PayCycle {
  const value = profile?.pay_cycle;
  return (PAY_CYCLE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as PayCycle)
    : "monthly";
}

export function payAnchorOf(profile: PayCycleProfile | null | undefined): number | null {
  return profile?.pay_anchor_day ?? null;
}

/** The period a profile is in on `today` ("YYYY-MM-DD"). */
export function currentPeriod(
  profile: PayCycleProfile | null | undefined,
  today: string,
): Period {
  return periodFor(today, payCycleOf(profile), payAnchorOf(profile));
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- lib/period/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/period/profile.ts lib/period/profile.test.ts
git commit -m "feat(period): default an unloaded profile to today's behaviour"
```

---

### Task 4: `lib/overview/available.ts` — safe to spend

The pure composition. No Supabase client, tested with hand-built rows in the style of `lib/overview/card-due.test.ts`.

**Files:**
- Create: `lib/overview/available.ts`
- Test: `lib/overview/available.test.ts`

**Interfaces:**
- Consumes: `cardAmountDue` from `lib/overview/card-due.ts`.
- Produces:
  ```ts
  export type LiquidAccount = { accountId: string; type: string; available: number; currency: string };
  export type CardInput = {
    accountId: string; name: string; currency: string;
    statementBalance: number | null; owed: number | null;
    paidSinceStatement: number; minimumPayment: number | null;
  };
  export type DueInput = { amount: number; currency: string; date: string | null };
  export type CardBasis = { accountId: string; name: string; basis: "minimum" | "full" };
  export type Available = { /* see Step 3 */ };
  export const LIQUID_ACCOUNT_TYPES: readonly string[];
  export function computeAvailable(input: AvailableInput): Available;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/overview/available.test.ts
import { describe, it, expect } from "vitest";
import { computeAvailable, LIQUID_ACCOUNT_TYPES } from "./available";

const base = {
  periodEnd: "2026-09-30",
  toBase: (amount: number) => amount, // single-currency by default
  accounts: [] as Parameters<typeof computeAvailable>[0]["accounts"],
  cards: [] as Parameters<typeof computeAvailable>[0]["cards"],
  loans: [] as Parameters<typeof computeAvailable>[0]["loans"],
  subscriptions: [] as Parameters<typeof computeAvailable>[0]["subscriptions"],
  fxUnconverted: [] as string[],
};

const acct = (type: string, balance: number, committed = 0, id = type) => ({
  accountId: id,
  type,
  balance,
  committed,
  currency: "DOP",
});

describe("LIQUID_ACCOUNT_TYPES", () => {
  it("is cash-like accounts only — an investment or a car is net worth, not spendable", () => {
    expect([...LIQUID_ACCOUNT_TYPES].sort()).toEqual(["cash", "checking", "savings"]);
  });
});

describe("computeAvailable · the liquid leg", () => {
  it("sums checking, savings and cash", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 30000), acct("savings", 15000), acct("cash", 2200)],
    });
    expect(r.liquid).toBe(47200);
    expect(r.available).toBe(47200);
  });

  it("excludes investment and asset accounts", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 30000), acct("investment", 500000), acct("asset", 1200000)],
    });
    expect(r.liquid).toBe(30000);
  });

  it("is zero when there are no liquid accounts at all", () => {
    const r = computeAvailable({ ...base, accounts: [acct("investment", 500000)] });
    expect(r.liquid).toBe(0);
    expect(r.available).toBe(0);
  });

  it("shows goal commitments as their own line rather than netting them into the balance", () => {
    // computeFunding clamped this account to 8000 committed of a 30000 balance.
    // The user sees both figures, so the hero being smaller than their bank
    // app's balance has a visible reason.
    const r = computeAvailable({ ...base, accounts: [acct("checking", 30000, 8000)] });
    expect(r.liquid).toBe(30000);
    expect(r.committed).toBe(8000);
    expect(r.available).toBe(22000);
  });
});

describe("computeAvailable · the card leg", () => {
  const card = (over: Partial<Parameters<typeof computeAvailable>[0]["cards"][number]>) => ({
    accountId: "c1",
    name: "Popular",
    currency: "DOP",
    statementBalance: 40000,
    owed: 45000,
    paidSinceStatement: 0,
    minimumPayment: null,
    ...over,
  });

  it("subtracts the printed minimum and records the basis", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(6750);
    expect(r.cardsFull).toBe(40000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "minimum" }]);
    expect(r.available).toBe(43250);
    expect(r.availableIfCardsCleared).toBe(10000);
  });

  it("subtracts the full amount due when the bank printed no minimum", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ minimumPayment: null })],
    });
    expect(r.cardsMinimum).toBe(40000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "full" }]);
  });

  it("clamps the minimum to what is actually still owed", () => {
    // Statement 40000, already paid 38000, printed minimum 6750. You owe 2000,
    // not 6750 — subtracting the printed figure would invent debt.
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ paidSinceStatement: 38000, minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(2000);
    expect(r.cardsFull).toBe(2000);
  });

  it("drops a settled card entirely", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ paidSinceStatement: 40000, minimumPayment: 6750 })],
    });
    expect(r.cardsMinimum).toBe(0);
    expect(r.cardBasis).toEqual([]);
    expect(r.available).toBe(50000);
  });

  it("falls back to the live balance for a card that has never been imported", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      cards: [card({ statementBalance: null, owed: 12000, minimumPayment: null })],
    });
    expect(r.cardsMinimum).toBe(12000);
    expect(r.cardBasis).toEqual([{ accountId: "c1", name: "Popular", basis: "full" }]);
  });
});

describe("computeAvailable · the dated legs", () => {
  it("counts loans and subscriptions due on or before the period end", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      loans: [{ amount: 9500, currency: "DOP", date: "2026-09-28" }],
      subscriptions: [{ amount: 4500, currency: "DOP", date: "2026-09-30" }],
    });
    expect(r.loans).toBe(9500);
    expect(r.subscriptions).toBe(4500);
    expect(r.available).toBe(36000);
  });

  it("ignores charges falling after the period ends", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      subscriptions: [{ amount: 4500, currency: "DOP", date: "2026-10-01" }],
    });
    expect(r.subscriptions).toBe(0);
  });

  it("ignores an undated charge rather than guessing when it lands", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 50000)],
      subscriptions: [{ amount: 4500, currency: "DOP", date: null }],
    });
    expect(r.subscriptions).toBe(0);
  });
});

describe("computeAvailable · composition", () => {
  it("goes negative rather than clamping to zero", () => {
    const r = computeAvailable({
      ...base,
      accounts: [acct("checking", 5000)],
      loans: [{ amount: 9500, currency: "DOP", date: "2026-09-28" }],
    });
    expect(r.available).toBe(-4500);
  });

  it("converts every leg through toBase", () => {
    const r = computeAvailable({
      ...base,
      toBase: (amount, currency) => (currency === "USD" ? amount * 60 : amount),
      accounts: [{ accountId: "u", type: "checking", balance: 100, committed: 0, currency: "USD" }],
      subscriptions: [{ amount: 10, currency: "USD", date: "2026-09-20" }],
    });
    expect(r.liquid).toBe(6000);
    expect(r.subscriptions).toBe(600);
    expect(r.available).toBe(5400);
  });

  it("passes fxUnconverted through so the page can warn without a second source", () => {
    const r = computeAvailable({ ...base, fxUnconverted: ["EUR"] });
    expect(r.fxUnconverted).toEqual(["EUR"]);
  });

  it("carries the period end it was given", () => {
    expect(computeAvailable(base).periodEnd).toBe("2026-09-30");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- lib/overview/available.test.ts`
Expected: FAIL — `Failed to resolve import "./available"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/overview/available.ts
/**
 * "Disponible hasta el <payday>" — the figure that answers the question people
 * actually ask ten times a day, which is not "what am I worth" but "can I
 * spend this?".
 *
 * Pure, and kept out of queries.ts so it can be tested without a Supabase
 * client — same split as card-due.ts. Every input here is a row getOverview
 * already fetches; this file composes, it does not query.
 */
import { cardAmountDue } from "./card-due";

/** Cash-like accounts only. An investment position and a car are net worth,
 *  not money you can spend before payday — the audit's "it includes a car". */
export const LIQUID_ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;

export type LiquidAccount = {
  accountId: string;
  type: string;
  balance: number;
  /** computeFunding's clamped commitment for this account — money that is
   *  present but spoken for by a goal. Carried as its own figure rather than
   *  netted into the balance, so the breakdown can show the user why the hero
   *  is smaller than the balance their bank app shows them. */
  committed: number;
  currency: string;
};

export type CardInput = {
  accountId: string;
  name: string;
  currency: string;
  statementBalance: number | null;
  owed: number | null;
  paidSinceStatement: number;
  /** Null when the bank printed no minimum. Never inferred from a percentage:
   *  no issuer in this market publishes one rule, and a guessed minimum would
   *  make the headline figure a fiction. */
  minimumPayment: number | null;
};

export type DueInput = { amount: number; currency: string; date: string | null };

export type CardBasis = { accountId: string; name: string; basis: "minimum" | "full" };

export type AvailableInput = {
  /** Inclusive last day of the period; "YYYY-MM-DD". */
  periodEnd: string;
  toBase: (amount: number, currency: string) => number;
  accounts: LiquidAccount[];
  cards: CardInput[];
  loans: DueInput[];
  subscriptions: DueInput[];
  fxUnconverted: string[];
};

export type Available = {
  periodEnd: string;
  liquid: number;
  committed: number;
  cardsMinimum: number;
  cardsFull: number;
  loans: number;
  subscriptions: number;
  /** The hero. Minimum basis. */
  available: number;
  /** The line beneath it. Full basis. */
  availableIfCardsCleared: number;
  cardBasis: CardBasis[];
  fxUnconverted: string[];
};

/** Only charges with a known date on or before the period end. An undated row
 *  is skipped rather than assumed to fall inside — refuse rather than guess. */
function dueBy(rows: DueInput[], periodEnd: string, toBase: AvailableInput["toBase"]): number {
  return rows.reduce(
    (sum, r) => (r.date && r.date.slice(0, 10) <= periodEnd ? sum + toBase(r.amount, r.currency) : sum),
    0,
  );
}

export function computeAvailable(input: AvailableInput): Available {
  const { periodEnd, toBase } = input;

  let liquid = 0;
  let committed = 0;
  for (const a of input.accounts) {
    if (!(LIQUID_ACCOUNT_TYPES as readonly string[]).includes(a.type)) continue;
    liquid += toBase(a.balance, a.currency);
    committed += toBase(a.committed, a.currency);
  }

  let cardsMinimum = 0;
  let cardsFull = 0;
  const cardBasis: CardBasis[] = [];

  for (const c of input.cards) {
    // Null once settled — a paid-off card contributes nothing and is not
    // listed, exactly as it drops off the Upcoming list.
    const due = cardAmountDue(c.statementBalance, c.owed, c.paidSinceStatement);
    if (due == null) continue;

    // Clamp to what is still owed: a user who has already paid below the
    // printed minimum owes the remainder, not the printed figure.
    const hasMinimum = c.minimumPayment != null;
    const minimum = hasMinimum ? Math.min(Number(c.minimumPayment), due) : due;

    cardsFull += toBase(due, c.currency);
    cardsMinimum += toBase(minimum, c.currency);
    cardBasis.push({
      accountId: c.accountId,
      name: c.name,
      basis: hasMinimum ? "minimum" : "full",
    });
  }

  const loans = dueBy(input.loans, periodEnd, toBase);
  const subscriptions = dueBy(input.subscriptions, periodEnd, toBase);
  const fixed = loans + subscriptions;

  return {
    periodEnd,
    liquid,
    committed,
    cardsMinimum,
    cardsFull,
    loans,
    subscriptions,
    // Deliberately not clamped at zero. A negative number is information: it
    // says the period is already over-committed, which is the whole point.
    available: liquid - committed - cardsMinimum - fixed,
    availableIfCardsCleared: liquid - committed - cardsFull - fixed,
    cardBasis,
    fxUnconverted: input.fxUnconverted,
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- lib/overview/available.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/overview/available.ts lib/overview/available.test.ts
git commit -m "feat(overview): the figure that answers can I spend this"
```

---

### Task 5: Wire `getOverview` to produce `Available`

**Files:**
- Modify: `lib/overview/queries.ts` (the `Overview` type and `getOverview`)

**Interfaces:**
- Consumes: `computeAvailable` (Task 4), `currentPeriod` (Task 3), `computeFunding` from `lib/goals/funding.ts`.
- Produces: `Overview.available: Available` and `Overview.period: Period`, read by Task 6.

- [ ] **Step 1: Widen the queries `getOverview` already makes**

Four changes to the existing `Promise.all`, and one addition:

1. `profiles` select gains the cycle: `.select("base_currency,display_name,pay_cycle,pay_anchor_day")`.
2. `accounts` select gains the type: `.select("id,name,currency,type")` — it does not fetch `type` today and the liquid leg needs it.
3. `card_status` select gains `latest_minimum_payment`.
4. `monthly_cashflow` is replaced by `supabase.rpc("cashflow_range", { p_start: period.start, p_end: period.end })`, and `category_usage` by `category_usage_range` with the same bounds.
5. A new query for goal contributions, so `computeFunding` can run:
   ```ts
   supabase
     .from("goal_contributions")
     .select("id,goal_id,account_id,amount,base_amount,occurred_at"),
   ```

The period must be resolved before the RPCs that need it, so read the profile first and the rest after — or resolve the period from a cheap profile read ahead of the `Promise.all`. Prefer the latter; one extra round trip on the most-viewed page is worth less than a correct period.

**Critical:** `computeFunding` must be given **all** of the user's contributions and **all** balances, never a subset. Its borrow-back allocation depends on every goal sharing an account; narrowing the input silently changes `backed`/`shortfall`. `lib/goals/queries.ts:147` documents this. Pass the full sets and read only the accounts you need out of the result.

- [ ] **Step 2: Compose the figure**

```ts
const period = currentPeriod(profile, new Date().toISOString().slice(0, 10));

const funding = computeFunding(
  contributionRows,
  (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
);

const available = computeAvailable({
  periodEnd: period.end,
  toBase,
  accounts: (accounts ?? []).map((a) => {
    // funding.accounts is keyed off the balance rows, so every account with a
    // balance has an entry. An account with no contributions has committed 0.
    const f = funding.accounts.get(a.id);
    return {
      accountId: a.id,
      type: a.type,
      balance:
        f?.balance ??
        Number((balances ?? []).find((b) => b.account_id === a.id)?.balance ?? 0),
      committed: f?.committed ?? 0,
      currency: a.currency,
    };
  }),
  cards: (cards ?? []).map((c) => ({
    accountId: c.account_id ?? "",
    name: acctById.get(c.account_id ?? "")?.name ?? "",
    currency: c.currency ?? baseCurrency,
    statementBalance: c.latest_statement_balance,
    owed: c.owed,
    paidSinceStatement: cardPaid.get(c.account_id ?? "") ?? 0,
    minimumPayment: c.latest_minimum_payment,
  })),
  loans: (loans ?? []).map((l) => ({
    amount: Number(l.installment_amount ?? 0),
    currency: l.currency ?? baseCurrency,
    date: nextDue(l.payment_due_day)?.toISOString().slice(0, 10) ?? null,
  })),
  subscriptions: (subs ?? []).map((s) => ({
    amount: Number(s.amount),
    currency: s.currency,
    date:
      nextChargeDate(s.billing_cycle as BillingCycle, s.anchor_day)
        ?.toISOString()
        .slice(0, 10) ?? null,
  })),
  fxUnconverted,
});
```

Add `available` and `period` to the returned object and to the `Overview` type. Keep `netWorth` exactly as it is — it is demoted in the UI, not removed.

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: both clean. `card-due.test.ts` and `import-prompt.test.ts` must still pass untouched.

- [ ] **Step 4: Commit**

```bash
git add lib/overview/queries.ts
git commit -m "feat(overview): compose the available figure from rows already fetched"
```

---

### Task 6: The Overview hero

**Files:**
- Create: `components/overview/available-hero.tsx`
- Modify: `app/(app)/page.tsx:123-129` (the net-worth `HeroCard` block)
- Modify: `messages/es.json`, `messages/en.json`

**Interfaces:**
- Consumes: `Overview.available` (Task 5).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the Spanish copy first, then the English**

Add under `Overview` in `messages/es.json`:

```json
"availableLabel": "Disponible hasta el {date}",
"availableIfCleared": "{amount} si saldas las tarjetas",
"availableLiquid": "Balance líquido",
"availableCommitted": "Metas comprometidas",
"availableCards": "Tarjetas (mínimo)",
"availableLoans": "Préstamos",
"availableSubscriptions": "Suscripciones",
"availableBasisMinimum": "{name} · mínimo del estado",
"availableBasisFull": "{name} · total, sin mínimo impreso",
"availableBreakdownToggle": "Ver el desglose",
"netWorthSecondary": "Patrimonio neto"
```

Then the same keys in `messages/en.json`:

```json
"availableLabel": "Available until {date}",
"availableIfCleared": "{amount} if you clear your cards",
"availableLiquid": "Liquid balance",
"availableCommitted": "Committed to goals",
"availableCards": "Cards (minimum)",
"availableLoans": "Loans",
"availableSubscriptions": "Subscriptions",
"availableBasisMinimum": "{name} · statement minimum",
"availableBasisFull": "{name} · full balance, no minimum printed",
"availableBreakdownToggle": "See the breakdown",
"netWorthSecondary": "Net worth"
```

The payday is interpolated as `{date}`, never concatenated — Spanish and English order it differently.

- [ ] **Step 2: Build the hero component**

`HeroCard` takes `{ label, children, action?, className? }` and renders `label` itself, so the payday
line is the label and everything else is `children`. `MoneyDisplay` takes
`{ amount, currency, size, animate?, className? }` and already honours the figure mask, so every
figure below goes through it rather than a hand-formatted string.

```tsx
// components/overview/available-hero.tsx
import { useTranslations, useFormatter } from "next-intl";
import { HeroCard } from "@/components/hero-card";
import { MoneyDisplay } from "@/components/ui/money-display";
import type { Available } from "@/lib/overview/available";

function Row({
  label,
  amount,
  currency,
  negate = true,
}: {
  label: string;
  amount: number;
  currency: string;
  negate?: boolean;
}) {
  if (amount === 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="opacity-80">{label}</span>
      <MoneyDisplay amount={negate ? -amount : amount} currency={currency} size="row" />
    </div>
  );
}

export function AvailableHero({
  available: a,
  netWorth,
  currency,
}: {
  available: Available;
  netWorth: number;
  currency: string;
}) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  // Interpolated, never concatenated: es and en order the date differently.
  const date = f.dateTime(new Date(`${a.periodEnd}T00:00:00Z`), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return (
    <HeroCard label={t("availableLabel", { date })}>
      <MoneyDisplay amount={a.available} currency={currency} size="hero" animate />

      {/* Only when the two bases actually differ — with no card debt they are
          the same number, and printing it twice reads as a rendering bug. */}
      {a.cardsFull !== a.cardsMinimum ? (
        <p className="mt-1 text-sm opacity-70">
          {t.rich("availableIfCleared", {
            amount: () => (
              <MoneyDisplay
                amount={a.availableIfCardsCleared}
                currency={currency}
                size="row"
              />
            ),
          })}
        </p>
      ) : null}

      <div className="mt-6 space-y-1.5">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="opacity-80">{t("availableLiquid")}</span>
          <MoneyDisplay amount={a.liquid} currency={currency} size="row" />
        </div>
        <Row label={t("availableCommitted")} amount={a.committed} currency={currency} />
        <Row label={t("availableCards")} amount={a.cardsMinimum} currency={currency} />
        {a.cardBasis.map((c) => (
          <p key={c.accountId} className="pl-3 text-xs opacity-60">
            {t(c.basis === "minimum" ? "availableBasisMinimum" : "availableBasisFull", {
              name: c.name,
            })}
          </p>
        ))}
        <Row label={t("availableLoans")} amount={a.loans} currency={currency} />
        <Row label={t("availableSubscriptions")} amount={a.subscriptions} currency={currency} />
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-white/15 pt-4 text-sm">
        <span className="opacity-80">{t("netWorthSecondary")}</span>
        <MoneyDisplay amount={netWorth} currency={currency} size="stat" />
      </div>
    </HeroCard>
  );
}
```

Three things to settle while building it:

- **`size="row"` may not exist.** `MoneyDisplay`'s `size` is `keyof typeof SIZES` in
  `components/ui/money-display.tsx`. Read that map first and use whichever key is the small inline
  one; add a key only if none fits, and match the existing naming.
- **A negative `available`** takes whatever treatment `budget_status: "over"` already uses on the
  budget bars. Reuse it; do not introduce a new colour. The voice stays calm — a negative figure is
  information, not a scolding.
- **Below `sm`** the breakdown collapses behind `availableBreakdownToggle`, toggled with `el.hidden`
  rather than a re-render. Both headline figures stay visible at every width.

- [ ] **Step 3: Swap it into the page**

Replace the `HeroCard` block at `app/(app)/page.tsx:123-129`. Leave the `hasAccounts === false` early return above it untouched — that screen belongs to the import prompt and has nothing to compose. Leave `FxDegradedNotice` directly beneath the hero; its comment says it sits under the figure a 1:1 fallback distorts most, and that is now this one.

- [ ] **Step 4: Verify both catalogues have every key**

```bash
node -e "
const en=require('./messages/en.json').Overview, es=require('./messages/es.json').Overview;
const a=Object.keys(en), b=Object.keys(es);
const miss=[...a.filter(k=>!b.includes(k)).map(k=>'es misses '+k),
            ...b.filter(k=>!a.includes(k)).map(k=>'en misses '+k)];
console.log(miss.length?miss.join('\n'):'parity ok');"
```
Expected: `parity ok`.

- [ ] **Step 5: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npx eslint app components lib`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add components/overview/available-hero.tsx app/\(app\)/page.tsx messages/en.json messages/es.json
git commit -m "feat(overview): lead with what you can spend, not what you are worth"
```

---

### Task 7: Budgets on a period

**Files:**
- Modify: `lib/budgets/queries.ts` (`getBudgetOverview`)
- Modify: `app/(app)/budgets/page.tsx`
- Modify: `components/budgets/budget-grid.tsx`
- Create: `components/budgets/period-picker.tsx`
- Modify: `messages/es.json`, `messages/en.json`
- Test: `lib/budgets/queries.test.ts` (extend)

**Interfaces:**
- Consumes: `Period`, `shiftPeriod`, `isWholeMonth` (Task 1), `currentPeriod` (Task 3), `category_usage_range` / `uncategorized_spend_range` (Task 2).
- Produces: `BudgetRow.budget_monthly`, `BudgetOverview.period`.

- [ ] **Step 1: Write the failing test for the label rule**

The rule worth a test of its own: a whole-month period shows one figure, anything else shows two. Extract it as a pure function so it is testable.

```ts
// in lib/budgets/queries.test.ts
import { budgetLabelParts } from "./queries";

describe("budgetLabelParts", () => {
  it("shows one figure for a whole calendar month — today's page, unchanged", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-30" }, 5000, 5000),
    ).toEqual({ monthly: 5000, prorated: null });
  });

  it("shows both figures for a quincena", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 5000, 2500),
    ).toEqual({ monthly: 5000, prorated: 2500 });
  });

  it("shows one figure when nothing is budgeted, rather than 0 of 0", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 0, 0),
    ).toEqual({ monthly: 0, prorated: null });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `npm test -- lib/budgets/queries.test.ts`
Expected: FAIL — `budgetLabelParts is not a function`.

- [ ] **Step 3: Implement `budgetLabelParts` and make `getBudgetOverview` period-aware**

```ts
/** Which budget figures a row shows. A whole calendar month shows the stored
 *  amount alone — that is today's page and it must not change. Anything else
 *  shows the stored monthly rate and what it prorates to, so the derived
 *  number never appears without the number it came from. */
export function budgetLabelParts(
  period: Period,
  monthly: number,
  prorated: number,
): { monthly: number; prorated: number | null } {
  if (monthly === 0) return { monthly, prorated: null };
  return { monthly, prorated: isWholeMonth(period) ? null : prorated };
}
```

`getBudgetOverview(month: string)` becomes `getBudgetOverview(period: Period)`, calling `category_usage_range` and `uncategorized_spend_range` with `period.start` / `period.end`. `BudgetRow` gains `budget_monthly`. `BudgetOverview` gains `period`.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- lib/budgets/queries.test.ts`
Expected: PASS. The existing `newestPendingImport` cases must still pass untouched.

- [ ] **Step 5: The page and the picker**

`app/(app)/budgets/page.tsx` accepts `?from=&to=` and still accepts `?month=`, resolving in this order: explicit `from`/`to` → `month` normalised to that calendar month → the profile's `currentPeriod`. Existing links and bookmarks keep resolving.

`components/budgets/period-picker.tsx` replaces the month arrows in `budget-grid.tsx:174`, driven by `shiftPeriod`. It carries a two-way toggle between the calendar month and the profile's own cycle — labelled **Mes / Quincena** for a `semimonthly` profile and **Mes / Semana** for a `weekly` one — and is **hidden entirely for a `monthly` profile**, where both sides render the same thing. Keep the existing `router.push(..., { scroll: false })` behaviour and the comment explaining why.

`copyPreviousMonth` keeps operating on months, because `category_budgets` still stores months. If the active period is not a whole month, it copies into the month containing `period.start`.

- [ ] **Step 6: Copy, in Spanish first**

`messages/es.json` under `Budgets`: `periodMonth` ("Mes"), `periodSemimonthly` ("Quincena"), `periodWeekly` ("Semana"), `budgetProrated` ("{monthly}/mes · {prorated} esta quincena"), `budgetProratedWeekly` ("{monthly}/mes · {prorated} esta semana"). Then the English equivalents. Run the parity check from Task 6 Step 4 against the `Budgets` namespace.

- [ ] **Step 7: The constraint that makes this safe — verify the monthly path is unchanged**

With a `monthly` profile, `/budgets` must render exactly as it does on `main`: no picker toggle, one budget figure per row, the same month arrows. Check it in the browser:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix cashly)"
agent-browser --session "$SESSION" --restore open http://localhost:3000/budgets
agent-browser --session "$SESSION" snapshot -i
```

- [ ] **Step 8: Typecheck, test, lint, commit**

```bash
npx tsc --noEmit && npm test && npx eslint app components lib
git add lib/budgets/queries.ts lib/budgets/queries.test.ts app/\(app\)/budgets/page.tsx components/budgets/ messages/en.json messages/es.json
git commit -m "feat(budgets): a period that resets when the money arrives"
```

---

### Task 8: The pay-cycle setting

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/settings/actions.ts`
- Modify: `messages/es.json`, `messages/en.json`

**Interfaces:**
- Consumes: `PAY_CYCLE_VALUES` (Task 1).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: The action**

```ts
// app/(app)/settings/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { PAY_CYCLE_VALUES, type PayCycle } from "@/lib/period/cycle";

const ANCHOR_RANGE: Record<PayCycle, [number, number] | null> = {
  monthly: [1, 31],
  weekly: [1, 7],
  semimonthly: null, // fixed at the 15th and the end of the month
};

export async function setPayCycle(input: {
  cycle: string;
  anchorDay: number | null;
}): Promise<{ error?: string }> {
  // Validated against the enum rather than trusted: this string arrives from a
  // form and goes into a typed column.
  if (!(PAY_CYCLE_VALUES as readonly string[]).includes(input.cycle)) {
    return { error: "invalidCycle" };
  }
  const cycle = input.cycle as PayCycle;
  const range = ANCHOR_RANGE[cycle];

  // profiles_pay_anchor_day_valid requires a NULL anchor for semimonthly and
  // rejects the write otherwise, so null it here rather than leaving a stale
  // anchor behind from a previous monthly setting.
  const anchorDay =
    range === null
      ? null
      : input.anchorDay != null && input.anchorDay >= range[0] && input.anchorDay <= range[1]
        ? input.anchorDay
        : range[0];

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "notAuthenticated" };

  // Scoped to the caller's own row; RLS is the backstop, not the check.
  const { error } = await supabase
    .from("profiles")
    .update({ pay_cycle: cycle, pay_anchor_day: anchorDay })
    .eq("id", user.user.id);
  if (error) return dbError(error, "setPayCycle");

  // Every period-scoped surface re-reads the cycle.
  revalidatePath("/", "layout");
  return {};
}
```

Match the existing actions in this file for the auth and revalidate idiom — read one before writing
this, and follow it rather than the sketch above where they differ.

- [ ] **Step 2: The control**

A segmented control — *Mensual / Quincenal / Semanal* — with an anchor-day input that appears only for `monthly` (day of month) and `weekly` (weekday), and not at all for `semimonthly`, whose days are fixed at the 15th and the end of the month. One line of help text saying which days the choice means.

- [ ] **Step 3: Copy, Spanish first, then the parity check from Task 6 Step 4.**

- [ ] **Step 4: Verify the constraint holds end to end**

Set the profile to `monthly` with anchor 25, then switch to `quincenal`, then back. No write may be rejected. Then confirm the stored row:

```bash
./node_modules/.bin/supabase db query --linked \
  "select pay_cycle, pay_anchor_day from public.profiles;"
```
Expected: `semimonthly` rows have a null anchor.

- [ ] **Step 5: Typecheck, test, lint, commit**

```bash
npx tsc --noEmit && npm test && npx eslint app components lib
git add app/\(app\)/settings/ messages/en.json messages/es.json
git commit -m "feat(settings): say when you get paid"
```

---

### Task 9: The spending-pace chart

Only the pace chart moves. The other ten Insights cards stay monthly — that mismatch is UX-07's job and pulling it in here would swallow a separate High-ranked finding.

**Files:**
- Modify: `lib/insights/queries.ts` (the `spending_pace` call)
- Modify: the pace chart component (x-axis label and its comment)
- Modify: `messages/es.json`, `messages/en.json` if the axis legend names a month

**Interfaces:**
- Consumes: `spending_pace_range` (Task 2), `currentPeriod` (Task 3).
- Produces: nothing other tasks depend on.

- [ ] **Step 1:** Swap the RPC to `spending_pace_range` with the profile's current period, mapping `day_offset` where the component reads `day`, and `this_period`/`last_period` where it reads `this_month`/`last_month`.

- [ ] **Step 2:** The x-axis is now days into the period, not days of the month. Update the axis label and the legend so a quincena does not read as a truncated month. Update the source comment that explains the bucketing, since its reasoning has changed.

- [ ] **Step 3:** For a `monthly` profile the chart must be identical to today's — same 30/31 points, same two lines. Verify in the browser before committing.

- [ ] **Step 4: Typecheck, test, lint, commit**

```bash
npx tsc --noEmit && npm test && npx eslint app components lib
git add lib/insights/ components/insights/ messages/en.json messages/es.json
git commit -m "feat(insights): pace against the period, not the month"
```

---

### Task 10: The help guide, the audit, and the end-to-end pass

**Files:**
- Modify: `app/(app)/help/page.tsx` and its mock components
- Modify: `messages/es.json`, `messages/en.json`
- Modify: `docs/product-audit-dominican-market.md`

- [ ] **Step 1:** Add a help section for the pay cycle and the available figure — what `Disponible` subtracts, why a card with no printed minimum is subtracted in full, and where to change the cycle. Update the mocks so the guide's screenshots match the new hero. Spanish first, then English, then the parity check.

- [ ] **Step 2: The end-to-end browser pass**

Per the standing rule, ask before starting or killing the dev server. Then, on a quincenal profile in Spanish at a 360px viewport:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix cashly)"
agent-browser --session "$SESSION" --restore open http://localhost:3000/
agent-browser --session "$SESSION" snapshot -i
agent-browser --session "$SESSION" screenshot /tmp/overview-quincenal-es.png
```

Confirm: the hero reads `Disponible hasta el <date>`; the second figure reads `si saldas las tarjetas`; the breakdown lists five rows and one basis line per card; net worth is present as a secondary stat; `/budgets` shows two budget figures per row and a Mes/Quincena toggle; `/insights` paces against the quincena. Then switch the profile to `Mensual` and confirm every one of those screens matches `main`.

- [ ] **Step 3:** Tick UX-05 and UX-06 in `docs/product-audit-dominican-market.md`, each with a **Done** paragraph naming the files and a **Remaining** list for anything deferred (the Insights clock mismatch stays UX-07's; the onboarding question stays UX-11's). Update the *Next · 2–3 months* roadmap line. Do not renumber any ref.

- [ ] **Step 4: Final verification**

```bash
npx tsc --noEmit && npm test && npx eslint app components lib && npm run build
```
Expected: all four clean. Report the actual output; do not claim a pass without it.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/help/ messages/en.json messages/es.json docs/product-audit-dominican-market.md
git commit -m "docs(help,audit): the pay cycle, and what disponible subtracts"
```
