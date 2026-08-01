# Credit Card Budget & Cashflow Realignment — Design

**Date:** 2026-07-31
**Status:** Approved direction, pending spec review

## 0. Background

Most people don't count an individual credit card purchase against their budget — they
count the card *payment*, because that's when money actually leaves an account they can
run out of. The app currently does the opposite: card expenses count toward budget by
default, and the payment that settles the card is explicitly excluded from budget
(`category_usage` hardcodes out payments whose destination is a `credit_card` account, added
in `20260722120000_statement_import.sql` "to avoid double-counting"). Cashflow has the same
mismatch: it sums `expense` rows and ignores `payment` rows entirely, so a card bill payment
never shows as outflow, and a card purchase — money that hasn't left yet — does.

This flips the model: card *expenses* default to excluded from budget (the existing
per-transaction toggle just changes its default), the *payment* against the card counts
toward budget instead, and cashflow is redefined around real money movement rather than
transaction type.

Two smaller fixes ride along because they're part of the same mental model:
credit card payments currently can't carry a category (a leftover from the old
"payments don't count" assumption) — fixed here — and the `budget_only` toggle ("counts
toward budget only, not balance") is removed outright; it has no serious use case and its
existence is what makes the payment-side story here otherwise confusing to explain.

## 1. Credit card expenses: exclude-from-budget default

The `exclude_from_budget` field, toggle, and its "Still counts toward balance and net
worth" hint (`transaction-form.tsx`, `excludeFromBudgetLabel`/`excludeFromBudgetHint` in
messages) are unchanged in meaning. Only the **default** changes:

- When creating a new `expense` transaction and the selected (source) account's `type` is
  `credit_card`, default the checkbox to checked.
- Reuse the existing smart-default pattern already in `transaction-form.tsx` (the
  `include_tax`/`include_commission` effect at lines 233–238, guarded by `if (isEdit || !src)
  return` and keyed on `[type, toAccountId, accountId]`): add `exclude_from_budget` to that
  same effect, `setValue("exclude_from_budget", type === "expense" && src?.type ===
  "credit_card")`. This only recomputes on account/type change in create mode, so a manual
  toggle survives until the user changes account or type again — same behavior the tax/fee
  defaults already have.
- Editing an existing transaction always keeps its saved value (unchanged from today).

## 2. Statement import: exclude-from-budget checkbox

One checkbox on the import review step in `statements-panel.tsx` (near the section
mappings, not per-section — confirmed: a statement import is always credit-card-only, so a
single batch-level toggle covers it), checked by default.

- New state in the panel, sent through `confirmStatementImport` (`statement-actions.ts`) as
  a boolean on the existing `payload` object (top-level, not per-section).
- `import_card_statement` (`20260722120000_statement_import.sql`, insert around line
  422–430) reads `coalesce((p->>'exclude_from_budget')::boolean, true)` once and sets it
  explicitly on every inserted expense row (today the insert list omits the column, so it
  falls back to the table default of `false` — that default stays for manually-entered
  transactions, only the import path now passes an explicit value).
- Unchecking it imports the batch with `exclude_from_budget = false` (today's behavior).
- Statement *payment* lines stay exactly as they are today — parsed into
  `card_statement_lines` for balance tracking, never turned into `transactions`. Confirmed
  out of scope: users keep logging the actual card payment manually.
- Copy (new keys under `Statements` in `messages/en.json` / `es.json`):
  - `excludeFromBudgetLabel`: "Exclude these expenses from budget" /
    "Excluir estos gastos del presupuesto"
  - `excludeFromBudgetHint`: "They'll still count toward the card balance and net worth —
    add the payment separately to track it against your budget." /
    "Seguirán contando para el saldo de la tarjeta y el patrimonio neto — agrega el pago por
    separado para reflejarlo en tu presupuesto."

## 3. Credit card payments: allow a category

`transaction-form.tsx` currently force-hides category and sets it to `"none"` for card
payments (`cardPayment = type === "payment" && dst?.type === "credit_card"`, lines 205,
213–216, comment citing "spec §3.7 — double-deduct"). That reasoning no longer applies once
card expenses default out of the budget and the payment is what counts.

- Remove the `useEffect` that force-clears `category_id` when `cardPayment` is true.
- Remove the `!cardPayment` guard on the category field's visibility condition (currently
  `type !== "income" && !cardPayment`, ~line 452) so it becomes `type !== "income"` —
  matching how loan payments already show an optional category.
- No schema or DB change: `category_id` is already nullable/optional on `payment` rows.

## 4. Budget calculation (`category_usage`)

Remove the hardcoded exclusion of card-destined payments from the `used` subquery (the
`and not (t.type = 'payment' and exists (select 1 from accounts ca where ca.id =
t.to_account_id and ca.type = 'credit_card'))` clause added in
`20260724100000_exclude_from_budget.sql`). Payments to a credit card now count toward
budget by category like any other categorized payment (loan payments already work this
way and are unaffected). `exclude_from_budget` continues to gate this per-row as normal.

## 5. Cashflow: real money out

`monthly_cashflow` (`20260717234230_derived_views.sql`) is redefined around "did cash
actually leave an account you track":

- **Expense leg**: `type = 'expense'` transactions whose own account is *not* `credit_card`
  or `loan` — ordinary spending from a cash-like account. Card (and loan-charged, if that
  ever happens) expenses are excluded — the money hasn't left yet.
- **Payment leg** (new — `monthly_cashflow` ignores all payments today): `type = 'payment'`
  transactions whose *destination* account is `credit_card` or `loan` — a debt payoff, i.e.
  the real outflow. Payments between two non-liability accounts (checking → savings, etc.)
  are transfers and stay excluded, matching your confirmation that only transfers between
  your own accounts don't count.
- Requires joining both legs' account types, which the view doesn't do today:
  `join accounts a on a.id = t.account_id` (source, for the expense leg) and
  `left join accounts da on da.id = t.to_account_id` (destination, for the payment leg).
- The outflow amount for the payment leg is `base_total_amount` (the full source-side cost,
  including any tax/fee), mirroring how `account_balances` already treats a payment's
  source leg.
- Known simplification, not addressed here: a payment whose *source* is itself a liability
  (e.g. a cash-out from a loan into checking, or a card-to-card balance transfer) is
  classified only by its destination. A card-to-card transfer would still count as outflow;
  a cash-out wouldn't count as inflow either. Not something you described needing, flagging
  it as a known edge case rather than building for it.
- `budget_only` is not part of this rewrite's logic at all — see §6, which removes it
  everywhere including here.

## 6. Remove `budget_only` (full teardown)

Grep shows `budget_only` is load-bearing well beyond budget/cashflow — it also gates
account balance, loan payoff, and card-balance-from-statement calculations. All of the
following stop checking it (equivalent to treating every transaction as if it were always
`false`, i.e. today's default and now the only behavior), and the column is dropped.

**Two migrations**, in order (functions must stop referencing the column before it's
dropped):

**Migration A** — `category_usage`, `monthly_cashflow`, `import_card_statement` changes from
§4/§5/§2 (the `monthly_cashflow` rewrite already drops its `budget_only` reference as part
of the redesign, so no separate edit needed there).

**Migration B** — the rest of the teardown:
- `account_balances` (`20260720093500_payment_destination_amount.sql`, the two
  `when t.budget_only then 0` branches in the `movements` CTE) — redefine without them.
- `loan_status` (latest definition: `20260727120000_loan_outstanding_amortized.sql`) — drop
  `and not t.budget_only` from the `pay` CTE (line 48) and the `paid_count` lateral (line 97).
- `recompute_card_balance` (`20260722120000_statement_import.sql`, line 177) — drop
  `and not t.budget_only`.
- `alter table public.transactions drop column budget_only;`

**Application code** (no functional change beyond "the flag no longer exists" — every one of
these is either a dead field or a filter that's now always-true and gets deleted):

- `lib/transactions/schema.ts` — remove the `budget_only` field.
- `components/transactions/transaction-form.tsx` — remove `budget_only` from `FormValues`,
  its default-value wiring, and the toggle's `Controller`/`ToggleRow`.
- `components/transactions/transaction-row.tsx` — remove the "budget only" badge block.
- `components/accounts/balance-chart.tsx` — remove `if (txn.budget_only) return 0;`.
- `app/(app)/transactions/actions.ts` — remove `budget_only` from `toRow()`.
- `app/(app)/subscriptions/actions.ts` — remove the hardcoded `budget_only: false`.
- `lib/insights/net-worth-history.ts` — remove `budget_only` from `TxRow`, the
  `if (tx.budget_only) return 0;` check in `accountMovement`, the column from the
  `transactions` select, and the `.eq("budget_only", false)` filters on the card/loan
  payment loaders.
- `lib/insights/net-worth-history.test.ts` — drop `budget_only` from the fixture and the
  test case asserting it zeroes out movement.
- `lib/insights/queries.ts` — remove `.eq("budget_only", false)` from the pace-chart raw
  query (`exclude_from_budget` filter stays).
- `lib/overview/queries.ts` — remove `.eq("budget_only", false)` from
  `statementPaymentsByCard`.
- `lib/supabase/types.ts` — hand-remove `budget_only` from the `transactions`
  Row/Insert/Update types (no linked Supabase project in this environment to regenerate
  from — same situation noted in the prior exclude-from-budget spec).
- `messages/en.json` / `messages/es.json` — remove `budgetOnlyLabel` and `budgetOnlyBadge`.

## 7. Testing

No SQL test harness in this repo (migrations applied via `db:push`, no pgTAP found).
Verification: `tsc --noEmit`, `npm run lint`, `npm test` (covers
`net-worth-history.test.ts`), and a manual walkthrough:

- New expense on a credit card account → "Exclude from budget" defaults checked; uncheck
  and confirm it counts in the Budgets page `used` figure.
- Import a statement with the new checkbox checked (default) → imported expenses don't
  move the budget `used` figure; uncheck it before confirming → they do.
- Create a payment to a credit card → category field is visible and optional; pick one and
  confirm it shows up in that category's budget `used` figure and in the Insights donut.
- Card expense this month, no payment yet → dashboard cashflow "expense" excludes it. Pay
  the card → cashflow "expense" includes the payment amount.
- Transfer checking → savings → cashflow unaffected (matches today).
- Confirm account balances, loan outstanding balance, and card current balance are
  unchanged after the `budget_only` teardown (nothing in this repo currently sets
  `budget_only: true` outside tests, so there's no real data whose behavior should visibly
  change from the removal itself).

## 8. Out of scope

- Auto-creating a `payment` transaction from a statement's payment lines (confirmed with
  you — payment lines stay informational only; you'll keep logging card payments manually).
- Generalizing cashflow's "real money out" to every payment type beyond credit
  cards/loans — already covered, since destination account type is the only signal used,
  not a hardcoded type list.
- `exclude_from_budget` on `type = 'payment'` rows — stays expense-only, unchanged from the
  original exclude-from-budget design.
- Per-section exclude-from-budget checkbox on statement import — confirmed single
  batch-level checkbox is enough.
