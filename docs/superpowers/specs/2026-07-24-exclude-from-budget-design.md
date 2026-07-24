# Exclude Card Expenses from Budget — Design

**Date:** 2026-07-24
**Status:** Approved direction, pending spec review

## 0. Background

Card expenses are sometimes made on behalf of someone else, or are a business expense —
the money genuinely left the card and is genuinely owed, but it isn't "your" spending and
shouldn't count against your personal category budgets. This is most common on **imported**
transactions (statement lines), though it can happen on manually entered ones too.

Not a majority case, so a simple per-transaction toggle is enough — no bulk-tagging UI.

This is the mirror image of the existing `budget_only` column: `budget_only` counts a
transaction *only* toward budget, excluding it from balance/net worth (a manual placeholder
for cash spend, say). The new flag counts a transaction toward balance/debt/net worth as
normal, but excludes it *only* from budget and spend-tracking views.

## 1. Data model

New column on `transactions`:

```sql
alter table public.transactions
  add column exclude_from_budget boolean not null default false;
```

No constraint tying it to `type = 'expense'` — mirrors `budget_only`, which is also a plain
column with the type restriction enforced at the application layer (form + `toRow()`), not
the DB. Applies to `expense` type only for now, matching where category budgets are shown in
the UI.

## 2. What changes downstream

Two SQL functions currently aggregate `used` spend per category and both need the new filter.
The active `category_usage` definition is the one in
`supabase/migrations/20260722120000_statement_import.sql` (a later `create or replace` than
the original in `20260717234230_derived_views.sql`) — add `and not t.exclude_from_budget` to
its `used` subquery. `spend_distribution` (`20260717234230_derived_views.sql`) gets the same
filter added directly to its `where` clause.

Both changes go in ONE new migration file (`create or replace function`, full body) since that
is this codebase's existing pattern for evolving these functions (see the two `category_usage`
definitions already in history).

Consumers that call these RPCs need no code changes — they inherit the filter automatically:

- `lib/budgets/queries.ts` → `getBudgetOverview` (Budgets page bars, via `category_usage`)
- `lib/overview/queries.ts` (dashboard "budget used" figure, via `category_usage`)
- `lib/insights/queries.ts` → `distribution` and `budgetBars` (via `spend_distribution` /
  `category_usage`)

One consumer bypasses the RPCs with a raw table query and needs an explicit filter added:

- `lib/insights/queries.ts`, the `expenses` query that drives the spending-pace chart
  (currently `.eq("type", "expense").eq("budget_only", false)...`) — add
  `.eq("exclude_from_budget", false)`.

**Unaffected by design:** `monthly_cashflow`, `card_status`, `loan_status`, account balance
triggers, net worth — none of these look at budget-related flags at all; they already sum
real transactions regardless, which is exactly the desired behavior (the money still moved).

## 3. Server actions (`app/(app)/transactions/actions.ts`)

- `toRow()`: add `exclude_from_budget: v.type === "expense" ? v.exclude_from_budget : false,`
  next to the existing `budget_only` line.
- Statement-sourced rows currently only allow editing `category_id` and `notes`
  (`statementEdit` schema + the restricted branch in `updateTransaction`). Extend
  `statementEdit` with `exclude_from_budget: z.boolean().default(false)` and include it in
  that branch's `.update({...})` payload. This is the one field, besides category/notes, that
  becomes editable on imported transactions — deliberate, since imports are the primary use
  case.

## 4. Schema & form

- `lib/transactions/schema.ts`: add `exclude_from_budget: z.boolean().default(false)` to
  `transactionInput`, next to `budget_only`.
- `components/transactions/transaction-form.tsx`:
  - `FormValues.exclude_from_budget: boolean`.
  - Default values: from `transaction.exclude_from_budget` when editing, `false` when
    creating.
  - New `Controller` + `ToggleRow` directly below the existing `budget_only` toggle, same
    `type === "expense"` guard. **Not** disabled by `fromStatement` (unlike every other
    toggle in that block) — this is the one field imports can edit.
  - Update `fromStatementHint` copy since one more field is now editable on statement rows.
- `components/transactions/transaction-row.tsx`: a small badge next to the existing
  "budget only" badge when `txn.exclude_from_budget` is true.

## 5. i18n

Add to `messages/en.json` and `messages/es.json`:

- `Transactions.excludeFromBudgetBadge`
- `TransactionForm.excludeFromBudgetLabel`
- `TransactionForm.excludeFromBudgetHint`
- Update `TransactionForm.fromStatementHint` copy in both locales.

## 6. Types

No live Supabase project is linked in this environment (`supabase` CLI absent, no local
Docker instance), so `lib/supabase/types.ts` can't be regenerated via `db:types`. Hand-edit the
`transactions` Row/Insert/Update types to add `exclude_from_budget: boolean` (Insert/Update
optional with default), mirroring the existing `budget_only` entries exactly. Flag this to the
user as something to double check next time `supabase gen types` is run against the real
project.

## 7. Testing

No existing SQL test harness in this repo (migrations are applied via `db:push`, no pgTAP or
similar found). Verification is: `tsc --noEmit`, `npm run lint`, and a manual walkthrough —
create an expense, toggle "Exclude from budget" on, confirm it drops out of the Budgets page
`used` figure and the Insights donut/pace chart while account balance stays unchanged; repeat
on an imported (statement-sourced) transaction to confirm the toggle is actually editable
there and persists.

## 8. Out of scope

- Bulk-tagging multiple imported transactions at once.
- Applying the toggle to `type = 'payment'` transactions (category budgets conceptually apply
  to spending; payments with a category are an edge case not part of this request).
