# Phase 5 — Budgets Implementation Plan

**Goal:** Manage categories and set a per-month budget per category, then see budget / used / left with within/approaching/over status and a month switcher — all fed by the Phase 2 `category_usage(month)` function.

**Architecture:** Server Component reads `category_usage` (RPC) merged with category display fields for a given month (from `?month=` search param, default current month). Inline budget edits, category CRUD, and "copy last month" are Server Actions on the RLS client. Money is in the base currency (used = Σ base_total of categorized expense/payment in the month).

## Global Constraints
- Budget snapshots live in `category_budgets (category_id, month, amount)`, unique per `(category_id, month)`; `month` is first-of-month. Upsert on that conflict.
- Reads via `category_usage(p_month)`; never re-derive usage in the client.
- All mutations are Server Actions; `revalidatePath("/budgets")` (+ `/`).
- Spec: design §4 (categories/category_budgets), §5.4.

## Files
- `lib/budgets/month.ts` — month string helpers.
- `lib/budgets/queries.ts` — `getBudgetOverview(month)`.
- `app/(app)/budgets/actions.ts` — `setBudget`, `createCategory`, `deleteCategory`, `copyPreviousMonth`.
- `components/budgets/category-dialog.tsx` — add-category dialog.
- `components/budgets/budget-grid.tsx` — month switcher, totals, inline-editable rows, status bars.
- `app/(app)/budgets/page.tsx` — server page.

## Tasks
- [ ] Month helpers + queries. Typecheck. Commit.
- [ ] Actions. Typecheck. Commit.
- [ ] Grid + category dialog + page. Typecheck + build. Commit.

## Self-Review
Covers §5.4: per-month budgets, budget/used/left/status, month switcher, category management (add/delete). Category rename deferred to Settings (Phase 8). ✅
