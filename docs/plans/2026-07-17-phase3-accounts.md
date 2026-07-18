# Phase 3 — Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. (This plan is being executed inline in the authoring session; core tasks 1–5 first, detail tasks 6–8 follow.)

**Goal:** Let a user create, edit, archive, and delete every account type (bank/cash/investment/asset, credit card, loan) with fee settings and card grouping, and see them in a gallery showing derived balances, card utilization/statement/due-date, and loan payoff — plus an account detail page with a card reconcile panel and loan amortization schedule.

**Architecture:** Server Components read accounts joined with the Phase 2 derived views (`account_balances`, `card_status`, `loan_status`) via `@/lib/supabase/server`. All mutations are Server Actions with zod validation against the RLS-enforcing client. Forms are client leaves using react-hook-form + zod. UI reuses the Vault design system and the Base UI (base-nova) shadcn primitives.

**Tech Stack:** Next.js App Router, react-hook-form + zod + @hookform/resolvers, Base UI shadcn primitives (select, switch, badge, separator, progress, tabs), lucide icons, sonner toasts.

## Global Constraints

- **Money:** `numeric` in DB, rendered with `Intl.NumberFormat` + tabular figures via the `.figure`/`tabular-nums` treatment. Never floats in logic that persists.
- **Currency immutable after creation** (DB trigger enforces): the edit form shows currency read-only.
- **All mutations are Server Actions** using the RLS client; never the service role; zod-validate every input; `revalidatePath` the affected routes.
- **Derived figures come from the DB views**, never re-derived in the UI.
- **Semantic tokens + light/dark** only; status colors: green `within`, amber `approaching`, red `over` / high utilization.
- **Spec:** `docs/specs/2026-07-16-financial-tracker-design.md` §3, §4 (accounts, card_groups, views), §5.2 (Accounts + detail screens).

---

## File Structure

- `lib/format.ts` — `formatMoney`, `formatPercent`, `formatDueDate` helpers.
- `lib/accounts/meta.ts` — account-type metadata (label, icon, group, `isCard`/`isLoan`) and the display groups.
- `lib/accounts/schema.ts` — zod `accountInput` schema + `AccountInput` type; `cardStatementInput`.
- `lib/accounts/queries.ts` — `getAccountsWithStatus()`, `getAccountById(id)`, `getCardGroups()`, `getCurrencies()`.
- `app/(app)/accounts/actions.ts` — `createAccount`, `updateAccount`, `archiveAccount`, `deleteAccount`, `createCardGroup`, `addCardStatement`, `setCardBalance`.
- `app/(app)/accounts/page.tsx` — gallery (Server Component).
- `app/(app)/accounts/[id]/page.tsx` — account detail (Server Component).
- `components/accounts/account-card.tsx` — one account tile (bank/card/loan variants).
- `components/accounts/account-gallery.tsx` — grouped grid + "Add account" entry (client wrapper hosting the dialog).
- `components/accounts/account-form-dialog.tsx` — add/edit dialog (react-hook-form).
- `components/accounts/reconcile-panel.tsx` — card statement + current-balance form.
- `components/accounts/amortization-table.tsx` — loan schedule (pure, from principal/rate/term).
- `lib/accounts/amortization.ts` — `buildSchedule()` pure function + unit test `amortization.test.ts`.

---

### Task 1: Formatting + account metadata + queries

**Files:** Create `lib/format.ts`, `lib/accounts/meta.ts`, `lib/accounts/queries.ts`.

**Interfaces:**
- Produces: `formatMoney(amount, currency, {compact?})`, `formatPercent(n)`, `formatDueDay(day)`.
- `ACCOUNT_TYPES`, `ACCOUNT_GROUPS`, `accountTypeMeta(type)`.
- `getAccountsWithStatus(): Promise<AccountWithStatus[]>` merging `accounts` with the three status views by `account_id`; `getCurrencies()`, `getCardGroups()`, `getAccountById(id)`.

- [ ] Write `lib/format.ts`, `lib/accounts/meta.ts`, `lib/accounts/queries.ts` (code below in the implementation).
- [ ] Verify `npx tsc --noEmit` passes.
- [ ] Commit.

---

### Task 2: Account zod schema + CRUD server actions

**Files:** Create `lib/accounts/schema.ts`, `app/(app)/accounts/actions.ts`.

**Interfaces:**
- `accountInput` zod schema → `AccountInput`. Refinements: card fields required only when `type==='credit_card'`; loan fields required only when `type==='loan'`.
- Server actions returning `{ error?: string; id?: string }`: `createAccount(input)`, `updateAccount(id, input)`, `archiveAccount(id, archived)`, `deleteAccount(id)`, `createCardGroup(input)`. Each: auth guard, zod parse, RLS insert/update with `user_id = auth user`, `revalidatePath("/accounts")` (+ `/`).

- [ ] Write schema + actions.
- [ ] Verify typecheck.
- [ ] Commit.

---

### Task 3: Add/Edit account dialog (react-hook-form)

**Files:** Create `components/accounts/account-form-dialog.tsx`.

**Interfaces:** `<AccountFormDialog mode="create"|"edit" account? currencies cardGroups trigger>` — controlled dialog; type Select drives conditional field groups (card block, loan block, fee block). On submit calls the matching action inside `useTransition`; toasts errors; closes + refreshes on success. Currency Select disabled in edit mode.

- [ ] Write the dialog.
- [ ] Verify typecheck.
- [ ] Commit.

---

### Task 4: Account card + gallery

**Files:** Create `components/accounts/account-card.tsx`, `components/accounts/account-gallery.tsx`; modify `app/(app)/accounts/page.tsx`.

**Interfaces:** `<AccountCard account>` renders bank/card/loan variants (card: utilization `Progress` + owed + statement/due; loan: installments-paid + outstanding). `<AccountGallery accounts currencies cardGroups>` groups by `ACCOUNT_GROUPS`, renders cards, hosts the create dialog and the empty state. Page is a Server Component calling the queries.

- [ ] Write card + gallery; wire the page.
- [ ] Verify typecheck.
- [ ] Commit.

---

### Task 5: Card grouping (assign accounts to a card_group)

**Files:** Modify the form dialog (card_group Select + "new group") and gallery (render two currency lines of one physical card as a single grouped tile).

- [ ] Add group assignment to the form; merge grouped cards in the gallery.
- [ ] Verify typecheck. Commit.

---

### Task 6: Account detail page shell + fee settings

**Files:** Create `app/(app)/accounts/[id]/page.tsx`; link cards to it.

Header with name + derived balance; a "Settings" section (currency locked, fee config via edit dialog); a transactions-history placeholder (Phase 4) and a balance-over-time placeholder (Phase 7 chart). Edit/Archive/Delete actions.

- [ ] Build the detail shell. Verify. Commit.

---

### Task 7: Credit-card reconcile / statement panel

**Files:** Create `components/accounts/reconcile-panel.tsx`; `addCardStatement`, `setCardBalance` actions (Task 2 file).

Form to record a statement (period, statement/total balances, debits/credits, due date) → inserts `card_statements`; and a "set current balance" control updating `accounts.current_balance`. Shows latest statement from `card_status`.

- [ ] Build panel + actions. Verify. Commit.

---

### Task 8: Loan amortization

**Files:** Create `lib/accounts/amortization.ts` (+ `amortization.test.ts`), `components/accounts/amortization-table.tsx`.

`buildSchedule({principal, annualRate, termMonths, installment?})` → array of `{n, payment, interest, principal, balance}` using standard monthly amortization; if `installment` given, use it, else compute. Rendered on loan detail with installments-paid marker from `loan_status`.

- [ ] TDD the schedule (test first), then table. Verify. Commit.

---

## Self-Review

**Spec coverage (§5.2):** account CRUD all types (T2–T4), fee settings (T2/T6), card groups (T5), gallery with utilization/statement/due + loan payoff (T4), account detail (T6), reconcile/statement (T7), amortization (T8). Transaction history + balance-over-time chart are shown as explicit placeholders (owned by Phase 4 / Phase 7). ✅

**Deferred (not gaps):** inline "Add Expense/Income/Payment" per card routes to Quick-Add, whose real forms land in Phase 4; balance-over-time chart is Phase 7.
