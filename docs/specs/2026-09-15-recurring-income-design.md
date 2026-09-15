# Recurring income ("paycheck") — design

Two users have asked for a way to log a recurring paycheck instead of typing it
into quick-add every payday. This extends the existing recurring-payments
system (`subscriptions` table, `/recurring` page) with a third kind, `income`,
rather than building a parallel feature.

## Context

- `subscriptions` already stores recurring expense/payment templates with a
  `kind` column (added in `20260914150000_recurring_payments.sql`), a
  one-tap "Record" action that posts a transaction from the template, and a
  `billing_cycle` of `weekly` / `biweekly` / `monthly` / `yearly` / `custom`.
  That migration added a check constraint explicitly blocking
  `kind = 'income'`, reasoning "pay cycles already cover it."
- `profiles.pay_cycle` / `pay_anchor_day` (added in `20260908120000_pay_cycle.sql`)
  is a separate, single-value setting that only decides budget period
  boundaries (safe-to-spend resets). It does not record any transaction, so
  it does not actually give a user a way to log a paycheck — the prior
  exclusion undersold the ask.
- "Quincena" already means something specific in this codebase: `semimonthly`
  in `pay_cycle` terms is "the 15th and the end of the month" — a different
  shape than `subscriptions.billing_cycle`'s `biweekly` (every 14 days from a
  chosen start date, e.g. "every other Friday"). Recurring income must use
  the semimonthly shape to match how paychecks actually land, not biweekly.
- Manual income transactions (`lib/transactions/schema.ts`) already reject a
  category and a budget group, and always resolve to `NO_FEES`
  (`lib/transactions/defaults.ts`). Recurring income templates follow the
  same rules.

## Decisions

1. Recurring income lives in the same `subscriptions` table and `/recurring`
   page as a third `kind`, reusing the existing template/Record pattern.
2. "Quincena" maps to a new `semimonthly` billing cycle (15th & end of month),
   not the existing `biweekly` cycle.
3. Saving an *active* income template also updates
   `profiles.pay_cycle`/`pay_anchor_day`, but **only when it is the user's
   sole active income template**. If a second active income template exists,
   the sync is skipped and `pay_cycle` is left as whatever it already was
   (managed manually in Settings from that point on). Deleting or
   deactivating an income template never reverts a previous sync.
4. Income templates carry no category/source field — just name, amount,
   currency, destination account, and cycle/anchor — matching manual income
   transactions today.

## Schema changes

- Drop the `subscriptions_kind_not_income` check constraint. No enum change
  needed for `kind` itself — its underlying type, `public.transaction_type`,
  already includes `'income'`.
- Add `'semimonthly'` to the `public.billing_cycle` enum.
- No new columns. For an income row, the existing `account_id` column is
  repurposed as the **destination** account (where the paycheck lands),
  matching how `account_id` already means "source" for expense/payment.
  `to_account_id`, `category_id`, `include_tax`, and `include_commission`
  are always null/false for income — enforced in the app layer (zod schema),
  the same way expense/payment field combinations are today (no DB-level
  CHECK for these; see the existing migration's comment on why
  `to_account_id`'s validity is checked in the app).

## Cycle logic (`lib/subscriptions/cycle.ts`)

- `nextChargeDate`: add a `semimonthly` branch. No anchor is used — like
  `pay_cycle`'s constraint, semimonthly is anchor-free. Compute the next
  occurrence as "the 15th if today is before the 15th, else the 1st of next
  month" — the same rule `lib/period/cycle.ts`'s `periodFor`/`nextPayday`
  already implement for `pay_cycle`. Prefer delegating to those functions
  (via a thin adapter) over re-deriving the same date math a second time.
- `monthlyEquivalent`: `semimonthly` → `amount * 2`.
- `anchor_day` and `anchor_date` are both forced null for `semimonthly`, the
  same way `biweekly` already forces `anchor_day` null. `usesAnchorDate`
  itself is unchanged (still true only for `biweekly`); a sibling check
  handles the semimonthly anchor-free case.
- `CYCLE_LABEL` gains a `"Semimonthly"` entry, consistent with the existing
  (non-localized) English labels for the other cycles.

## Template/actions

`lib/subscriptions/template.ts`:
- `RECURRING_KINDS` becomes `["expense", "payment", "income"]`.
- `templateAllowsFees`: returns `false` unconditionally when `kind ===
  "income"`, regardless of account type — income never carries fees.
- `recordedFlags`: `exclude_from_budget` logic is unchanged (only relevant to
  `kind === "expense"` from a credit card; irrelevant to income since budget
  queries only ever sum `expense`/`payment` types).

`app/(app)/recurring/actions.ts`:
- `toRow`: for `kind === "income"`, force `to_account_id: null` and
  `category_id: null` regardless of form input.
- `addCharge`: new branch for `kind === "income"` inserts a transaction with
  `type: "income"`, `account_id: sub.account_id` (the destination),
  `to_account_id: null`, `category_id: null`. Reuses `settledCharge` for the
  same currency-mismatch case expenses already handle (template billed in one
  currency, destination account holds another) and `resolveBaseRate` the same
  way the non-payment path already does.
- New: `syncPayCycleFromIncome(userId)` (or inline in create/update), run
  after a successful create/update of an active income template. Queries
  whether more than one active `kind = 'income'` row exists for the user; if
  exactly one, maps its `billing_cycle`/anchor onto
  `pay_cycle`/`pay_anchor_day` and writes `profiles`. Cycle mapping:
  - `weekly` → `pay_cycle = 'weekly'`, remapping `anchor_day` from this
    table's Sun=1..Sat=7 scheme to `pay_cycle`'s ISO Mon=1..Sun=7 scheme.
  - `monthly` → `pay_cycle = 'monthly'`, `anchor_day` carried over as-is
    (both schemes are plain day-of-month, 1-31, clamped into the month).
  - `semimonthly` → `pay_cycle = 'semimonthly'`, anchor null.
  - `biweekly`/`yearly`/`custom` income templates do not sync (no matching
    `pay_cycle` value) — sync is skipped for those cycles.
  - If more than one active income template exists, skip entirely.
  - Revalidate whatever paths already depend on `pay_cycle` (Overview,
    Budgets) in addition to the existing `/recurring` revalidation.

## UI (`components/subscriptions/*`)

- Kind toggle becomes a 3-way segmented control (`grid-cols-3`), adding
  `"income"` to the existing `TransactionTypes`-keyed labels (`income`
  already exists in that i18n namespace).
- Category and "to account" fields are hidden when `kind === "income"`
  (same conditional pattern already used to hide "to account" for
  non-payment kinds).
- The account field's label switches to something like "Deposited to" for
  income, vs. "Paid from" for expense/payment.
- Fee toggles (`include_tax`/`include_commission`) are hidden for income,
  same as they already are for non-bank accounts.
- `/recurring` page copy broadens to cover all three kinds: page title
  "Recurring payments" → "Recurring", description → "Expenses, payments, and
  income you repeat, their next dates, and your monthly total."
- The record-charge dialog gets one new copy key for the income case —
  `incomeLine: "Expected {amount}, deposited to {account} in {currency}."` —
  parallel to the existing `billedLine`/`paymentLine`. The existing
  `receivedLabel: "Amount {account} received"` is generic enough to reuse
  as-is for income's settled-amount prompt (currency-mismatch case); no new
  key needed there.

## Testing

- Unit tests for the new `semimonthly` branch in `nextChargeDate` and
  `monthlyEquivalent`.
- Unit tests for the pay-cycle sync: single active income template syncs
  correctly per cycle (including the weekly anchor remapping); a second
  active income template blocks the sync; deactivating/deleting an income
  template does not revert a prior sync.
- Extend existing subscription action/schema tests to cover the `income`
  kind (field nulling in `toRow`, `addCharge` inserting the right
  transaction shape, zod rejection of `to_account_id`/`category_id` on
  income).

## Out of scope

- No source/category field on income templates.
- No restriction on which account types can receive income (parity with
  today's unrestricted manual income entry).
- No retroactive backfill of `pay_cycle` for existing users' current
  subscriptions/transactions history.
