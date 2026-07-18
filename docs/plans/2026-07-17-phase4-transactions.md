# Phase 4 — Transactions & Quick-Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development. Steps use `- [ ]`. (Executed inline in the authoring session.)

**Goal:** Let a user log expense/income/payment transactions from a global Quick-Add (and inline), with per-transaction currency + provided exchange rate, DR tax/commission toggles and smart defaults, and a budget-only flag; and browse them in a filterable unified ledger — all persisting through the Phase 2 computed-money trigger so balances update automatically.

**Architecture:** Server Actions insert the raw transaction; the DB trigger derives `tax_amount`/`fee_amount`/`total_amount`/`base_amount`/`base_total_amount` and syncs card balances, so the client never computes money. Reads are Server Components joining `transactions` to account/category names. The Quick-Add form is a client leaf fed data (accounts, categories, currencies, base currency) fetched in the app shell.

**Tech Stack:** react-hook-form + zod, Base UI shadcn primitives, existing Quick-Add provider/dialog.

## Global Constraints

- **The DB computes money.** Actions send only `type`, `account_id`, `to_account_id?`, `category_id?`, `amount`, `currency`, `exchange_rate`, `include_tax`, `include_commission`, `budget_only`, `occurred_at`, `description?`, `notes?`, `subscription_id?`. Never send tax/fee/total/base.
- **Type invariants** (DB CHECKs, mirror in the form/zod): expense → one account + category required; income → one account, no category; payment → source + `to_account_id`, category optional, no self-transfer.
- **Currency/rate:** transaction currency defaults to the source account's currency; `exchange_rate` to base is `1` when they match (locked), else user-provided.
- **Smart defaults** (spec §3.4): own→own payment → `include_tax` off; payment to a `loan` account → `include_tax` on; `include_commission` defaults to `!account.network_fee_optional` (obligatory fee → on).
- **`budget_only`** available for expenses (a card purchase that feeds budgets but not balances).
- All mutations via Server Actions on the RLS client; `revalidatePath` `/transactions`, `/accounts`, `/`.
- **Spec:** design §3, §5.3.

---

## File Structure

- `lib/transactions/schema.ts` — `transactionInput` zod + `TransactionInput`.
- `lib/transactions/queries.ts` — `getTransactions(filters)`, `getQuickAddData()` (accounts, categories, currencies, baseCurrency).
- `app/(app)/transactions/actions.ts` — `createTransaction`, `updateTransaction`, `deleteTransaction`.
- `components/transactions/transaction-form.tsx` — the shared form (type toggle, conditional fields, smart defaults).
- `components/transactions/transaction-row.tsx` — one ledger row.
- `components/transactions/ledger.tsx` — client filter controls + list.
- `components/quick-add/quick-add-dialog.tsx` — replace placeholder with the form (modify).
- `components/shell/app-shell.tsx` — fetch Quick-Add data, pass to dialog (modify).
- `app/(app)/transactions/page.tsx` — ledger page (modify).

---

### Task 1: Transaction schema + actions

`transactionInput` zod (type enum, uuids, amount ≥ 0, currency len 3, exchange_rate > 0, booleans, occurred_at, optional text) with superRefine mirroring the type invariants. Actions map to the insert (raw fields only) and revalidate.

- [ ] Write schema + actions. Typecheck. Commit.

### Task 2: Quick-Add data + queries

`getQuickAddData()` returns `{ accounts, categories, currencies, baseCurrency }` (accounts include `currency`, `type`, `network_fee_optional`). `getTransactions(filters)` embeds account/category names via the FK constraint hints.

- [ ] Write queries. Typecheck. Commit.

### Task 3: Transaction form

Client form: segmented type toggle; source account Select; destination Select (payment); category Select (expense/payment); amount + currency; exchange rate (locked to 1 when currency == base); tax/commission switches (smart defaults recomputed on account/type/destination change); budget-only switch (expense); date; description. Submit → `createTransaction`, toast, `router.refresh()`.

- [ ] Write form. Typecheck. Commit.

### Task 4: Wire Quick-Add

Fetch `getQuickAddData()` in `app-shell`; pass to `QuickAddDialog`; render `<TransactionForm>` inside; close + refresh on success. Empty-accounts state prompts adding an account first.

- [ ] Wire it. Typecheck + build. Commit.

### Task 5: Unified ledger

`/transactions` server page reads `getTransactions` + data; `Ledger` client component filters by type/account/category/search (date range optional) and renders grouped-by-day rows with signed amounts, tax/fee hints, and delete. Empty state.

- [ ] Build ledger. Typecheck + build. Commit.

---

## Self-Review

**Spec coverage (§5.3, §3.1, §3.3, §3.4):** three transaction types with invariants (T1/T3), currency + provided rate (T3), tax/commission toggles + smart defaults (T3), budget-only (T3), Quick-Add global entry (T4), unified filterable ledger (T5). Money always computed in the DB (T1 actions). ✅

**Deferred:** subscription-linked charges (Phase 6 wires `subscription_id`); statement import (later spec). Category management UI is Phase 5.
