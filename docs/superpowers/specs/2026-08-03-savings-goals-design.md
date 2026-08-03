# Savings Goals — Design

**Date:** 2026-08-03
**Status:** Approved direction, pending spec review

## 0. Background

The app tracks what you spend (budgets) and what you owe (cards, loans), but has nothing
for what you're saving *toward*. This adds savings goals: named, emoji'd, coloured targets
that live alongside budgets on `/budgets` and share their card grid.

The design problem is what a "contribution" means. Most savings features assume you have a
dedicated savings account and move real money into it — but plenty of users have exactly
one account, and a goal that depends on a transfer between accounts is unusable for them.
The opposite extreme, a standalone ledger of amounts you type in, is worse: it reports
progress that corresponds to no real money, so a goal can claim $2,000 saved while no
account holds it.

The model here is neither. A goal is an **envelope** — an account-like container that money
is committed to from a real account. Contributing $400 from Checking doesn't move money in
the real world, but it reduces Checking's **available** balance in the app: you still have
$1,000, but only $600 of it is uncommitted. Net worth doesn't change, because the money is
still yours. This gives an honest answer to "how much can I actually spend?" without
requiring a second bank account.

The consequence that needs handling is what happens when you spend past your commitments —
`available` would go negative, which is meaningless. Section 2 resolves this as a clamp
rather than as bookkeeping.

## 1. Data model

Two new tables. `savings_goals` deliberately mirrors `categories` (name / emoji / color /
sort_order) so `CategoryDialog`'s structure, the seven colour swatches and the budget card's
chip treatment all carry over.

```sql
create table public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  emoji         text,
  color         text,
  target_amount numeric(18,4) not null check (target_amount > 0),  -- base currency
  target_date   date,                                             -- optional
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.goal_contributions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  goal_id       uuid not null references public.savings_goals (id) on delete cascade,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  amount        numeric(18,4) not null check (amount <> 0),  -- account currency
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
```

Both tables get the standard four owner RLS policies (`select` / `insert` / `update` /
`delete`, each `to authenticated using ((select auth.uid()) = user_id)`) and a
`set_updated_at` trigger, exactly as `categories` and `category_budgets` do.

### 1.1 Naming

`savings_goals`, not `goals`: `accounts` already carries `welcome_bonus_goal_amount`,
`welcome_bonus_goal_currency` and `welcome_bonus_due_date` for credit-card sign-up bonuses,
so the bare word is taken and would read ambiguously in queries.

### 1.2 `account_id` is required

A contribution must name the account it is committed from. This is the whole basis of the
model's honesty — a contribution with no origin is an unbacked number. `on delete cascade`
matches `transactions.account_id`: deleting an account already takes its transactions with
it, so its commitments going too is consistent.

The account picker excludes `credit_card` and `loan` accounts (saving onto a credit card is
not a coherent action) and archived accounts.

### 1.3 Currency

`target_amount` is in the user's base currency. `amount` is in the **origin account's**
currency, because the commitment has to be deducted from that account in its own units.
`base_amount` bridges them, computed by a trigger that copies
`transactions_compute_amounts`:

```sql
new.base_amount := round(new.amount * new.exchange_rate, 4);
```

A second trigger pins `currency` to the origin account's `currency` on insert and update, so
a contribution can never drift from the account it deducts from. The contribute dialog only
surfaces an exchange-rate field when the selected account's currency differs from base;
otherwise the rate is 1.

Progress toward a goal sums `base_amount`. An account's commitment sums `amount`.

### 1.4 Withdrawals

A negative `amount` is a withdrawal. No separate table and no status column: it reduces both
the goal's progress and the account's commitment by the same arithmetic that a positive
contribution increases them. `check (amount <> 0)` keeps out no-op rows.

### 1.5 What is not touched

`transactions` gains no `goal_id` column, no new `transaction_type` value, and no changes to
`payment_needs_destination`, `expense_requires_category`, `transactions_compute_amounts`,
`transactions_sync_card_balance` or any other existing trigger. A contribution is not an
expense, so cashflow, spending pace and the spend donut stay correct with no changes.

## 2. Deriving available balance

### 2.1 The clamp

An account cannot hold back more money than it has. Rather than writing "raid" rows when
spending eats into commitments, the effective commitment is clamped at read time:

```
committed(account) = min( max(committed_raw, 0), max(balance, 0) )
available(account) = balance − committed(account)          -- never negative
```

where `committed_raw` is the signed sum of that account's contributions.

This is the central simplification of the design. The alternative — a trigger that deducts
from a goal when a transaction overdraws the available balance — has three problems that
the clamp does not have:

- **Which goal?** A trigger must pick one and write to it. The clamp defers that to a
  display-time allocation (§2.3) that can be recomputed freely.
- **Edits and deletes.** A written raid goes stale the moment the transaction that caused it
  is edited or deleted. The clamp only ever reads current balance.
- **Backdating.** Statement imports insert transactions *in the past*. A raid computed at
  insert time is wrong as soon as an earlier row lands. The clamp has no notion of insert
  order.

The clamp also self-heals: spend down and a goal's backing shrinks; get paid and it returns,
with no reconciliation step.

### 2.2 The view

```sql
create view public.account_commitments with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       coalesce(sum(gc.amount), 0) as committed_raw
from public.accounts a
left join public.goal_contributions gc on gc.account_id = a.id
where a.type not in ('credit_card', 'loan')
group by a.id, a.user_id;
```

The `not in ('credit_card', 'loan')` filter matches `account_balances`, which excludes both:
credit cards from the start, and loans since
`20260719124500_fix_account_balances_exclude_loans.sql` — each is represented solely by its
`*_status` view. The two therefore join one-to-one with no missing rows.

`account_balances` is **not modified**. `lib/overview/queries.ts` and
`lib/insights/net-worth-history.ts` read it directly and therefore need no changes: net worth
continues to reflect real balances, which is correct, because committing money to a goal
does not make the user poorer.

### 2.3 Per-goal backing

`committed` tells an account how much of its balance is spoken for, but a goal card needs to
know how much of *its own* progress is actually backed. Allocation runs per
`(account, goal)` pair rather than per contribution row — simpler than walking individual
rows, and withdrawals net out for free:

For each account, order the goals it funds by **most recent contribution date, newest
first**, and give each its full net amount until the account's `committed` capacity is
exhausted. Anything unallocated is that goal's shortfall.

Pairs whose net amount is zero or negative (the goal was withdrawn from that account at
least as much as was put in) are skipped: they consume no capacity and receive no
allocation. Ties in contribution date are broken by `goal_contributions.id` so the result
is stable across requests.

Newest-first ("the money you set aside most recently is the first borrowed back") is chosen
because it is deterministic, explainable in one sentence, and matches the intuition that
recent commitments are the least settled.

Each goal therefore carries three figures:

| Figure      | Meaning                                          |
|-------------|--------------------------------------------------|
| `saved`     | Σ `base_amount` — what has been set aside         |
| `backed`    | The portion actually present in its origin accounts |
| `shortfall` | `saved − backed`, shown only when non-zero        |

A goal funded from several accounts sums its allocation across each of them.

### 2.4 Where it lives

`lib/goals/funding.ts`, as a pure function over plain rows. This follows the precedent set by
`lib/insights/net-worth-history.ts`: the non-trivial derivations in this codebase are
TypeScript rather than SQL, which makes them unit-testable and is why the SQL net-worth view
was dropped in `20260728120000_drop_net_worth_view.sql`.

## 3. Page layout

Route stays `/budgets`. No new page and no new nav entry — goals sit below a rule on the
existing page.

```
Budgets & Goals                                    ← PageHeader

BUDGETS                                            ← xs uppercase tracking-wider muted
  ┌ ‹ August 2026 ›      Budget · Used · Remaining ┐   (existing month card, unchanged)
  [Copy last month]              [grid|table] [+ Category]
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 🍔 Food  │ │ 🚗 Auto  │ │ 🏠 Home  │              (existing BudgetGrid, unchanged)
  └──────────┘ └──────────┘ └──────────┘

─────────────────────────── <Separator />

SAVINGS GOALS                                        [+ Add goal]
  ┌──────────────────┐ ┌──────────────────┐
  │ 🏝️ Japan Trip     │ │ 🛟 Emergency     │
  │ $800 of $1,000   │ │ $2,400 of $10,000│
  │ ████████████░░░  │ │ ████░░░░░░░░░░░  │
  │ need $40/mo ·    │ │ saving $200/mo   │
  │ saving $130/mo ✓ │ │ → ~38 months     │
  │ [Contribute] ✏️ 🗑 │ │ [Contribute] ✏️ 🗑│
  └──────────────────┘ └──────────────────┘
```

The divider is `components/ui/separator.tsx`, already in the project. The band headings use
the `xs uppercase tracking-wider text-muted-foreground` type that `/insights` uses for its
section labels.

Labelling the budgets band is what makes the month picker honest. Budgets are month-scoped
and goals are cumulative; without a band heading, a picker at the top of the page appears to
scope both. Inside a labelled band above the rule, it visibly belongs to budgets only. This
is the same problem `/insights` solves by putting its picker in one band's heading rather
than at the top of the page.

The goals grid reuses `sm:grid-cols-2 lg:grid-cols-3`, the `Card` component, the emoji/colour
chip (`color-mix(in oklab, {color} 16%, transparent)` background), the `TOUCH_TARGET`
treatment and `EmptyState`, so both halves read as one system.

### 3.1 The progress bar

Two segments: `backed` in the goal's own colour, then `shortfall` in a muted warning tint.
A goal that has been spent into looks visibly hollowed out rather than merely reporting a
smaller number. Bar width is `clamp(saved / target, 0, 1)` — clamped at the bottom because
net withdrawals can drive `saved` negative — and the split within it is `backed : shortfall`.

### 3.2 Dialogs

Both modelled on `CategoryDialog` (`react-hook-form`, `useTransition`, sonner toast,
`useUiSound`, `router.refresh()`).

**Goal dialog** (create / edit) — emoji, name, the same seven colour swatches, target amount,
optional target date.

**Contribute dialog** — amount, origin account (non-archived, not `credit_card`, not `loan`),
date, optional note, and an exchange-rate field shown only when the account's currency isn't
base. A "Withdraw" toggle negates the amount on submit rather than asking the user to type a
minus sign.

Deleting a goal cascades its contributions, which releases the commitment on the origin
accounts. Deletion is confirmed, matching how category deletion behaves.

### 3.3 Accounts page

`AccountWithStatus` gains `committed` and `available`. `getAccountsWithStatus` and
`getAccountById` fetch `account_commitments` alongside `account_balances` and apply the clamp.
The account card renders one secondary line, only when `committed > 0`:

```
Checking                    $1,000.00
                 $600 available · $400 committed
```

The overview dashboard and net worth are unchanged and keep showing real balances.

## 4. The insight

### 4.1 Per-goal pace, on the card

```
monthsLeft   = max(months from this month's start to target_date's month, 1)
required/mo  = (target − saved) / monthsLeft
actual/mo    = Σ base_amount over the last 3 months / 3
               (or Σ since first contribution / months elapsed, min 1, if younger)

verdict:  saved ≥ target      → complete
          actual ≥ required   → on track
          otherwise           → behind

no target_date and actual > 0:  monthsToGo = ceil((target − saved) / actual)
                                → "~38 months at this rate"
```

Degraded states are explicit rather than arithmetic accidents:

| Condition                              | Display                                   |
|----------------------------------------|-------------------------------------------|
| No contributions yet                   | "no pace yet"                             |
| `target_date` passed, not complete     | "overdue"                                 |
| No date and `actual = 0`               | "no pace yet"                             |
| `shortfall > 0`                        | Shortfall replaces the pace line          |

The shortfall takes precedence because "you've borrowed $200 back" is more urgent than a
pace verdict computed against money that isn't there.

This lives in `lib/goals/pace.ts` as a pure function.

### 4.2 Insights page card

A "Savings goals" `ChartCard` in the **`sectionPosition`** band of `/insights`, beside net
worth — not `sectionThisMonth`, because goals are cumulative and month-independent, and the
month picker in that band's heading would falsely claim to scope them.

It renders as the existing `Tally` component: one row per goal showing progress and verdict,
closed by total saved against total target.

## 5. Server actions

`app/(app)/budgets/goal-actions.ts`, following the shape of the existing
`app/(app)/budgets/actions.ts` — `"use server"`, zod validation, `requireUser()`,
`dbError()`, and a `{ error?, id? }` result:

- `createGoal` / `updateGoal` / `deleteGoal`
- `addContribution` / `deleteContribution`

Every one revalidates `/budgets` **and** `/accounts`, since a contribution moves the
available figure on both. `addContribution` additionally validates that the chosen account is
not `credit_card`, `loan` or archived, mirroring the client-side filter — the client filter
is a convenience, not the enforcement point.

## 6. Testing

Both derivations are pure functions over plain rows, tested with vitest in the style of the
existing `lib/insights/net-worth-history.test.ts`.

**`lib/goals/funding.test.ts`**

- One goal, commitment within account balance → fully backed, no shortfall
- One goal, commitment exceeds balance → clamped, shortfall equals the excess
- Two goals sharing an account with insufficient balance → newest-first allocation, older
  goal fully backed, newest goal carries the shortfall
- A withdrawal reduces both progress and commitment
- Account at zero balance → everything unbacked
- Account at negative balance → `committed` is 0, `available` equals the negative balance
- One goal funded from two accounts → allocation sums across both
- `credit_card` and `loan` accounts never appear in `account_commitments`

**`lib/goals/pace.test.ts`**

- Required vs. actual, on track and behind
- No target date → month projection
- Target date in the past, incomplete → overdue
- Zero contributions → "no pace yet"
- Already complete
- Shortfall present → shortfall takes precedence over the pace verdict

## 7. Scope

**New**

- `supabase/migrations/<timestamp>_savings_goals.sql`
- `lib/goals/queries.ts`, `lib/goals/funding.ts`, `lib/goals/pace.ts`
- `lib/goals/funding.test.ts`, `lib/goals/pace.test.ts`
- `app/(app)/budgets/goal-actions.ts`
- `components/goals/goal-grid.tsx`, `goal-dialog.tsx`, `contribute-dialog.tsx`
- `components/insights/savings-goals.tsx`

**Modified**

- `app/(app)/budgets/page.tsx` — band headings and separator
- `lib/accounts/queries.ts`, `components/accounts/account-card.tsx` — available line
- `app/(app)/insights/page.tsx` — one card in `sectionPosition`
- `messages/en.json`, `messages/es.json`
- `lib/supabase/types.ts` — regenerated
- Nav label and page title: "Budgets" → "Budgets & Goals"

**Untouched**

`transactions` and all its triggers and constraints; `account_balances`; net worth
(`lib/overview/queries.ts`, `lib/insights/net-worth-history.ts`); cashflow; spending pace;
the spend donut; `category_usage`.

## 8. Deliberately out of scope

- Automatic contributions (round-ups, "save X% of income", month-end budget sweeps). The
  manual path has to be right first, and each of these is a scheduling problem rather than a
  goals problem.
- Goal-to-goal transfers. Withdraw and re-contribute covers it.
- Shared or multi-user goals.
- Blocking over-commitment across accounts. The sum of all goals may exceed total assets;
  the clamp keeps each account honest, and per-goal shortfalls surface the consequence. A
  hard block would be a wrong answer for someone deliberately planning ahead.
