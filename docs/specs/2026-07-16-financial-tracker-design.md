# Financial Tracker — Design Spec

- **Date:** 2026-07-16
- **Status:** Approved design, ready for implementation planning
- **Codename:** tywin

## 1. Overview

A beautiful, elegant, mobile-first personal finance tracker that replaces a
mature Notion setup. It tracks bank accounts, investment/asset accounts, credit
cards, and loans; records expenses, incomes, and transfers (payments) between
accounts; manages per-category monthly budgets and subscriptions; and surfaces
insightful, theme-aware graphs that give a full picture of the month's money.

The product goal is **precision without tedium**: accurate cash-flow accounting
where it matters (bank/cash/loan accounts) and low-effort **reconciliation** for
credit cards, so the user never has to log every card swipe.

### Goals
- Model accounts, expenses, incomes, payments, subscriptions, categories, and
  loans faithfully to how the user actually moves money in the Dominican Republic.
- Handle credit cards without per-transaction logging and without double-counting.
- Support multi-currency with a profile base currency for unified dashboards.
- Handle DR transaction tax (0.20%) and network commissions as separate,
  configurable, per-transaction toggles.
- Be **mobile-first** and support **light/dark themes** (default: system).
- Make everyday logging feel effortless via a global Quick-Add.

### Non-goals (v1)
- Automatic bank/card sync via aggregators (Plaid/Belvo).
- Statement import (CSV/PDF) — schema is reserved for it, but the import feature
  is a **separate later spec**. The app is fully usable with manual entry.
- Shared/household accounts — the schema is designed to allow it later, but v1 is
  strict **per-user data isolation**.
- Investment performance tracking, tax reporting, or forecasting/AI features.

## 2. Users & Auth

- **Supabase Auth.** Each authenticated user sees **only their own data** — this
  is data isolation, not a permissions/sharing system.
- Every domain table carries `user_id`; **Row Level Security** restricts every
  row to its owner on select/insert/update/delete.
- Household sharing is out of scope for v1 but the single-owner model does not
  preclude adding an ownership/membership layer later.

## 3. Core money model

### 3.1 Transaction types

One `transactions` table with three types:

| Type | Accounts touched | Category | Counts toward budget |
|------|------------------|----------|----------------------|
| `expense` | one (source) | required | yes |
| `income`  | one (destination) | none | no |
| `payment` | two (`from` → `to`) | optional | yes, if categorized |

Flows this produces:
- **Buy groceries with cash/debit** → `expense` on that bank/cash account →
  balance down, counts toward the Groceries budget.
- **Pay a credit card from checking** → `payment` (bank → card) → bank down, card
  owed down. Not a budget expense.
- **Mortgage** → `payment` `Main → Mortgage-savings` (own→own), then `payment`
  `Mortgage-savings → Loan` carrying the "Mortgage" category (tax applies,
  reduces loan balance, counts toward the Mortgage budget). Paying the lender
  directly is the same minus the middle hop.

### 3.2 Balances: derived vs reconciled

- **Bank / cash / investment / asset / loan accounts** → balance is **fully
  derived** from transactions (starting balance ± transaction effects). Never
  stored, so it can't drift.
- **Credit cards** → balance is **reconciliation-based**, not transaction-derived:
  - The card holds a maintained `current_balance` (total owed) and, per cycle, a
    lightweight **statement record**: `statement_balance`, `total_balance`,
    `total_debits`, `total_credits`, `due_date`, `period_start`, `period_end`.
  - The user enters these manually (occasionally) today; statement import will
    auto-fill the same fields later. **No model change** between the two.
  - **Payments to the card** (`bank → card`) are real transactions and reduce the
    card's `current_balance`.
  - **Card charges are never logged as transactions**, so there is **no double
    counting** with the payment.
  - **Optional:** a specific card purchase can be logged as a `budget-only`
    expense — it feeds budgets/analytics but does **not** affect the card's
    reconciled balance. The two systems never collide.

### 3.3 Multi-currency

- **Profile base currency** (default `USD`) — all dashboards, net worth, and
  aggregate graphs convert into it.
- **Each account has its own `currency`, chosen at creation and immutable.**
- **Each transaction stores** its `currency`, `amount`, a user-**provided
  `exchange_rate`** to the base currency (immutable once saved), and a computed
  `base_amount`. If the transaction currency equals the base currency, rate = 1.
- A physical credit card with two currency lines (e.g. DOP + USD) is modeled as
  **two credit-card accounts** joined by a shared `card_group`, rendered as one
  card with two lines.

### 3.4 Tax & commissions (DR-specific)

- **Two independent per-transaction toggles**: `include_tax` and
  `include_commission`.
- **Per-account settings** provide the defaults and values:
  - `transfer_tax_rate` (default `0.0020` = 0.20%).
  - `network_fee_amount` in the account's currency (e.g. 100 DOP, 5 USD).
  - `network_fee_optional` (DOP network fee is optional — a slower free option
    exists; USD network fee is obligatory).
- **Smart defaults when composing a transaction:**
  - Own → own transfer: `include_tax` defaults **off** (tax waived between the
    user's own accounts); `include_commission` defaults to the account's fee
    obligation (USD obligatory → on; DOP optional → off).
  - Payment to an external party / real lender: `include_tax` defaults **on**.
  - All defaults are overridable.
- **Effect:** `total = amount + tax_amount + fee_amount` leaves the source
  account. `tax_amount` and `fee_amount` are stored separately. When a
  transaction is categorized, the **total** (including tax + fee) counts toward
  the budget — matching the user's "payment + taxes + commissions" budgeting.

## 4. Data model

All money columns are `numeric(18,4)`; exchange rates `numeric(18,8)`. All tables
carry `user_id uuid` + RLS. `created_at` / `updated_at` on every table.

### `profiles` (1:1 with `auth.users`)
- `id` (FK auth user), `display_name`, `base_currency` (default `USD`).

### `accounts`
Common: `id`, `user_id`, `name`, `type`
(`checking | savings | cash | investment | asset | credit_card | loan`),
`currency` *(immutable)*, `starting_balance`, `icon`, `color`, `logo_url`,
`is_archived`, `sort_order`.
- Fee settings (all account types): `transfer_tax_rate` (default 0.0020),
  `network_fee_amount`, `network_fee_optional`.
- **Credit card** fields: `credit_limit`, `statement_closing_day` (1–31),
  `payment_due_day` (1–31), `card_group_id` (nullable), `current_balance`
  (reconciled). Derived: utilization, estimated next due date.
- **Loan** fields: `principal`, `interest_rate`, `term_months`, `start_date`,
  `installment_amount`, `payment_due_day`. Derived: `outstanding_balance`,
  `installments_paid`. Loans carry their own `currency` like any account.

### `card_groups`
- `id`, `user_id`, `name`, `brand`, `last4`, `art_color`/`art_url`. Groups
  multiple credit-card accounts that are the same physical card.

### `categories`
- `id`, `user_id`, `name`, `emoji`/`icon`, `color`, `sort_order`.
- Monthly budgets are **snapshotted per month** in `category_budgets`
  (`category_id`, `month` (first-of-month `date`), `amount`) so budget history is
  preserved. A category's most recent budget is the default when creating the next
  month's snapshot.
- Derived per month: `used` = Σ categorized `expense` + categorized `payment`
  totals (incl. tax/fee) in the month; `left` = budget − used; `status` =
  `within | approaching | over` (approaching threshold configurable, default 90%).

### `transactions`
- `id`, `user_id`, `type` (`expense | income | payment`).
- `account_id` (source for expense/payment, destination for income).
- `to_account_id` (payments only).
- `category_id` (required for expense; optional for payment; null for income).
- `amount`, `currency`, `exchange_rate`, `base_amount`.
- `include_tax`, `include_commission`, `tax_amount`, `fee_amount`,
  `total_amount`, `base_total_amount`.
- `budget_only` (boolean) — for optional card purchases that feed budgets but not
  the card's reconciled balance.
- `description`, `occurred_at` (date/time), `notes`.
- `subscription_id` (nullable) — links a charge back to its subscription.

### `subscriptions`
- `id`, `user_id`, `name`, `brand`/`logo_url`, `amount`, `currency`,
  `billing_cycle` (`weekly | monthly | yearly | custom`), `anchor_day`,
  `account_id` (default account/card to charge), `category_id` (default
  category), `is_active`. Derived: `next_charge_date`.
- **Add Charge** creates an `expense` transaction linked via `subscription_id`.

### `card_statements` *(schema reserved; import is a later spec)*
- `id`, `user_id`, `account_id`, `period_start`, `period_end`,
  `statement_balance`, `total_balance`, `total_debits`, `total_credits`,
  `due_date`, `source` (`manual | import`), `file_url` (nullable).
- Until import ships, users enter these manually; the card's displayed statement
  figures come from the latest statement record, and `current_balance` is the
  maintained reconciled figure.

### Derived views / functions (money math lives in Postgres)
- `account_balances` — derived balance per non-card account (base + own currency).
- `card_status` — owed, utilization %, latest statement balance, estimated next
  due date (from `statement_closing_day` / `payment_due_day`).
- `loan_status` — outstanding balance, installments paid, next payment date.
- `category_usage(month)` — budget, used, left, status per category.
- `net_worth` / `net_worth_history` — all accounts converted to base currency.
- `monthly_cashflow` — income vs expense vs net, per month.
- `spend_distribution(month)` — expense totals by category (base currency).

## 5. Screens & navigation

Persistent **left sidebar on desktop**, **bottom nav on mobile**. A **global
Quick-Add** (`⌘K` command bar + floating **+**) logs any transaction in seconds
from anywhere — the single most important usability feature.

1. **Overview (Dashboard)** — net worth, this month's spend donut, budget-progress
   summary, and an **Upcoming rail** (card due dates, subscription charges, loan
   payments) in date order.
2. **Accounts** — gallery of account cards (banks, investment, assets, cards,
   loans). Cards show utilization bar + statement balance + estimated due date;
   loans show installments paid/term + outstanding; currency-lines render as one
   grouped card. Inline **Add Expense / Income / Payment** per card.
   - **Account detail** — transaction history, balance-over-time chart, settings
     (currency shown but locked, fee config). Cards get a **reconcile / add
     statement** panel; loans get amortization detail.
3. **Transactions** — unified ledger for cash-flow accounts: filter by
   type/account/category/date, search, inline quick-add.
4. **Budgets** — category grid with budget / used / left, progress bar, and
   within/approaching/over status; month switcher; edit budgets in place.
5. **Subscriptions** — logo grid + Table toggle: amount, cycle, next charge date,
   **Add Charge**, and a total monthly subscription cost header.
6. **Insights** — deeper analytics (Section 6).
7. **Settings** — profile base currency, manage categories, default
   exchange-rate & fee settings, archive accounts, theme.

## 6. Insights & graphs

Built with **shadcn Charts** (Recharts), theme-token aware, converted to base
currency, scoped by a month switcher. Stacked full-width on mobile; responsive
grid on desktop. Each chart is fed by a SQL view/function.

- **Spend Distribution donut** — expenses by category this month, total in center,
  tappable to filter.
- **Expenses vs Budget** — horizontal bars (actual vs budgeted) sorted by
  overspend; header shows total spent / total budget / remaining.
- **Cash-flow trend** — income vs expense per month (bars) + net line, trailing
  6–12 months.
- **Spending pace** — cumulative spend this month vs last month (area).
- **Net worth over time** — all accounts (assets +, cards/loans −) in base
  currency, area chart.
- **Credit & debt health** — utilization across cards + loan payoff progress.
- **Subscriptions** — monthly recurring total and its share of income.

## 7. Tech architecture

- **Next.js (App Router, TypeScript)** — Server Components for reads; **Server
  Actions** for all mutations. Sensitive logic never runs client-side.
- **Supabase** — Postgres + Auth + RLS; `@supabase/ssr` cookie auth. All money
  math in Postgres views/functions; the UI never re-derives figures.
- **shadcn/ui + Tailwind**; **shadcn Charts**; **react-hook-form + zod**.
- Money as `numeric` (no floats); high-precision rates; **tabular numerals** in
  the UI.
- Deploy on **Vercel**; schema via **Supabase migrations**.

## 8. Visual design & theming

- **Mobile-first**: single-column layouts, thumb-reachable Quick-Add, swipeable
  account/subscription cards, bottom nav → sidebar at desktop breakpoints, charts
  reflow to stacked full-width.
- **Light + dark themes, default system**, with a persisted manual toggle and no
  flash-of-wrong-theme on load. All colors are **semantic tokens**.
- Elegant, calm "finance but human" aesthetic: rounded cards, soft borders,
  low-elevation shadows, strong type hierarchy, a clean grotesk (Geist/Inter) with
  tabular figures, one confident accent color, and accessible **status colors**
  (green within / amber approaching / red over) that pass contrast in both themes.
  Account cards keep brand color/logo. Subtle motion on progress bars, the donut,
  and theme transitions.
- Pixel-level design executed with the design skills (`design-taste-frontend` /
  `frontend-design`) during implementation.

## 9. Security

- RLS on every table keyed to `user_id`; policies for select/insert/update/delete.
- Mutations go through Server Actions with zod validation; the Supabase client is
  the authenticated (RLS-enforcing) client, never the service role in user paths.
- Immutable fields (account currency; transaction currency/exchange rate) enforced
  at the app layer and, where practical, via DB constraints/triggers.

## 10. Build order (phases for the implementation plan)

1. **Foundation** — Next.js + TypeScript + Tailwind + shadcn init; Supabase
   project + `@supabase/ssr` auth; theming (light/dark/system); app shell
   (sidebar/bottom-nav), Quick-Add scaffold.
2. **Schema & data layer** — migrations for all tables, RLS policies, derived
   views/functions, seed reference data (currencies, default categories).
3. **Accounts** — CRUD for all account types incl. credit cards, loans, card
   groups, fee settings; account gallery + account detail; reconcile/statement
   panel; loan amortization detail.
4. **Transactions & Quick-Add** — expense/income/payment forms with currency +
   provided rate, tax/commission toggles and smart defaults, budget-only flag;
   unified ledger with filters.
5. **Budgets** — category management, per-month budget snapshots, budget grid with
   used/left/status, month switcher.
6. **Subscriptions** — subscription CRUD, logo grid + table view, Add Charge →
   expense, monthly total.
7. **Insights** — all graphs from Section 6.
8. **Polish** — mobile refinements, empty states, loading/skeletons, micro-motion,
   accessibility pass.

## 11. Later phases (separate specs)
- **Statement import** (CSV/PDF) for credit cards — auto-fills `card_statements`
  and `current_balance`; no model change required.
- **Household / shared accounts** — ownership/membership layer.
