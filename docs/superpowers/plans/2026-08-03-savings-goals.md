# Savings Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add savings goals to `/budgets` — named, coloured targets that money is committed to from a real account, reducing that account's *available* balance without touching net worth.

**Architecture:** Two new tables (`savings_goals`, `goal_contributions`) plus one view (`account_commitments`). Overdrawing a committed account is resolved by a read-time **clamp** (`committed = min(max(raw,0), max(balance,0))`) rather than by written "raid" rows, which is what makes the feature immune to transaction edits, deletes and backdated statement imports. Both derivations — per-goal backing and savings pace — are pure TypeScript functions with unit tests, following the precedent of `lib/insights/net-worth-history.ts`.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Supabase Postgres with RLS, TypeScript, zod 4, react-hook-form, next-intl, Tailwind 4, base-ui, vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-03-savings-goals-design.md`

## Global Constraints

- **Never modify `account_balances`.** Net worth (`lib/overview/queries.ts`, `lib/insights/net-worth-history.ts`) reads it directly and must keep reporting real balances. Committing money to a goal does not make the user poorer.
- **Never modify `transactions`** — no `goal_id` column, no new `transaction_type`, no constraint or trigger changes.
- **`npm run db:push` targets the LIVE remote Supabase project** (the repo is linked). Confirm with the user before running it. `supabase db query --linked` is safe for read-only verification.
- All new tables get four owner RLS policies using `(select auth.uid()) = user_id` and a `set_updated_at` trigger, matching `categories`.
- Server actions follow `app/(app)/budgets/actions.ts`: `"use server"`, zod parse, `requireUser()`, `dbError(error, "fnName")`, return `{ error?: string; id?: string }`.
- All user-facing copy goes through next-intl. **Every key added to `messages/en.json` must also be added to `messages/es.json`.**
- Money is formatted with `formatMoney(amount, currency)` from `@/lib/format`. Numeric columns are `numeric(18,4)`.
- Run `npm test` and `npm run lint` before each commit.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `supabase/migrations/20260803120000_savings_goals.sql` | Tables, RLS, triggers, `account_commitments` view |
| `lib/palette.ts` | Shared identity swatches + card wash, used by budgets and goals |
| `lib/goals/funding.ts` | Pure: clamp + per-goal backing allocation |
| `lib/goals/funding.test.ts` | Tests for the above |
| `lib/goals/pace.ts` | Pure: required vs. actual savings pace |
| `lib/goals/pace.test.ts` | Tests for the above |
| `lib/goals/queries.ts` | Server-side data assembly for the goals band |
| `app/(app)/budgets/goal-actions.ts` | Server actions for goals and contributions |
| `components/goals/goal-dialog.tsx` | Create/edit a goal |
| `components/goals/contribute-dialog.tsx` | Add/withdraw a contribution |
| `components/goals/goal-grid.tsx` | Goals band: totals row + card grid |
| `components/insights/savings-goals.tsx` | Insights page Tally card |

**Modify**
| File | Change |
|---|---|
| `components/budgets/category-dialog.tsx` | Import `SWATCHES` from `lib/palette`, two-row grid |
| `components/budgets/budget-grid.tsx` | Card shading from the category colour |
| `app/(app)/budgets/page.tsx` | Band headings, separator, goals band |
| `lib/budgets/month.ts` | Export `monthsBetween` |
| `lib/accounts/queries.ts` | Add `committed` / `available` to `AccountWithStatus` |
| `components/accounts/account-card.tsx` | Available/committed line |
| `app/(app)/insights/page.tsx` | Savings goals card in `sectionPosition` |
| `lib/nav.ts`, `messages/en.json`, `messages/es.json` | Copy + nav label |
| `lib/supabase/types.ts` | Regenerated |

---

## Task 1: Migration — tables, RLS, triggers, view

**Files:**
- Create: `supabase/migrations/20260803120000_savings_goals.sql`
- Modify: `lib/supabase/types.ts` (regenerated, do not hand-edit)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.savings_goals`, `public.goal_contributions`; view `public.account_commitments (account_id uuid, user_id uuid, committed_raw numeric)`. Generated types `Database["public"]["Tables"]["savings_goals"]["Row"]`, `["goal_contributions"]["Row"]`, `Database["public"]["Views"]["account_commitments"]["Row"]`.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260803120000_savings_goals.sql`:

```sql
-- Savings goals: an envelope of money committed from a real account.
--
-- A contribution does not move money in the real world. It marks part of an
-- account's balance as spoken for, so the app can answer "how much can I
-- actually spend?" without requiring a second bank account. Net worth is
-- deliberately unaffected — `account_balances` is not touched here — because
-- committing money to a goal does not make the user poorer.
--
-- Named `savings_goals` rather than `goals` because `accounts` already carries
-- `welcome_bonus_goal_amount` for credit-card sign-up bonuses.

create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  emoji         text,
  color         text,
  target_amount numeric(18,4) not null check (target_amount > 0),
  target_date   date,
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- `amount` is in the ORIGIN ACCOUNT'S currency, because the commitment has to
-- be deducted from that account in its own units. `base_amount` is the same
-- money in the user's base currency, which is what goal progress sums.
-- A negative `amount` is a withdrawal: it reduces both the goal's progress and
-- the account's commitment by the same arithmetic a positive one increases them.
create table public.goal_contributions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  goal_id       uuid not null references public.savings_goals (id) on delete cascade,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  amount        numeric(18,4) not null check (amount <> 0),
  currency      text not null check (char_length(currency) = 3),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  base_amount   numeric(18,4) not null default 0,
  occurred_at   timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index savings_goals_user_id_idx on public.savings_goals (user_id);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index goal_contributions_account_idx on public.goal_contributions (account_id);

-- RLS: savings_goals
alter table public.savings_goals enable row level security;
create policy "savings_goals: owner read" on public.savings_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "savings_goals: owner insert" on public.savings_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "savings_goals: owner update" on public.savings_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "savings_goals: owner delete" on public.savings_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: goal_contributions
alter table public.goal_contributions enable row level security;
create policy "goal_contributions: owner read" on public.goal_contributions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goal_contributions: owner insert" on public.goal_contributions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goal_contributions: owner update" on public.goal_contributions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goal_contributions: owner delete" on public.goal_contributions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger savings_goals_set_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();
create trigger goal_contributions_set_updated_at before update on public.goal_contributions
  for each row execute function public.set_updated_at();

-- base_amount is derived, never supplied. Mirrors transactions_compute_amounts.
create or replace function public.goal_contributions_compute_amounts()
returns trigger language plpgsql as $$
begin
  new.base_amount := round(new.amount * new.exchange_rate, 4);
  return new;
end;
$$;

create trigger goal_contributions_compute_amounts
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_compute_amounts();

-- A contribution can never drift from the account it deducts from: its currency
-- is the account's, and the account must be one that can hold savings. Credit
-- cards and loans are debts — "saving onto a credit card" is not a coherent act,
-- and neither appears in `account_balances`, so a commitment against one could
-- never be clamped.
create or replace function public.goal_contributions_pin_account()
returns trigger language plpgsql as $$
declare
  acct public.accounts%rowtype;
begin
  select * into acct from public.accounts where id = new.account_id;
  if not found then
    raise exception 'goal_contributions.account_id % not found', new.account_id;
  end if;
  if acct.type in ('credit_card', 'loan') then
    raise exception 'goal contributions cannot come from a % account', acct.type;
  end if;
  new.currency := acct.currency;
  return new;
end;
$$;

create trigger goal_contributions_pin_account
  before insert or update on public.goal_contributions
  for each row execute function public.goal_contributions_pin_account();

-- Raw commitment per account, before the clamp.
--
-- The clamp itself (`min(max(raw,0), max(balance,0))`) lives in TypeScript
-- rather than here, so the same arithmetic that computes it also allocates it
-- across goals and can be unit-tested — the same reasoning that dropped the SQL
-- net-worth view in 20260728120000.
--
-- The `not in ('credit_card','loan')` filter matches `account_balances`, which
-- excludes both (loans since 20260719124500_fix_account_balances_exclude_loans),
-- so the two join one-to-one with no missing rows.
create view public.account_commitments
with (security_invoker = true) as
select a.id      as account_id,
       a.user_id as user_id,
       coalesce(sum(gc.amount), 0) as committed_raw
from public.accounts a
left join public.goal_contributions gc on gc.account_id = a.id
where a.type not in ('credit_card', 'loan')
group by a.id, a.user_id;
```

- [ ] **Step 2: Verify the SQL parses without applying it**

Run: `npx supabase db lint --linked --schema public`
Expected: no syntax errors reported for the new file. If `db lint` is unavailable in this CLI version, skip to Step 3 — the push in Step 3 will surface syntax errors.

- [ ] **Step 3: Ask the user before pushing, then push**

`npm run db:push` applies to the **live remote project**. Ask the user to confirm, then run:

```bash
npm run db:push
```
Expected: `Applying migration 20260803120000_savings_goals.sql...` then success.

- [ ] **Step 4: Verify the schema landed**

```bash
npx supabase db query --linked "select table_name from information_schema.tables where table_schema='public' and table_name in ('savings_goals','goal_contributions','account_commitments') order by table_name"
```
Expected: three rows — `account_commitments`, `goal_contributions`, `savings_goals`.

```bash
npx supabase db query --linked "select relname, relrowsecurity from pg_class where relname in ('savings_goals','goal_contributions')"
```
Expected: `relrowsecurity` is `t` for both.

- [ ] **Step 5: Regenerate types**

```bash
npm run db:types
```
Then confirm the new names are present:
```bash
grep -c "savings_goals\|goal_contributions\|account_commitments" lib/supabase/types.ts
```
Expected: a non-zero count.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260803120000_savings_goals.sql lib/supabase/types.ts
git commit -m "feat(goals): add savings_goals, goal_contributions, account_commitments"
```

---

## Task 2: Expanded palette and card shading

Independent of the goals data model — ships a visible improvement to budgets on its own.

**Files:**
- Create: `lib/palette.ts`
- Modify: `components/budgets/category-dialog.tsx` (delete the local `SWATCHES` const at ~line 28, import it instead; swatch grid at ~lines 97–112)
- Modify: `components/budgets/budget-grid.tsx` (the grid `Card`, ~line 234; the table row, ~line 313)

**Interfaces:**
- Consumes: nothing.
- Produces, both from `lib/palette.ts`: `export const SWATCHES: string[]` (16 entries) and `export function colorCardStyle(color: string | null): CSSProperties`. Consumed by `budget-grid.tsx`, `category-dialog.tsx`, and by `components/goals/*` in Tasks 6–7.

These live in `lib/` rather than in `category-dialog.tsx` because they are shared design tokens, not dialog internals — putting them in the dialog would make every goals component import from a budgets component.

- [ ] **Step 1: Create `lib/palette.ts`**

```ts
import type { CSSProperties } from "react";

/**
 * Identity colours for categories and goals. Stored as literal hex on the row —
 * not `var(--chart-n)` — because the value has to survive a theme switch.
 *
 * The first eight are the light-mode `--chart-*` values in globals.css; keep
 * them in step. (`--chart-8` was defined there but never listed here.)
 *
 * The last eight were derived, not eyeballed. A swatch is used as chip
 * *foreground* in both themes, so it must clear 3:1 against the light card
 * (#ffffff) and the dark card (#191714). That bounds relative luminance to
 * 0.126..0.300; all eight sit mid-window at ~0.213 (≈4.0:1 light, ≈4.5:1 dark).
 * Saturation is pinned to 0.51, the median of the first eight, so they read as
 * the same family; #867e72 is the one deliberate exception at 0.08, because a
 * neutral is genuinely useful for a catch-all category. Hues fill the widest
 * gaps in the wheel above — the largest being the 99° hole between 73 and 172.
 *
 * Two pairs land close (#cb5c62 near terracotta, #89812c near olive). Unlike
 * the `--chart-*` series, which must survive being told apart in a legend under
 * CVD simulation, these always render beside their own name and emoji, so the
 * label carries distinguishability and hue coverage matters more.
 */
export const SWATCHES = [
  "#3e5fad", "#b6770b", "#008f7d", "#be563d", "#8949a3", "#7e903e", "#1b8abd", "#c4486d",
  "#b56e3a", "#89812c", "#45902e", "#2f914e", "#8471d1", "#c752b0", "#cb5c62", "#867e72",
];

/**
 * The wash a coloured card takes. Mixing against `var(--card)` and
 * `var(--border)` rather than fixed values is what makes this theme-correct for
 * free: the same 5% over ivory and over near-black both land as a gentle cast
 * in the right direction.
 */
export function colorCardStyle(color: string | null): CSSProperties {
  if (!color) return {};
  return {
    backgroundColor: `color-mix(in oklab, ${color} 5%, var(--card))`,
    borderColor: `color-mix(in oklab, ${color} 25%, var(--border))`,
  };
}
```

- [ ] **Step 2: Point `category-dialog.tsx` at the shared palette**

Delete the local `SWATCHES` const and its comment block from `components/budgets/category-dialog.tsx`, and import it instead:

```tsx
import { SWATCHES } from "@/lib/palette";
```

Everything else in that file — `useState(category?.color ?? SWATCHES[0])`, the `SWATCHES.map(...)` — keeps working unchanged.

- [ ] **Step 3: Make the swatch grid wrap to two rows of eight**

In the same file, change the swatch container class from `flex flex-wrap gap-2` to a fixed grid so 16 swatches land as 8 × 2:

```tsx
<div className="grid grid-cols-8 gap-2">
```

The `SWATCHES.map(...)` body is unchanged.

- [ ] **Step 4: Shade the budget cards**

In `components/budgets/budget-grid.tsx`, add the import (leaving the existing `CategoryDialog` import alone):

```tsx
import { colorCardStyle } from "@/lib/palette";
```

In the **grid** view, change the card open tag from:
```tsx
<Card key={row.category_id} className="gap-0 p-5">
```
to:
```tsx
<Card key={row.category_id} className="gap-0 p-5" style={colorCardStyle(row.color)}>
```

In the **table** view, change the row open tag from:
```tsx
<div key={row.category_id} className="group flex items-center gap-4 py-4">
```
to:
```tsx
<div
  key={row.category_id}
  className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4"
  style={colorCardStyle(row.color)}
>
```
The negative margin plus matching padding keeps the row's content aligned exactly where it was while letting the wash extend past the text.

- [ ] **Step 5: Verify it builds and lints**

```bash
npm run lint && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/palette.ts components/budgets/category-dialog.tsx components/budgets/budget-grid.tsx
git commit -m "feat(budgets): expand swatches to 16 and wash cards in their colour"
```

---

## Task 3: `lib/goals/funding.ts` — the clamp and per-goal backing

Pure function, TDD. No database, no React.

**Files:**
- Create: `lib/goals/funding.test.ts`
- Create: `lib/goals/funding.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
```ts
export type ContributionRow = {
  id: string; goal_id: string; account_id: string;
  amount: number; base_amount: number; occurred_at: string;
};
export type BalanceRow = { account_id: string; balance: number };
export type GoalFunding = { goalId: string; saved: number; backed: number; shortfall: number };
export type AccountFunding = { accountId: string; balance: number; committed: number; available: number };
export type Funding = { goals: Map<string, GoalFunding>; accounts: Map<string, AccountFunding> };
export function computeFunding(contributions: ContributionRow[], balances: BalanceRow[]): Funding;
```

- [ ] **Step 1: Write the failing tests**

Create `lib/goals/funding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeFunding, type BalanceRow, type ContributionRow } from "./funding";

let seq = 0;
/** A contribution in base currency (rate 1) unless `base` says otherwise. */
const c = (
  goal: string,
  account: string,
  amount: number,
  date = "2026-07-15",
  base = amount,
): ContributionRow => ({
  id: `c${++seq}`,
  goal_id: goal,
  account_id: account,
  amount,
  base_amount: base,
  occurred_at: `${date}T12:00:00+00:00`,
});

const bal = (account_id: string, balance: number): BalanceRow => ({ account_id, balance });

describe("computeFunding — accounts", () => {
  it("commits what was contributed when the balance covers it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 1000)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 1000, committed: 400, available: 600,
    });
  });

  it("clamps the commitment to the balance when spending has eaten into it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 200)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 200, committed: 200, available: 0,
    });
  });

  it("commits nothing from an account at zero", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 0)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 0, committed: 0, available: 0,
    });
  });

  it("leaves a negative balance untouched rather than committing against it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", -50)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: -50, committed: 0, available: -50,
    });
  });

  it("reports an account with no contributions as fully available", () => {
    const f = computeFunding([], [bal("chk", 750)]);
    expect(f.accounts.get("chk")).toEqual({
      accountId: "chk", balance: 750, committed: 0, available: 750,
    });
  });
});

describe("computeFunding — goals", () => {
  it("backs a goal fully when its account can cover it", () => {
    const f = computeFunding([c("g1", "chk", 400)], [bal("chk", 1000)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 400, backed: 400, shortfall: 0 });
  });

  it("reports the uncovered remainder as shortfall", () => {
    const f = computeFunding([c("g1", "chk", 1000)], [bal("chk", 800)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 800, shortfall: 200 });
  });

  it("borrows back from the most recently funded goal first", () => {
    // 600 + 600 committed against 800 held: the newer goal eats the 400 shortfall.
    const f = computeFunding(
      [c("old", "chk", 600, "2026-05-01"), c("new", "chk", 600, "2026-07-01")],
      [bal("chk", 800)],
    );
    expect(f.goals.get("old")).toEqual({ goalId: "old", saved: 600, backed: 600, shortfall: 0 });
    expect(f.goals.get("new")).toEqual({ goalId: "new", saved: 600, backed: 200, shortfall: 400 });
  });

  it("breaks a same-date tie by contribution id so the result is stable", () => {
    const a = c("gA", "chk", 500, "2026-07-01");
    const b = c("gB", "chk", 500, "2026-07-01");
    const forward = computeFunding([a, b], [bal("chk", 500)]);
    const reversed = computeFunding([b, a], [bal("chk", 500)]);
    expect(forward.goals.get("gA")).toEqual(reversed.goals.get("gA"));
    expect(forward.goals.get("gB")).toEqual(reversed.goals.get("gB"));
  });

  it("nets a withdrawal against the goal and frees the account's commitment", () => {
    const f = computeFunding(
      [c("g1", "chk", 500, "2026-06-01"), c("g1", "chk", -200, "2026-07-01")],
      [bal("chk", 1000)],
    );
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 300, backed: 300, shortfall: 0 });
    expect(f.accounts.get("chk")?.committed).toBe(300);
  });

  it("skips a pair that has been fully withdrawn, leaving capacity for others", () => {
    const f = computeFunding(
      [
        c("spent", "chk", 300, "2026-07-02"),
        c("spent", "chk", -300, "2026-07-03"),
        c("kept", "chk", 400, "2026-07-01"),
      ],
      [bal("chk", 400)],
    );
    expect(f.goals.get("kept")).toEqual({ goalId: "kept", saved: 400, backed: 400, shortfall: 0 });
    expect(f.goals.get("spent")).toEqual({ goalId: "spent", saved: 0, backed: 0, shortfall: 0 });
  });

  it("sums a goal funded from two accounts", () => {
    const f = computeFunding(
      [c("g1", "chk", 300), c("g1", "sav", 700)],
      [bal("chk", 1000), bal("sav", 1000)],
    );
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 1000, shortfall: 0 });
  });

  it("applies the shortfall per account, not across them", () => {
    const f = computeFunding(
      [c("g1", "chk", 300), c("g1", "sav", 700)],
      [bal("chk", 100), bal("sav", 1000)],
    );
    // chk backs only 100 of its 300; sav backs all 700.
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 1000, backed: 800, shortfall: 200 });
  });

  it("converts the backed portion at the pair's own blended rate", () => {
    // 1000 pesos contributed, worth 500 base. Only half the pesos are held.
    const f = computeFunding([c("g1", "mxn", 1000, "2026-07-01", 500)], [bal("mxn", 500)]);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 500, backed: 250, shortfall: 250 });
  });

  it("ignores contributions from an account with no balance row", () => {
    // The account_commitments view excludes credit cards and loans, so such a
    // row should never arrive — but it must not corrupt the totals if it does.
    const f = computeFunding([c("g1", "card", 400)], []);
    expect(f.goals.get("g1")).toEqual({ goalId: "g1", saved: 400, backed: 0, shortfall: 400 });
    expect(f.accounts.has("card")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/goals/funding.test.ts`
Expected: FAIL — `Failed to resolve import "./funding"`.

- [ ] **Step 3: Write the implementation**

Create `lib/goals/funding.ts`:

```ts
/**
 * How much of each goal is actually backed by money, and how much of each
 * account is spoken for.
 *
 * The rule is that an account cannot hold back more than it has:
 *
 *   committed(account) = min( max(raw, 0), max(balance, 0) )
 *   available(account) = balance − committed(account)
 *
 * This is a clamp applied at read time, not bookkeeping. The alternative — a
 * trigger that deducts from a goal when a transaction overdraws an account —
 * has to pick a goal to write to, goes stale the moment the triggering
 * transaction is edited or deleted, and is simply wrong under backdating, which
 * statement imports do routinely. The clamp has none of those problems and
 * self-heals: spend down and a goal's backing shrinks, get paid and it returns.
 *
 * Allocation runs per (account, goal) pair rather than per contribution row.
 * That is enough to be deterministic, and withdrawals net out for free.
 */

export type ContributionRow = {
  id: string;
  goal_id: string;
  account_id: string;
  /** Origin account's currency. Negative is a withdrawal. */
  amount: number;
  /** The same money in base currency. Negative is a withdrawal. */
  base_amount: number;
  occurred_at: string;
};

export type BalanceRow = { account_id: string; balance: number };

export type GoalFunding = {
  goalId: string;
  /** Σ base_amount — what has been set aside. */
  saved: number;
  /** The portion actually present in its origin accounts, in base. */
  backed: number;
  /** saved − backed, never negative. */
  shortfall: number;
};

export type AccountFunding = {
  accountId: string;
  balance: number;
  committed: number;
  available: number;
};

export type Funding = {
  goals: Map<string, GoalFunding>;
  accounts: Map<string, AccountFunding>;
};

type Pair = {
  goalId: string;
  /** Net of contributions and withdrawals, origin currency. */
  net: number;
  /** The same net in base currency. */
  netBase: number;
  /** Newest contribution in this pair, for the borrow-back ordering. */
  latestAt: string;
  latestId: string;
};

/** Money is stored at 4dp; rounding here keeps float drift out of the totals. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function computeFunding(
  contributions: ContributionRow[],
  balances: BalanceRow[],
): Funding {
  // 1. Collapse rows into (account, goal) pairs.
  const pairsByAccount = new Map<string, Map<string, Pair>>();
  const saved = new Map<string, number>();

  for (const c of contributions) {
    saved.set(c.goal_id, (saved.get(c.goal_id) ?? 0) + c.base_amount);

    let byGoal = pairsByAccount.get(c.account_id);
    if (!byGoal) pairsByAccount.set(c.account_id, (byGoal = new Map()));

    const existing = byGoal.get(c.goal_id);
    if (!existing) {
      byGoal.set(c.goal_id, {
        goalId: c.goal_id,
        net: c.amount,
        netBase: c.base_amount,
        latestAt: c.occurred_at,
        latestId: c.id,
      });
      continue;
    }
    existing.net += c.amount;
    existing.netBase += c.base_amount;
    // Ties broken by id so the ordering does not depend on input order.
    if (
      c.occurred_at > existing.latestAt ||
      (c.occurred_at === existing.latestAt && c.id > existing.latestId)
    ) {
      existing.latestAt = c.occurred_at;
      existing.latestId = c.id;
    }
  }

  // 2. Clamp each account, then hand its capacity to its goals newest first.
  const accounts = new Map<string, AccountFunding>();
  const backed = new Map<string, number>();

  for (const { account_id, balance } of balances) {
    const byGoal = pairsByAccount.get(account_id);
    const raw = byGoal ? [...byGoal.values()].reduce((s, p) => s + p.net, 0) : 0;
    const committed = round4(Math.min(Math.max(raw, 0), Math.max(balance, 0)));

    accounts.set(account_id, {
      accountId: account_id,
      balance,
      committed,
      available: round4(balance - committed),
    });
    if (!byGoal) continue;

    // A pair that has been fully withdrawn consumes no capacity and receives
    // no allocation.
    //
    // Oldest first — which is what makes the NEWEST commitment the first to
    // lose its backing. The two orderings are the same rule read from opposite
    // ends, so the comparator is easy to write backwards; the "borrows back
    // from the most recently funded goal first" test is what pins it.
    const funded = [...byGoal.values()]
      .filter((p) => p.net > 0)
      .sort((a, b) =>
        a.latestAt === b.latestAt
          ? a.latestId.localeCompare(b.latestId)
          : a.latestAt > b.latestAt ? 1 : -1,
      );

    let remaining = committed;
    for (const pair of funded) {
      const allocated = Math.min(pair.net, remaining);
      remaining = round4(remaining - allocated);
      // Convert at the pair's own blended rate rather than re-fetching FX: the
      // rate that applied when the money was set aside is the honest one.
      const allocatedBase = pair.netBase * (allocated / pair.net);
      backed.set(pair.goalId, (backed.get(pair.goalId) ?? 0) + allocatedBase);
      if (remaining <= 0) break;
    }
  }

  // 3. Assemble per-goal figures.
  const goals = new Map<string, GoalFunding>();
  for (const [goalId, savedBase] of saved) {
    const backedBase = round4(backed.get(goalId) ?? 0);
    goals.set(goalId, {
      goalId,
      saved: round4(savedBase),
      backed: backedBase,
      shortfall: round4(Math.max(savedBase - backedBase, 0)),
    });
  }

  return { goals, accounts };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/goals/funding.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/goals/funding.ts lib/goals/funding.test.ts
git commit -m "feat(goals): derive account commitment clamp and per-goal backing"
```

---

## Task 4: `lib/goals/pace.ts` — required vs. actual savings pace

**Files:**
- Create: `lib/goals/pace.test.ts`
- Create: `lib/goals/pace.ts`
- Modify: `lib/budgets/month.ts` (add `monthsBetween`)

**Interfaces:**
- Consumes: `monthStart`, `addMonths` from `@/lib/budgets/month`.
- Produces:
```ts
// lib/budgets/month.ts
export function monthsBetween(from: string, to: string): number;

// lib/goals/pace.ts
export type PaceInput = {
  saved: number; shortfall: number; target: number;
  targetDate: string | null;
  contributions: { base_amount: number; occurred_at: string }[];
  today?: Date;
};
export type Pace =
  | { kind: "shortfall"; amount: number }
  | { kind: "complete" }
  | { kind: "overdue" }
  | { kind: "no-pace" }
  | { kind: "on-track"; required: number; actual: number }
  | { kind: "behind"; required: number; actual: number }
  | { kind: "projection"; actual: number; months: number };
export function computePace(input: PaceInput): Pace;
```

- [ ] **Step 1: Add `monthsBetween` to `lib/budgets/month.ts`**

Append to `lib/budgets/month.ts`:

```ts
/** Whole months from one first-of-month string to another. Signed. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/goals/pace.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computePace, type PaceInput } from "./pace";

const TODAY = new Date(2026, 7, 3); // 2026-08-03

const contrib = (amount: number, date: string) => ({
  base_amount: amount,
  occurred_at: `${date}T12:00:00+00:00`,
});

const input = (over: Partial<PaceInput> = {}): PaceInput => ({
  saved: 0,
  shortfall: 0,
  target: 1000,
  targetDate: null,
  contributions: [],
  today: TODAY,
  ...over,
});

describe("computePace — precedence", () => {
  it("reports a shortfall ahead of anything else", () => {
    // Even a completed goal is not really funded if money was borrowed back.
    expect(
      computePace(input({ saved: 1200, target: 1000, shortfall: 300 })),
    ).toEqual({ kind: "shortfall", amount: 300 });
  });

  it("reports completion once the target is reached and fully backed", () => {
    expect(computePace(input({ saved: 1000, target: 1000 }))).toEqual({ kind: "complete" });
  });

  it("reports overdue ahead of no-pace when the date has passed", () => {
    expect(
      computePace(input({ saved: 100, targetDate: "2026-06-30", contributions: [] })),
    ).toEqual({ kind: "overdue" });
  });

  it("reports no-pace when nothing has been contributed", () => {
    expect(computePace(input({ saved: 0, contributions: [] }))).toEqual({ kind: "no-pace" });
  });
});

describe("computePace — with a target date", () => {
  it("is on track when actual meets required", () => {
    // 800 saved of 1000, 5 months to Dec => need 40/mo. 390 over 3 months = 130/mo.
    const p = computePace(
      input({
        saved: 800,
        target: 1000,
        targetDate: "2026-12-31",
        contributions: [
          contrib(130, "2026-06-10"),
          contrib(130, "2026-07-10"),
          contrib(130, "2026-08-01"),
        ],
      }),
    );
    expect(p).toEqual({ kind: "on-track", required: 40, actual: 130 });
  });

  it("is behind when actual falls short of required", () => {
    // 100 of 1000, 2 months to Oct => need 450/mo. 30 over 3 months = 10/mo.
    const p = computePace(
      input({
        saved: 100,
        target: 1000,
        targetDate: "2026-10-31",
        contributions: [contrib(10, "2026-06-10"), contrib(20, "2026-07-10")],
      }),
    );
    expect(p).toEqual({ kind: "behind", required: 450, actual: 10 });
  });

  it("treats a target inside the current month as one month of runway", () => {
    const p = computePace(
      input({
        saved: 900,
        target: 1000,
        targetDate: "2026-08-28",
        contributions: [contrib(300, "2026-08-01")],
      }),
    );
    expect(p).toEqual({ kind: "on-track", required: 100, actual: 300 });
  });
});

describe("computePace — without a target date", () => {
  it("projects months remaining at the recent rate", () => {
    // 2400 of 10000 => 7600 to go at 200/mo => 38 months.
    const p = computePace(
      input({
        saved: 2400,
        target: 10000,
        contributions: [
          contrib(200, "2026-06-05"),
          contrib(200, "2026-07-05"),
          contrib(200, "2026-08-02"),
        ],
      }),
    );
    expect(p).toEqual({ kind: "projection", actual: 200, months: 38 });
  });

  it("rounds a partial month up", () => {
    const p = computePace(
      input({ saved: 0, target: 250, contributions: [contrib(100, "2026-08-01")] }),
    );
    // 100 over a single elapsed month = 100/mo; 250/100 = 2.5 => 3.
    expect(p).toEqual({ kind: "projection", actual: 100, months: 3 });
  });

  it("reports no-pace when withdrawals cancel the contributions out", () => {
    const p = computePace(
      input({
        saved: 0,
        target: 1000,
        contributions: [contrib(300, "2026-07-01"), contrib(-300, "2026-08-01")],
      }),
    );
    expect(p).toEqual({ kind: "no-pace" });
  });
});

describe("computePace — the averaging window", () => {
  it("averages over three months once the goal is that old", () => {
    const p = computePace(
      input({
        saved: 300,
        target: 5000,
        contributions: [
          contrib(300, "2026-01-05"), // outside the 3-month window
          contrib(300, "2026-06-05"),
          contrib(300, "2026-07-05"),
          contrib(300, "2026-08-05"),
        ],
      }),
    );
    expect(p.kind).toBe("projection");
    expect((p as { actual: number }).actual).toBe(300); // 900 / 3, January excluded
  });

  it("divides by the months actually elapsed for a young goal", () => {
    const p = computePace(
      input({ saved: 500, target: 5000, contributions: [contrib(500, "2026-08-01")] }),
    );
    // One month old: 500/1, not 500/3.
    expect((p as { actual: number }).actual).toBe(500);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run lib/goals/pace.test.ts`
Expected: FAIL — `Failed to resolve import "./pace"`.

- [ ] **Step 4: Write the implementation**

Create `lib/goals/pace.ts`:

```ts
/**
 * What a goal's progress says about whether it will arrive.
 *
 * Two readings, depending on whether the goal names a date. With one, required
 * pace can be compared against actual pace and the answer is a verdict. Without
 * one, all that can honestly be said is a projection.
 *
 * The degraded states are deliberate branches rather than arithmetic accidents:
 * every one of them is a case where a naive (target − saved) / months would
 * divide by zero or produce a number that reads as fact.
 */

import { monthStart, addMonths, monthsBetween } from "@/lib/budgets/month";

/** Months of contributions averaged to get the current rate. */
const WINDOW = 3;

export type PaceInput = {
  saved: number;
  shortfall: number;
  target: number;
  /** "YYYY-MM-DD", or null for an open-ended goal. */
  targetDate: string | null;
  contributions: { base_amount: number; occurred_at: string }[];
  /** Injectable for tests. Defaults to now. */
  today?: Date;
};

export type Pace =
  | { kind: "shortfall"; amount: number }
  | { kind: "complete" }
  | { kind: "overdue" }
  | { kind: "no-pace" }
  | { kind: "on-track"; required: number; actual: number }
  | { kind: "behind"; required: number; actual: number }
  | { kind: "projection"; actual: number; months: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computePace(input: PaceInput): Pace {
  const { saved, shortfall, target, targetDate, contributions } = input;
  const today = input.today ?? new Date();
  const thisMonth = monthStart(today);

  // Money borrowed back outranks every other reading: a pace computed against
  // money that is not there would be arithmetic about a fiction.
  if (shortfall > 0) return { kind: "shortfall", amount: round2(shortfall) };
  if (saved >= target) return { kind: "complete" };

  // The date is the more specific fact, so an expired one outranks "no pace".
  if (targetDate) {
    const targetMonth = `${targetDate.slice(0, 7)}-01`;
    if (monthsBetween(thisMonth, targetMonth) < 0) return { kind: "overdue" };
  }

  const actual = averagePerMonth(contributions, thisMonth);
  if (actual <= 0) return { kind: "no-pace" };

  const outstanding = target - saved;

  if (targetDate) {
    const targetMonth = `${targetDate.slice(0, 7)}-01`;
    // A target inside the current month still gets one month of runway; zero
    // would make `required` infinite.
    const monthsLeft = Math.max(monthsBetween(thisMonth, targetMonth), 1);
    const required = round2(outstanding / monthsLeft);
    return required <= actual
      ? { kind: "on-track", required, actual }
      : { kind: "behind", required, actual };
  }

  return { kind: "projection", actual, months: Math.ceil(outstanding / actual) };
}

/**
 * The recent rate: net contributions over the last `WINDOW` months, divided by
 * the months that have actually elapsed. Dividing a two-week-old goal's first
 * deposit by three would understate it by a factor of three.
 */
function averagePerMonth(
  contributions: { base_amount: number; occurred_at: string }[],
  thisMonth: string,
): number {
  if (contributions.length === 0) return 0;

  const firstMonth = contributions
    .map((c) => `${c.occurred_at.slice(0, 7)}-01`)
    .reduce((a, b) => (a < b ? a : b));

  const elapsed = Math.min(monthsBetween(firstMonth, thisMonth) + 1, WINDOW);
  const months = Math.max(elapsed, 1);
  const windowStart = addMonths(thisMonth, -(months - 1));

  const sum = contributions
    .filter((c) => `${c.occurred_at.slice(0, 7)}-01` >= windowStart)
    .reduce((s, c) => s + c.base_amount, 0);

  return sum <= 0 ? 0 : round2(sum / months);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/goals/pace.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Run the whole suite to confirm `month.ts` is unbroken**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 7: Commit**

```bash
git add lib/goals/pace.ts lib/goals/pace.test.ts lib/budgets/month.ts
git commit -m "feat(goals): derive required vs actual savings pace"
```

---

## Task 5: Queries and server actions

**Files:**
- Create: `lib/goals/queries.ts`
- Create: `app/(app)/budgets/goal-actions.ts`

**Interfaces:**
- Consumes: `computeFunding` (Task 3), `computePace` / `Pace` (Task 4), `createClient` from `@/lib/supabase/server`, `dbError` from `@/lib/errors`.
- Produces:
```ts
// lib/goals/queries.ts
export type ContributableAccount = { id: string; name: string; currency: string };
export type GoalCardRow = {
  id: string; name: string; emoji: string | null; color: string | null;
  target_amount: number; target_date: string | null;
  saved: number; backed: number; shortfall: number; pace: Pace;
};
export type GoalsOverview = {
  goals: GoalCardRow[];
  totalSaved: number; totalTarget: number; totalBacked: number; totalShortfall: number;
  baseCurrency: string;
  accounts: ContributableAccount[];
};
export async function getGoalsOverview(): Promise<GoalsOverview>;
export async function getAccountFunding(): Promise<Map<string, { committed: number; available: number }>>;

// app/(app)/budgets/goal-actions.ts
export async function createGoal(input: unknown): Promise<{ error?: string; id?: string }>;
export async function updateGoal(id: string, input: unknown): Promise<{ error?: string; id?: string }>;
export async function deleteGoal(id: string): Promise<{ error?: string }>;
export async function addContribution(input: unknown): Promise<{ error?: string; id?: string }>;
```

- [ ] **Step 1: Write `lib/goals/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import { computeFunding, type ContributionRow } from "./funding";
import { computePace, type Pace } from "./pace";

export type ContributableAccount = { id: string; name: string; currency: string };

export type GoalCardRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target_amount: number;
  target_date: string | null;
  saved: number;
  backed: number;
  shortfall: number;
  pace: Pace;
};

export type GoalsOverview = {
  goals: GoalCardRow[];
  totalSaved: number;
  totalTarget: number;
  totalBacked: number;
  totalShortfall: number;
  baseCurrency: string;
  /** Accounts a contribution may be drawn from, for the contribute dialog. */
  accounts: ContributableAccount[];
};

/** Accounts that can hold savings. Cards and loans are debts. */
const SAVINGS_ACCOUNT_TYPES = ["checking", "savings", "cash", "investment", "asset"] as const;

export async function getGoalsOverview(): Promise<GoalsOverview> {
  const supabase = await createClient();
  const [{ data: goals }, { data: contributions }, { data: balances }, { data: profile }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("savings_goals")
        .select("id,name,emoji,color,target_amount,target_date")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("goal_contributions")
        .select("id,goal_id,account_id,amount,base_amount,occurred_at")
        .order("occurred_at"),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase
        .from("accounts")
        .select("id,name,currency")
        .eq("is_archived", false)
        .in("type", SAVINGS_ACCOUNT_TYPES)
        .order("sort_order")
        .order("created_at"),
    ]);

  const rows: ContributionRow[] = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    occurred_at: c.occurred_at,
  }));

  const funding = computeFunding(
    rows,
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const byGoal = new Map<string, ContributionRow[]>();
  for (const r of rows) {
    const list = byGoal.get(r.goal_id);
    if (list) list.push(r);
    else byGoal.set(r.goal_id, [r]);
  }

  const cards: GoalCardRow[] = (goals ?? []).map((g) => {
    const f = funding.goals.get(g.id) ?? { saved: 0, backed: 0, shortfall: 0 };
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      target_amount: Number(g.target_amount),
      target_date: g.target_date,
      saved: f.saved,
      backed: f.backed,
      shortfall: f.shortfall,
      pace: computePace({
        saved: f.saved,
        shortfall: f.shortfall,
        target: Number(g.target_amount),
        targetDate: g.target_date,
        contributions: byGoal.get(g.id) ?? [],
      }),
    };
  });

  return {
    goals: cards,
    totalSaved: cards.reduce((s, g) => s + g.saved, 0),
    totalTarget: cards.reduce((s, g) => s + g.target_amount, 0),
    totalBacked: cards.reduce((s, g) => s + g.backed, 0),
    totalShortfall: cards.reduce((s, g) => s + g.shortfall, 0),
    baseCurrency: profile?.base_currency ?? "USD",
    accounts: accounts ?? [],
  };
}

/**
 * Committed/available per account, for the accounts page. Separate from
 * `getGoalsOverview` so `/accounts` does not pay for goal and pace assembly it
 * never renders.
 */
export async function getAccountFunding(): Promise<
  Map<string, { committed: number; available: number }>
> {
  const supabase = await createClient();
  const [{ data: contributions }, { data: balances }] = await Promise.all([
    supabase.from("goal_contributions").select("id,goal_id,account_id,amount,base_amount,occurred_at"),
    supabase.from("account_balances").select("account_id,balance"),
  ]);

  const funding = computeFunding(
    (contributions ?? []).map((c) => ({
      id: c.id,
      goal_id: c.goal_id,
      account_id: c.account_id,
      amount: Number(c.amount),
      base_amount: Number(c.base_amount),
      occurred_at: c.occurred_at,
    })),
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  return new Map(
    [...funding.accounts.values()].map((a) => [
      a.accountId,
      { committed: a.committed, available: a.available },
    ]),
  );
}
```

- [ ] **Step 2: Write `app/(app)/budgets/goal-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";

type Result = { error?: string; id?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** A contribution changes both goal progress and an account's available balance. */
function revalidateAll() {
  revalidatePath("/budgets");
  revalidatePath("/accounts");
  revalidatePath("/insights");
}

function goalSchema(nameRequired: string) {
  return z.object({
    name: z.string().trim().min(1, nameRequired).max(40),
    emoji: z.string().trim().max(8).optional().or(z.literal("")),
    color: z.string().trim().max(9).optional().or(z.literal("")),
    target_amount: z.coerce.number().positive(),
    target_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
  });
}

export async function createGoal(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = goalSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { data: last } = await supabase
    .from("savings_goals")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      target_amount: parsed.data.target_amount,
      target_date: parsed.data.target_date || null,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createGoal") };
  revalidateAll();
  return { id: data.id };
}

export async function updateGoal(id: string, input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = goalSchema(tg("nameRequired")).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("savings_goals")
    .update({
      name: parsed.data.name,
      emoji: parsed.data.emoji || null,
      color: parsed.data.color || null,
      target_amount: parsed.data.target_amount,
      target_date: parsed.data.target_date || null,
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateGoal") };
  revalidateAll();
  return { id };
}

export async function deleteGoal(id: string): Promise<Result> {
  const t = await getTranslations("Common");
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };
  // Contributions cascade, which releases the commitment on the origin accounts.
  const { error } = await supabase.from("savings_goals").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteGoal") };
  revalidateAll();
  return {};
}

const contributionSchema = z.object({
  goal_id: z.string().uuid(),
  account_id: z.string().uuid(),
  amount: z.coerce.number().refine((n) => n !== 0),
  exchange_rate: z.coerce.number().positive().default(1),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function addContribution(input: unknown): Promise<Result> {
  const t = await getTranslations("Common");
  const tg = await getTranslations("Goals");
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t("invalidInput") };
  const { supabase, user } = await requireUser();
  if (!user) return { error: t("notSignedIn") };

  // The dialog already filters the picker; this is the enforcement point.
  const { data: account } = await supabase
    .from("accounts")
    .select("type,currency,is_archived")
    .eq("id", parsed.data.account_id)
    .maybeSingle();
  if (!account) return { error: tg("accountMissing") };
  if (account.type === "credit_card" || account.type === "loan" || account.is_archived) {
    return { error: tg("accountNotContributable") };
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .insert({
      user_id: user.id,
      goal_id: parsed.data.goal_id,
      account_id: parsed.data.account_id,
      amount: parsed.data.amount,
      // Pinned to the account's currency by trigger; sent for the not-null check.
      currency: account.currency,
      exchange_rate: parsed.data.exchange_rate,
      occurred_at: `${parsed.data.occurred_at}T12:00:00Z`,
      note: parsed.data.note || null,
    })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "addContribution") };
  revalidateAll();
  return { id: data.id };
}
```

- [ ] **Step 3: Add the copy these actions reference**

In `messages/en.json`, add a top-level `"Goals"` object (keep the file's existing alphabetical-ish grouping; place it after `"CategoryDialog"`):

```json
"Goals": {
  "nameRequired": "Give the goal a name",
  "accountMissing": "That account no longer exists",
  "accountNotContributable": "Pick an account you can save from — not a credit card or loan"
}
```

In `messages/es.json`, add the same object:

```json
"Goals": {
  "nameRequired": "Ponle un nombre a la meta",
  "accountMissing": "Esa cuenta ya no existe",
  "accountNotContributable": "Elige una cuenta desde la que puedas ahorrar, no una tarjeta de crédito ni un préstamo"
}
```

- [ ] **Step 4: Verify it typechecks**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/goals/queries.ts app/\(app\)/budgets/goal-actions.ts messages/en.json messages/es.json
git commit -m "feat(goals): add goals queries and server actions"
```

---

## Task 6: Goal dialog and contribute dialog

**Files:**
- Create: `components/goals/goal-dialog.tsx`
- Create: `components/goals/contribute-dialog.tsx`

**Interfaces:**
- Consumes: `SWATCHES` from `@/lib/palette` (Task 2), `createGoal`/`updateGoal`/`addContribution` (Task 5), `GoalCardRow`/`ContributableAccount` (Task 5).
- Produces: `<GoalDialog mode? goal? trigger />`, `<ContributeDialog goal accounts baseCurrency trigger />`.

- [ ] **Step 1: Write `components/goals/goal-dialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { createGoal, updateGoal } from "@/app/(app)/budgets/goal-actions";
import { SWATCHES } from "@/lib/palette";
import type { GoalCardRow } from "@/lib/goals/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Values = { name: string; emoji: string; target_amount: string; target_date: string };

export function GoalDialog({
  mode = "create",
  goal,
  trigger,
}: {
  mode?: "create" | "edit";
  goal?: GoalCardRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(goal?.color ?? SWATCHES[0]);
  const router = useRouter();
  const t = useTranslations("GoalDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const defaults = (): Values => ({
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? "",
    target_amount: goal ? String(goal.target_amount) : "",
    target_date: goal?.target_date ?? "",
  });

  const { register, handleSubmit, reset } = useForm<Values>({ defaultValues: defaults() });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults());
      setColor(goal?.color ?? SWATCHES[0]);
    }
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && goal
          ? await updateGoal(goal.id, payload)
          : await createGoal(payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? t("editTitle") : t("addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16 space-y-2">
              <Label htmlFor="goal-emoji">{t("emojiLabel")}</Label>
              <Input id="goal-emoji" placeholder="🏝️" className="text-center" {...register("emoji")} />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="goal-name">{t("nameLabel")}</Label>
              <Input
                id="goal-name"
                placeholder={t("namePlaceholder")}
                required
                {...register("name")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">{t("targetLabel")}</Label>
            <Input
              id="goal-target"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="tabular-nums"
              {...register("target_amount")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-date">{t("targetDateLabel")}</Label>
            <Input id="goal-date" type="date" {...register("target_date")} />
            <p className="text-xs text-muted-foreground">{t("targetDateHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("colorLabel")}</Label>
            <div className="grid grid-cols-8 gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={t("colorSwatchAria", { color: c })}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background transition-all data-[active=true]:ring-2 data-[active=true]:ring-ring"
                  data-active={color === c}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write `components/goals/contribute-dialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { addContribution } from "@/app/(app)/budgets/goal-actions";
import type { ContributableAccount, GoalCardRow } from "@/lib/goals/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Values = { amount: string; occurred_at: string; note: string; exchange_rate: string };

const today = () => new Date().toISOString().slice(0, 10);

export function ContributeDialog({
  goal,
  accounts,
  baseCurrency,
  trigger,
}: {
  goal: GoalCardRow;
  accounts: ContributableAccount[];
  baseCurrency: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [withdraw, setWithdraw] = useState(false);
  const router = useRouter();
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { amount: "", occurred_at: today(), note: "", exchange_rate: "" },
  });

  const account = accounts.find((a) => a.id === accountId);
  // The goal's target is in base currency, so a foreign account needs a rate to
  // convert its contribution. Same shape as `transactions.exchange_rate`.
  const crossCurrency = !!account && account.currency !== baseCurrency;

  /* Value→label map for the closed trigger. Base UI's `<SelectValue>` renders
     the raw value unless `items` is given on the root, which would show a bare
     UUID here. Same fix as the ledger filters (components/transactions/ledger.tsx). */
  const accountItems: Record<string, string> = Object.fromEntries(
    accounts.map((a) => [a.id, `${a.name} · ${a.currency}`]),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ amount: "", occurred_at: today(), note: "", exchange_rate: "" });
      setAccountId(accounts[0]?.id ?? "");
      setWithdraw(false);
    }
  }

  function onSubmit(values: Values) {
    if (!accountId) {
      toast.error(t("pickAccount"));
      playError();
      return;
    }
    const magnitude = Math.abs(Number(values.amount));
    if (!Number.isFinite(magnitude) || magnitude === 0) {
      toast.error(t("amountRequired"));
      playError();
      return;
    }
    startTransition(async () => {
      const result = await addContribution({
        goal_id: goal.id,
        account_id: accountId,
        amount: withdraw ? -magnitude : magnitude,
        exchange_rate: crossCurrency ? values.exchange_rate || 1 : 1,
        occurred_at: values.occurred_at,
        note: values.note,
      });
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(withdraw ? t("toastWithdrawn") : t("toastContributed"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title", { name: goal.name })}</DialogTitle>
        </DialogHeader>
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noAccounts")}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="withdraw">{t("withdrawLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("withdrawHint")}</p>
              </div>
              <Switch id="withdraw" checked={withdraw} onCheckedChange={setWithdraw} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-account">{t("accountLabel")}</Label>
              <Select
                value={accountId}
                onValueChange={(v) => setAccountId(v ?? "")}
                items={accountItems}
              >
                <SelectTrigger id="contrib-account" className="w-full">
                  <SelectValue placeholder={t("accountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-amount">
                {t("amountLabel", { currency: account?.currency ?? baseCurrency })}
              </Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                required
                className="tabular-nums"
                {...register("amount")}
              />
            </div>

            {crossCurrency && (
              <div className="space-y-2">
                <Label htmlFor="contrib-rate">
                  {t("rateLabel", { from: account!.currency, to: baseCurrency })}
                </Label>
                <Input
                  id="contrib-rate"
                  type="number"
                  step="0.00000001"
                  min="0"
                  required
                  className="tabular-nums"
                  {...register("exchange_rate")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contrib-date">{t("dateLabel")}</Label>
              <Input id="contrib-date" type="date" required {...register("occurred_at")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-note">{t("noteLabel")}</Label>
              <Input id="contrib-note" placeholder={t("notePlaceholder")} {...register("note")} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} isLoading={pending}>
                {pending ? tc("saving") : withdraw ? t("withdrawButton") : t("contributeButton")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add the dialog copy**

In `messages/en.json`:

```json
"GoalDialog": {
  "addTitle": "New goal",
  "editTitle": "Edit goal",
  "emojiLabel": "Icon",
  "nameLabel": "Name",
  "namePlaceholder": "Japan trip",
  "targetLabel": "Target amount",
  "targetDateLabel": "Target date",
  "targetDateHint": "Optional. With a date we can tell you if you're on track.",
  "colorLabel": "Colour",
  "colorSwatchAria": "Use colour {color}",
  "addButton": "Add goal",
  "saveChangesButton": "Save changes",
  "toastAdded": "Goal added",
  "toastUpdated": "Goal updated"
},
"ContributeDialog": {
  "title": "Add to {name}",
  "accountLabel": "From account",
  "accountPlaceholder": "Pick an account",
  "amountLabel": "Amount ({currency})",
  "rateLabel": "Rate, 1 {from} to {to}",
  "dateLabel": "Date",
  "noteLabel": "Note",
  "notePlaceholder": "Optional",
  "withdrawLabel": "Withdraw instead",
  "withdrawHint": "Returns the money to that account's available balance",
  "contributeButton": "Contribute",
  "withdrawButton": "Withdraw",
  "toastContributed": "Contribution added",
  "toastWithdrawn": "Withdrawal recorded",
  "noAccounts": "Add a checking, savings, cash or investment account first — a goal has to be backed by real money.",
  "pickAccount": "Pick an account to save from",
  "amountRequired": "Enter an amount"
}
```

In `messages/es.json`:

```json
"GoalDialog": {
  "addTitle": "Nueva meta",
  "editTitle": "Editar meta",
  "emojiLabel": "Icono",
  "nameLabel": "Nombre",
  "namePlaceholder": "Viaje a Japón",
  "targetLabel": "Monto objetivo",
  "targetDateLabel": "Fecha objetivo",
  "targetDateHint": "Opcional. Con una fecha podemos decirte si vas al día.",
  "colorLabel": "Color",
  "colorSwatchAria": "Usar el color {color}",
  "addButton": "Agregar meta",
  "saveChangesButton": "Guardar cambios",
  "toastAdded": "Meta agregada",
  "toastUpdated": "Meta actualizada"
},
"ContributeDialog": {
  "title": "Agregar a {name}",
  "accountLabel": "Desde la cuenta",
  "accountPlaceholder": "Elige una cuenta",
  "amountLabel": "Monto ({currency})",
  "rateLabel": "Tasa, 1 {from} a {to}",
  "dateLabel": "Fecha",
  "noteLabel": "Nota",
  "notePlaceholder": "Opcional",
  "withdrawLabel": "Retirar en vez de aportar",
  "withdrawHint": "Devuelve el dinero al saldo disponible de esa cuenta",
  "contributeButton": "Aportar",
  "withdrawButton": "Retirar",
  "toastContributed": "Aporte agregado",
  "toastWithdrawn": "Retiro registrado",
  "noAccounts": "Primero agrega una cuenta corriente, de ahorro, efectivo o inversión: una meta debe estar respaldada por dinero real.",
  "pickAccount": "Elige una cuenta desde la que ahorrar",
  "amountRequired": "Ingresa un monto"
}
```

- [ ] **Step 4: Verify it typechecks and lints**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/goals messages/en.json messages/es.json
git commit -m "feat(goals): add goal and contribute dialogs"
```

---

## Task 7: The goals band — totals row and card grid

**Files:**
- Create: `components/goals/goal-grid.tsx`

**Interfaces:**
- Consumes: `GoalsOverview`, `GoalCardRow` (Task 5); `GoalDialog`, `ContributeDialog` (Task 6); `colorCardStyle` (Task 2); `deleteGoal` (Task 5).
- Produces: `<GoalGrid overview={GoalsOverview} />`.

- [ ] **Step 1: Write `components/goals/goal-grid.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { Plus, Trash2, Pencil, PiggyBank } from "lucide-react";
import { deleteGoal } from "@/app/(app)/budgets/goal-actions";
import { colorCardStyle } from "@/lib/palette";
import { formatMoney } from "@/lib/format";
import type { GoalCardRow, GoalsOverview } from "@/lib/goals/queries";
import type { Pace } from "@/lib/goals/pace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { GoalDialog } from "./goal-dialog";
import { ContributeDialog } from "./contribute-dialog";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export function GoalGrid({ overview }: { overview: GoalsOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Goals");
  const { playDelete, playError } = useUiSound();
  const { goals, totalSaved, totalTarget, totalBacked, totalShortfall, baseCurrency, accounts } =
    overview;

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteGoal(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("goalDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("sectionTitle")}
        </h2>
        <GoalDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t("addGoal")}
            </Button>
          }
        />
      </div>

      {goals.length > 0 && (
        /* The aggregate honesty check. The clamp makes per-account
           over-commitment impossible, so the only ways the totals drift are
           goals hollowed out by spending and an overdrawn account — and this
           line covers both. Targets exceeding assets is deliberately not
           flagged: that is the ordinary condition of having goals. */
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("totals", {
            saved: formatMoney(totalSaved, baseCurrency),
            target: formatMoney(totalTarget, baseCurrency),
            backed: formatMoney(totalBacked, baseCurrency),
          })}
          {totalShortfall > 0 && (
            <span className="text-destructive">
              {" · "}
              {t("totalsBorrowed", { amount: formatMoney(totalShortfall, baseCurrency) })}
            </span>
          )}
        </p>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="gap-0 p-5" style={colorCardStyle(goal.color)}>
              <div className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: goal.color
                      ? `color-mix(in oklab, ${goal.color} 16%, transparent)`
                      : "var(--accent)",
                    color: goal.color ?? "var(--accent-foreground)",
                  }}
                >
                  {goal.emoji ? <span className="text-sm">{goal.emoji}</span> : goal.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("amountOfTarget", {
                      saved: formatMoney(goal.saved, baseCurrency),
                      target: formatMoney(goal.target_amount, baseCurrency),
                    })}
                  </p>
                </div>
              </div>

              <GoalBar goal={goal} />

              <p className="mt-2 min-h-8 text-xs text-muted-foreground">
                <PaceLine pace={goal.pace} currency={baseCurrency} />
              </p>

              <div className="mt-3 flex items-center gap-1">
                <ContributeDialog
                  goal={goal}
                  accounts={accounts}
                  baseCurrency={baseCurrency}
                  trigger={
                    <Button size="sm" variant="outline" className="flex-1">
                      {t("contribute")}
                    </Button>
                  }
                />
                <GoalDialog
                  mode="edit"
                  goal={goal}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("editAria", { name: goal.name })}
                      className={cn("text-muted-foreground", TOUCH_TARGET)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteAria", { name: goal.name })}
                  className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
                  onClick={() => onDelete(goal.id)}
                  disabled={pending}
                  isLoading={pending}
                >
                  {pending ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Two segments: what is actually there in the goal's own colour, then what has
 * been borrowed back in a warning tint. A goal spent into looks visibly
 * hollowed out rather than merely reporting a smaller number.
 */
function GoalBar({ goal }: { goal: GoalCardRow }) {
  const target = goal.target_amount;
  // Clamped at the bottom because net withdrawals can drive `saved` negative.
  const filled = target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;

  return (
    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * backedShare}%`,
          backgroundColor: goal.color ?? "var(--brand)",
        }}
      />
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * (1 - backedShare)}%`,
          backgroundColor: "color-mix(in oklab, var(--warning) 45%, var(--muted))",
        }}
      />
    </div>
  );
}

function PaceLine({ pace, currency }: { pace: Pace; currency: string }) {
  const t = useTranslations("Goals");
  switch (pace.kind) {
    case "shortfall":
      return (
        <span className="text-destructive">
          {t("paceShortfall", { amount: formatMoney(pace.amount, currency) })}
        </span>
      );
    case "complete":
      return <span className="text-success">{t("paceComplete")}</span>;
    case "overdue":
      return <span className="text-destructive">{t("paceOverdue")}</span>;
    case "no-pace":
      return <>{t("paceNone")}</>;
    case "on-track":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-success">{t("paceOnTrack")}</span>
        </>
      );
    case "behind":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-warning">{t("paceBehind")}</span>
        </>
      );
    case "projection":
      return (
        <>
          {t("paceProjection", {
            actual: formatMoney(pace.actual, currency),
            months: pace.months,
          })}
        </>
      );
  }
}
```

- [ ] **Step 2: Add the goals band copy**

Extend the `"Goals"` object in `messages/en.json` (created in Task 5) with:

```json
"sectionTitle": "Savings goals",
"addGoal": "Add goal",
"goalDeleted": "Goal deleted",
"emptyTitle": "No savings goals yet",
"emptyDescription": "Set a target, then commit money to it from an account. Your balance stays put — we just tell you how much is still uncommitted.",
"totals": "Saved {saved} · Target {target} · Backed {backed}",
"totalsBorrowed": "{amount} borrowed back",
"amountOfTarget": "{saved} of {target}",
"contribute": "Contribute",
"editAria": "Edit {name}",
"deleteAria": "Delete {name}",
"paceShortfall": "{amount} borrowed back",
"paceComplete": "Target reached",
"paceOverdue": "Past its target date",
"paceNone": "No pace yet",
"paceNeedVsActual": "Need {required}/mo · saving {actual}/mo",
"paceOnTrack": "On track",
"paceBehind": "Behind",
"paceProjection": "Saving {actual}/mo → ~{months} months"
```

And in `messages/es.json`:

```json
"sectionTitle": "Metas de ahorro",
"addGoal": "Agregar meta",
"goalDeleted": "Meta eliminada",
"emptyTitle": "Aún no hay metas de ahorro",
"emptyDescription": "Define un objetivo y comprométele dinero desde una cuenta. Tu saldo no se mueve: solo te decimos cuánto sigue libre.",
"totals": "Ahorrado {saved} · Objetivo {target} · Respaldado {backed}",
"totalsBorrowed": "{amount} tomado de vuelta",
"amountOfTarget": "{saved} de {target}",
"contribute": "Aportar",
"editAria": "Editar {name}",
"deleteAria": "Eliminar {name}",
"paceShortfall": "{amount} tomado de vuelta",
"paceComplete": "Objetivo alcanzado",
"paceOverdue": "Pasó su fecha objetivo",
"paceNone": "Aún sin ritmo",
"paceNeedVsActual": "Necesitas {required}/mes · ahorras {actual}/mes",
"paceOnTrack": "Al día",
"paceBehind": "Atrasado",
"paceProjection": "Ahorrando {actual}/mes → ~{months} meses"
```

- [ ] **Step 3: Verify it typechecks and lints**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors. (`text-success` and `text-warning` are valid — `app/globals.css` maps `--color-success` / `--color-warning` in its `@theme` block, so Tailwind 4 generates both utilities.)

- [ ] **Step 4: Commit**

```bash
git add components/goals/goal-grid.tsx messages/en.json messages/es.json
git commit -m "feat(goals): add goals band with totals row and progress cards"
```

---

## Task 8: Wire the goals band into `/budgets`

**Files:**
- Modify: `app/(app)/budgets/page.tsx`
- Modify: `messages/en.json`, `messages/es.json` (page title, budgets band label, nav label)
- Modify: `lib/nav.ts` only if the nav label is keyed there rather than in messages — inspect first, do not change the `href`.

**Interfaces:**
- Consumes: `getGoalsOverview` (Task 5), `GoalGrid` (Task 7).
- Produces: the assembled page. No exports.

- [ ] **Step 1: Rewrite `app/(app)/budgets/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BudgetGrid } from "@/components/budgets/budget-grid";
import { GoalGrid } from "@/components/goals/goal-grid";
import { Separator } from "@/components/ui/separator";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { getGoalsOverview } from "@/lib/goals/queries";
import { normalizeMonth } from "@/lib/budgets/month";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [overview, goals] = await Promise.all([
    getBudgetOverview(month),
    getGoalsOverview(),
  ]);
  const t = await getTranslations("Budgets");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {/* Two bands, because they answer to different clocks. Budgets are scoped
          to a month and goals are cumulative, so an unlabelled month picker at
          the top of the page would appear to scope both. Inside a labelled band
          it visibly belongs to budgets alone — the same fix /insights uses by
          putting its picker in one section's heading. */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("sectionTitle")}
        </h2>
        <BudgetGrid month={month} overview={overview} />
      </section>

      <Separator />

      <GoalGrid overview={goals} />
    </div>
  );
}
```

- [ ] **Step 2: Update the page copy**

In `messages/en.json`, inside the existing `"Budgets"` object, add `sectionTitle` and change `pageTitle`/`pageDescription`:

```json
"pageTitle": "Budgets & Goals",
"pageDescription": "What you plan to spend this month, and what you're saving toward.",
"sectionTitle": "Budgets",
```

In `messages/es.json`, inside `"Budgets"`:

```json
"pageTitle": "Presupuestos y metas",
"pageDescription": "Lo que planeas gastar este mes y aquello para lo que estás ahorrando.",
"sectionTitle": "Presupuestos",
```

- [ ] **Step 3: Update the nav label**

Inspect how the nav renders its label:

```bash
grep -n "budgets" lib/nav.ts
grep -n "\"Nav\"\|Nav\." -r components/shell app/\(app\)/page.tsx | head
```

`lib/nav.ts` holds `{ href: "/budgets", key: "budgets", icon: PieChart }` in two places — the `key` resolves to a message. Find the message object that contains a `"budgets"` key and update its value to `"Budgets & Goals"` (en) and `"Presupuestos y metas"` (es). **Do not change the `href` or the `key`** — only the display string. If the label proves too long for the sidebar rail at its narrowest, keep the nav as "Budgets" and note it in the commit message; the page title carries the discoverability either way.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: no errors, all tests pass.

- [ ] **Step 5: Ask before starting the dev server, then check the page**

Ask the user before starting or killing the dev server. Once approved:

```bash
npm run dev
```
Visit `http://localhost:3000/budgets` and confirm: the budgets band renders as before under a "BUDGETS" label, a rule separates it from a "SAVINGS GOALS" band, the empty state shows, and "Add goal" opens the dialog.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/budgets/page.tsx messages/en.json messages/es.json lib/nav.ts
git commit -m "feat(goals): add the goals band to the budgets page"
```

---

## Task 9: Available balance on the accounts page

**Files:**
- Modify: `lib/accounts/queries.ts` (`AccountWithStatus`, `getAccountsWithStatus`, `getAccountById`)
- Modify: `components/accounts/account-card.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `getAccountFunding` (Task 5).
- Produces: `AccountWithStatus` gains `committed: number` and `available: number`.

- [ ] **Step 1: Extend `lib/accounts/queries.ts`**

Add the import:
```ts
import { getAccountFunding } from "@/lib/goals/queries";
```

Extend the type:
```ts
export type AccountWithStatus = AccountRow & {
  balance: number | null;
  /** Committed to savings goals, in the account's own currency. */
  committed: number;
  /** balance − committed. Never negative unless the balance itself is. */
  available: number;
  cardStatus: CardRow | null;
  loanStatus: LoanRow | null;
};
```

In `getAccountsWithStatus`, add `getAccountFunding()` to the `Promise.all` array and use it in the map:

```ts
const [{ data: accounts }, { data: balances }, { data: cards }, { data: loans }, funding] =
  await Promise.all([
    // ...the four existing queries, unchanged...
    getAccountFunding(),
  ]);
```

```ts
return (accounts ?? []).map((a) => {
  const balance = balByAcct.get(a.id) ?? a.starting_balance;
  const f = funding.get(a.id);
  return {
    ...a,
    balance,
    committed: f?.committed ?? 0,
    available: f?.available ?? balance,
    cardStatus: cardByAcct.get(a.id) ?? null,
    loanStatus: loanByAcct.get(a.id) ?? null,
  };
});
```

Do the same in `getAccountById`:

```ts
const [{ data: balance }, { data: card }, { data: loan }, funding] = await Promise.all([
  // ...the three existing queries, unchanged...
  getAccountFunding(),
]);

const resolved = balance?.balance ?? account.starting_balance;
const f = funding.get(id);

return {
  ...account,
  balance: resolved,
  committed: f?.committed ?? 0,
  available: f?.available ?? resolved,
  cardStatus: card ?? null,
  loanStatus: loan ?? null,
};
```

- [ ] **Step 2: Render the line in `components/accounts/account-card.tsx`**

Read the file first to find where the balance figure is rendered. Directly beneath that figure, add:

```tsx
{account.committed > 0 && (
  <p className="text-xs text-muted-foreground tabular-nums">
    {t("availableCommitted", {
      available: formatMoney(account.available, account.currency),
      committed: formatMoney(account.committed, account.currency),
    })}
  </p>
)}
```

Use the file's existing `useTranslations` namespace and its existing `formatMoney` import; add them only if absent. The guard means an account with no goal commitments renders exactly as it does today.

- [ ] **Step 3: Add the copy**

`messages/en.json`, inside the existing accounts namespace used by `account-card.tsx`:
```json
"availableCommitted": "{available} available · {committed} committed"
```

`messages/es.json`:
```json
"availableCommitted": "{available} disponible · {committed} comprometido"
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/accounts/queries.ts components/accounts/account-card.tsx messages/en.json messages/es.json
git commit -m "feat(goals): show available vs committed balance on account cards"
```

---

## Task 10: Savings goals card on `/insights`

**Files:**
- Create: `components/insights/savings-goals.tsx`
- Modify: `app/(app)/insights/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `getGoalsOverview` (Task 5), the page's local `ChartCard` and `Tally` helpers.
- Produces: `<SavingsGoals goals={GoalCardRow[]} totalSaved totalTarget currency />`.

- [ ] **Step 1: Write `components/insights/savings-goals.tsx`**

```tsx
import { formatMoney } from "@/lib/format";
import type { GoalCardRow } from "@/lib/goals/queries";
import { getTranslations } from "next-intl/server";

/**
 * Goals belong in the `position` band rather than `this month`: they are
 * cumulative and month-independent, so the month picker in the other band's
 * heading would falsely claim to scope them.
 */
export async function SavingsGoals({
  goals,
  totalSaved,
  totalTarget,
  currency,
}: {
  goals: GoalCardRow[];
  totalSaved: number;
  totalTarget: number;
  currency: string;
}) {
  const t = await getTranslations("Insights");
  const tg = await getTranslations("Goals");

  if (goals.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("savingsGoalsEmpty")}</p>;
  }

  const verdict = (g: GoalCardRow) => {
    switch (g.pace.kind) {
      case "shortfall":
        return { label: tg("paceShortfall", { amount: formatMoney(g.pace.amount, currency) }), tone: "text-destructive" };
      case "complete":
        return { label: tg("paceComplete"), tone: "text-success" };
      case "overdue":
        return { label: tg("paceOverdue"), tone: "text-destructive" };
      case "on-track":
        return { label: tg("paceOnTrack"), tone: "text-success" };
      case "behind":
        return { label: tg("paceBehind"), tone: "text-warning" };
      case "projection":
        return { label: tg("paceProjectionShort", { months: g.pace.months }), tone: "text-muted-foreground" };
      case "no-pace":
        return { label: tg("paceNone"), tone: "text-muted-foreground" };
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-3 pb-4">
        {goals.map((g) => {
          const v = verdict(g);
          const pct = g.target_amount > 0
            ? Math.min(Math.max(g.saved / g.target_amount, 0), 1) * 100
            : 0;
          return (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {g.emoji ? `${g.emoji} ` : ""}
                  {g.name}
                </span>
                <span className={`shrink-0 text-xs ${v.tone}`}>{v.label}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: g.color ?? "var(--brand)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex items-baseline justify-between border-t pt-3 text-sm font-medium">
        <span className="text-foreground">{t("savingsGoalsTotal")}</span>
        <span className="tabular-nums text-foreground">
          {formatMoney(totalSaved, currency)} / {formatMoney(totalTarget, currency)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the card to `app/(app)/insights/page.tsx`**

Add the imports:
```tsx
import { getGoalsOverview } from "@/lib/goals/queries";
import { SavingsGoals } from "@/components/insights/savings-goals";
```

Add `getGoalsOverview()` to the existing `Promise.all`:
```tsx
const [insights, carry, cardPayments, netWorth, goals] = await Promise.all([
  getInsights(month),
  getCostOfCarry(),
  getCardPayments(month),
  getNetWorthHistory(),
  getGoalsOverview(),
]);
```

Inside `<Section title={t("sectionPosition")}>`, after the Cash Flow `ChartCard`, add:

```tsx
<ChartCard title={t("cardSavingsGoals")} className="@[34rem]:col-span-2">
  <SavingsGoals
    goals={goals.goals}
    totalSaved={goals.totalSaved}
    totalTarget={goals.totalTarget}
    currency={goals.baseCurrency}
  />
</ChartCard>
```

- [ ] **Step 3: Add the copy**

`messages/en.json`, in `"Insights"`:
```json
"cardSavingsGoals": "Savings goals",
"savingsGoalsTotal": "Total saved",
"savingsGoalsEmpty": "No savings goals yet"
```
`messages/en.json`, in `"Goals"`:
```json
"paceProjectionShort": "~{months} months"
```

`messages/es.json`, in `"Insights"`:
```json
"cardSavingsGoals": "Metas de ahorro",
"savingsGoalsTotal": "Total ahorrado",
"savingsGoalsEmpty": "Aún no hay metas de ahorro"
```
`messages/es.json`, in `"Goals"`:
```json
"paceProjectionShort": "~{months} meses"
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run lint && npm test
```
Expected: no errors, all tests pass.

- [ ] **Step 5: End-to-end check**

Ask the user before starting the dev server. Once approved, with `npm run dev` running:

1. `/budgets` → add a goal with a target and a date.
2. Contribute from an account with a known balance.
3. `/accounts` → that account shows "X available · Y committed", and its headline balance is **unchanged**.
4. `/` (overview) → net worth is **unchanged** by the contribution.
5. Add an expense that drops the account below the committed amount → the goal card shows "borrowed back", and the goals totals row shows it too.
6. `/insights` → the Savings goals card appears in the first band, above the month picker's band.

- [ ] **Step 6: Commit**

```bash
git add components/insights/savings-goals.tsx app/\(app\)/insights/page.tsx messages/en.json messages/es.json
git commit -m "feat(goals): add savings goals card to insights"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §1 Data model, RLS, triggers | 1 |
| §1.3 Currency (base_amount trigger, currency pinning) | 1 |
| §1.4 Withdrawals | 1 (schema), 3 (netting), 6 (toggle) |
| §2.1–2.2 Clamp and view | 1 (view), 3 (clamp) |
| §2.3 Per-goal backing, newest-first, tie-break, negative pairs | 3 |
| §3 Page layout, bands, separator | 8 |
| §3.1 Two-segment progress bar | 7 |
| §3.2 Totals row | 7 |
| §3.3 16 swatches + card shading | 2 |
| §3.4 Dialogs | 6 |
| §3.5 Accounts available line | 9 |
| §4.1 Per-goal pace + degraded states | 4 (logic), 7 (rendering) |
| §4.2 Insights card in `sectionPosition` | 10 |
| §5 Server actions + revalidation | 5 |
| §6 Testing | 3, 4 |
| §7 Scope (nav/title rename) | 8 |

No gaps.

**Type consistency**

`GoalCardRow.id` is used consistently (not `goal_id`) across Tasks 5–10. `computeFunding` returns `Funding` with `goals`/`accounts` maps in Task 3 and is consumed that way in Task 5. `Pace` is discriminated on `kind` in Task 4 and every branch is handled in Tasks 7 and 10 — `shortfall`, `complete`, `overdue`, `no-pace`, `on-track`, `behind`, `projection`. `colorCardStyle` and `SWATCHES` are exported in Task 2 and imported in Tasks 6 and 7.

**Known follow-up not in this plan**

`--chart-1` (`#3e5fad`) measures 2.93:1 against the dark card, marginally under 3:1. Pre-existing, applies to existing category data, and fixing it properly means migrating stored colours from literal hex to theme-aware tokens — out of scope per spec §8.
