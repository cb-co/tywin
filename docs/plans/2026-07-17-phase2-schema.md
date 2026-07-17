# Phase 2 — Schema & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete Postgres data layer — every table, RLS policy, computed-money trigger, derived view/function, and per-user seed data — so feature phases (Accounts, Transactions, Budgets, Subscriptions, Insights) read money figures straight from the database and never re-derive them client-side.

**Architecture:** Supabase Postgres with strict per-user isolation via Row Level Security on every table. Money math lives entirely in the database: account balances, card status, loan status, category usage, net worth, cash flow, and spend distribution are `security_invoker` views and functions. Transaction tax/fee/base-currency amounts are computed by a `BEFORE INSERT/UPDATE` trigger from per-account fee settings and the user-provided exchange rate; immutable fields (account currency, transaction currency/rate) are enforced by triggers. Schema ships as ordered SQL migration files under `supabase/migrations/`.

**Tech Stack:** Supabase CLI (installed as a dev dependency), Postgres 15+, `@supabase/ssr` (already wired in Phase 1), `supabase gen types typescript` for end-to-end types.

## Global Constraints

- **Money columns:** `numeric(18,4)`. **Exchange rates:** `numeric(18,8)`. Never floats. (Spec §4.)
- **Every domain table carries `user_id uuid`** and has RLS enabled with owner-scoped policies for select/insert/update/delete. (Spec §2, §9.)
- **RLS idioms (from the Supabase skill security checklist — follow exactly):**
  - Policies use `TO authenticated` **plus** an ownership predicate; never `TO authenticated` alone, never `auth.role()`.
  - Wrap `auth.uid()` as `(select auth.uid())` so the planner caches it per-statement.
  - UPDATE policies need **both** `USING` and `WITH CHECK`; INSERT policies need `WITH CHECK`.
  - Views use `WITH (security_invoker = true)` (Postgres 15+) so they respect the querying user's RLS.
  - `SECURITY DEFINER` only where a trigger must write across schemas (auth→public); such functions set `search_path = ''`, schema-qualify every reference, and live with an ownership/`auth.uid()` guard. No `SECURITY DEFINER` anywhere else.
- **Timestamps:** `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` on every table; `updated_at` maintained by a shared trigger.
- **Base currency:** `profiles.base_currency` default `'USD'`. If a transaction's currency equals the base currency, `exchange_rate = 1`.
- **Immutable fields:** `accounts.currency`, `transactions.currency`, `transactions.exchange_rate` cannot change after insert (trigger-enforced).
- **`budget_only` transactions** feed budgets/analytics but must be **excluded** from all account-balance and net-worth math.
- **Credit-card balances are reconciliation-based** (`accounts.current_balance`), never derived from transactions. Payments *to* a card are real transactions that reduce `current_balance` via trigger; card *charges* are never logged as transactions.
- **Spec:** `docs/specs/2026-07-16-financial-tracker-design.md` (data model §4, derived views §4/§6).

---

## Migration & Verification Mechanics (read once before Task 1)

There is **no Supabase CLI, no `supabase/` directory, and no local Postgres** in this repo yet; the app points at a **remote hosted** Supabase project via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Two supported ways to apply each migration; pick one and use it consistently:

- **Path A — Local stack (preferred for iteration).** `npx supabase start` boots a local Postgres in Docker. Iterate with `npx supabase db query < file.sql` (CLI ≥ 2.79) or `psql`, then generate the migration. Requires Docker.
- **Path B — Remote project (no Docker).** Link once (`npx supabase login` with a personal access token, then `npx supabase link --project-ref <ref>`) and apply with `npx supabase db push`. As a last-resort fallback, paste the migration SQL into the **Dashboard → SQL Editor** and run it. **Applying to the remote is a user-owned step** — it writes to the live project and needs the user's access token and DB password, which the agent does not hold. The agent authors and stages the SQL; a human runs the apply against remote.

**Verification** in each task is a SQL block you run after applying (local `db query`, `psql`, or the Dashboard SQL Editor). "Two-user isolation" checks use two rows in `auth.users`; on the local stack create them with `auth.admin` via the Studio, or assert the policy shape with `pg_policies`. Every task ends by committing the migration file(s) to git regardless of where they were applied.

**Creating migration files:** always `npx supabase migration new <name>` (never hand-name files); paste the task's SQL into the generated file. Filenames below use `<timestamp>` as a placeholder for the CLI-generated prefix.

---

### Task 1: Supabase local scaffold & migration tooling

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `.gitignore` additions.
- Modify: `package.json` (add `supabase` dev dependency + scripts).

**Interfaces:**
- Consumes: the existing Phase 1 app and `.env.local`.
- Produces: a working `npx supabase` CLI, a `supabase/migrations/` directory, and npm scripts `db:new`, `db:push`, `db:types`. No schema yet.

- [ ] **Step 1: Install the Supabase CLI as a dev dependency**

```bash
npm install -D supabase
npx supabase --version
```
Expected: prints a version ≥ `2.81.3` (needed for `db advisors`; older still works for `db push`).

- [ ] **Step 2: Initialize the Supabase project structure**

```bash
npx supabase init
```
Expected: creates `supabase/config.toml` and an empty `supabase/migrations/`. Answer "N" if asked to generate VS Code settings.

- [ ] **Step 3: Add convenience scripts**

```bash
npm pkg set scripts.db:new="supabase migration new"
npm pkg set scripts.db:push="supabase db push"
npm pkg set scripts.db:types="supabase gen types typescript --linked > lib/supabase/types.ts"
```

- [ ] **Step 4: Keep local-only Supabase artifacts out of git**

Append to `.gitignore`:

```gitignore
# Supabase local stack
supabase/.branches
supabase/.temp
supabase/.env
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Supabase CLI and migration scaffold"
```

---

### Task 2: Foundations — extensions, enums, shared trigger, profiles

**Files:**
- Create: `supabase/migrations/<timestamp>_foundations.sql`

**Interfaces:**
- Consumes: `auth.users` (Supabase-managed).
- Produces:
  - Enums `account_type`, `transaction_type`, `billing_cycle`, `budget_status`, `statement_source`.
  - Function `public.set_updated_at()` (trigger) reused by every table.
  - Table `public.profiles(id, display_name, base_currency, created_at, updated_at)` with RLS.
  - Trigger `on_auth_user_created` → `public.handle_new_user()` inserting a profile row for each new auth user.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new foundations
```

- [ ] **Step 2: Write the foundations SQL**

Paste into the generated file:

```sql
-- Extensions -------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- Enums ------------------------------------------------------------------
create type public.account_type as enum
  ('checking','savings','cash','investment','asset','credit_card','loan');
create type public.transaction_type as enum ('expense','income','payment');
create type public.billing_cycle as enum ('weekly','monthly','yearly','custom');
create type public.budget_status as enum ('within','approaching','over');
create type public.statement_source as enum ('manual','import');

-- Shared updated_at trigger ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ---------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  base_currency text not null default 'USD' check (char_length(base_currency) = 3),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row for each new auth user.
-- SECURITY DEFINER is required to write public.profiles from an auth trigger;
-- search_path is pinned empty and every name is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply the migration** (Path A or B from the mechanics section).

- [ ] **Step 4: Verify profile auto-creation and RLS shape**

Run:

```sql
-- Policies exist and are owner-scoped (not role-only)
select policyname, cmd, qual is not null as has_using, with_check is not null as has_check
from pg_policies where schemaname = 'public' and tablename = 'profiles'
order by policyname;

-- RLS is enabled
select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;
```
Expected: four policies (read/insert/update), `relrowsecurity = true`. Then create a user via Studio/Auth and confirm a matching `public.profiles` row appears.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): foundations — enums, updated_at trigger, profiles with RLS"
```

---

### Task 3: Card groups & accounts

**Files:**
- Create: `supabase/migrations/<timestamp>_accounts.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.set_updated_at`, enum `account_type`.
- Produces:
  - `public.card_groups(id, user_id, name, brand, last4, art_color, art_url, timestamps)`.
  - `public.accounts(...)` with common fields, fee settings, credit-card fields, loan fields, `card_group_id`. RLS on both. Trigger `accounts_currency_immutable`.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new accounts
```

- [ ] **Step 2: Write the accounts SQL**

```sql
-- Card groups ------------------------------------------------------------
create table public.card_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  brand      text,
  last4      text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  art_color  text,
  art_url    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Accounts ---------------------------------------------------------------
create table public.accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  name                 text not null,
  type                 public.account_type not null,
  currency             text not null check (char_length(currency) = 3),
  starting_balance     numeric(18,4) not null default 0,
  icon                 text,
  color                text,
  logo_url             text,
  is_archived          boolean not null default false,
  sort_order           integer not null default 0,

  -- Fee settings (all types)
  transfer_tax_rate    numeric(18,8) not null default 0.0020,
  network_fee_amount   numeric(18,4) not null default 0,
  network_fee_optional boolean not null default true,

  -- Credit-card fields
  credit_limit         numeric(18,4),
  statement_closing_day smallint check (statement_closing_day between 1 and 31),
  payment_due_day      smallint check (payment_due_day between 1 and 31),
  card_group_id        uuid references public.card_groups (id) on delete set null,
  current_balance      numeric(18,4) not null default 0,

  -- Loan fields
  principal            numeric(18,4),
  interest_rate        numeric(18,8),
  term_months          integer,
  start_date           date,
  installment_amount   numeric(18,4),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_card_group_id_idx on public.accounts (card_group_id);

-- RLS: card_groups
alter table public.card_groups enable row level security;

create policy "card_groups: owner read" on public.card_groups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_groups: owner insert" on public.card_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_groups: owner update" on public.card_groups
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_groups: owner delete" on public.card_groups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: accounts
alter table public.accounts enable row level security;

create policy "accounts: owner read" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts: owner insert" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts: owner update" on public.accounts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts: owner delete" on public.accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- updated_at triggers
create trigger card_groups_set_updated_at before update on public.card_groups
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- Currency is immutable once the account exists.
create or replace function public.accounts_forbid_currency_change()
returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency then
    raise exception 'accounts.currency is immutable';
  end if;
  return new;
end;
$$;

create trigger accounts_currency_immutable before update on public.accounts
  for each row execute function public.accounts_forbid_currency_change();
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify immutability and RLS**

```sql
-- Currency change is rejected (expect ERROR)
do $$
declare a uuid;
begin
  insert into public.accounts (user_id, name, type, currency)
  values ('00000000-0000-0000-0000-000000000000','Test','checking','USD')
  returning id into a;
  begin
    update public.accounts set currency = 'DOP' where id = a;
    raise notice 'FAIL: currency change was allowed';
  exception when others then
    raise notice 'OK: currency change rejected (%%)', sqlerrm;
  end;
  delete from public.accounts where id = a;
end $$;

select count(*) as account_policies from pg_policies
where schemaname='public' and tablename='accounts';  -- expect 4
```
Expected: notice `OK: currency change rejected`, `account_policies = 4`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): card_groups and accounts with fee/card/loan fields, RLS, immutable currency"
```

---

### Task 4: Categories & monthly budget snapshots

**Files:**
- Create: `supabase/migrations/<timestamp>_categories_budgets.sql`

**Interfaces:**
- Consumes: `public.set_updated_at`.
- Produces:
  - `public.categories(id, user_id, name, emoji, icon, color, sort_order, timestamps)`.
  - `public.category_budgets(id, user_id, category_id, month, amount, timestamps)` with a unique `(category_id, month)` and `month` normalized to the first of the month.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new categories_budgets
```

- [ ] **Step 2: Write the categories & budgets SQL**

```sql
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  emoji      text,
  icon       text,
  color      text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.category_budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month       date not null check (month = date_trunc('month', month::timestamp)::date),
  amount      numeric(18,4) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, month)
);

create index categories_user_id_idx on public.categories (user_id);
create index category_budgets_user_month_idx on public.category_budgets (user_id, month);

-- RLS: categories
alter table public.categories enable row level security;
create policy "categories: owner read" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories: owner insert" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories: owner update" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories: owner delete" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- RLS: category_budgets
alter table public.category_budgets enable row level security;
create policy "category_budgets: owner read" on public.category_budgets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_budgets: owner insert" on public.category_budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "category_budgets: owner update" on public.category_budgets
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_budgets: owner delete" on public.category_budgets
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger category_budgets_set_updated_at before update on public.category_budgets
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify the month constraint and uniqueness**

```sql
-- Non-first-of-month is rejected (expect ERROR), first-of-month accepted.
do $$
declare c uuid; u uuid := '00000000-0000-0000-0000-000000000000';
begin
  insert into public.categories (user_id, name) values (u,'Groceries') returning id into c;
  begin
    insert into public.category_budgets (user_id, category_id, month, amount)
    values (u, c, date '2026-07-15', 500);
    raise notice 'FAIL: mid-month date accepted';
  exception when others then raise notice 'OK: month must be first-of-month';
  end;
  insert into public.category_budgets (user_id, category_id, month, amount)
  values (u, c, date '2026-07-01', 500);
  raise notice 'OK: first-of-month accepted';
  delete from public.categories where id = c;
end $$;
```
Expected: `OK: month must be first-of-month`, `OK: first-of-month accepted`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): categories and per-month budget snapshots with RLS"
```

---

### Task 5: Transactions — table, invariants, computed-money trigger

**Files:**
- Create: `supabase/migrations/<timestamp>_transactions.sql`

**Interfaces:**
- Consumes: `public.accounts`, `public.categories`, enum `transaction_type`, `public.set_updated_at`. (`subscription_id` FK is added later in Task 6 to avoid a forward reference.)
- Produces:
  - `public.transactions(...)` with type/account CHECK invariants.
  - Trigger `transactions_compute_amounts` computing `tax_amount`, `fee_amount`, `total_amount`, `base_amount`, `base_total_amount` on insert/update.
  - Trigger `transactions_immutable_money` forbidding changes to `currency` / `exchange_rate`.
  - Trigger `transactions_sync_card_balance` adjusting `accounts.current_balance` when a payment targets a credit card.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new transactions
```

- [ ] **Step 2: Write the transactions SQL**

```sql
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            public.transaction_type not null,
  account_id      uuid not null references public.accounts (id) on delete cascade,
  to_account_id   uuid references public.accounts (id) on delete set null,
  category_id     uuid references public.categories (id) on delete set null,

  amount          numeric(18,4) not null check (amount >= 0),
  currency        text not null check (char_length(currency) = 3),
  exchange_rate   numeric(18,8) not null default 1 check (exchange_rate > 0),
  base_amount     numeric(18,4) not null default 0,

  include_tax        boolean not null default false,
  include_commission boolean not null default false,
  tax_amount         numeric(18,4) not null default 0,
  fee_amount         numeric(18,4) not null default 0,
  total_amount       numeric(18,4) not null default 0,
  base_total_amount  numeric(18,4) not null default 0,

  budget_only     boolean not null default false,
  description     text,
  occurred_at     timestamptz not null default now(),
  notes           text,
  -- subscription_id FK added in the subscriptions migration
  subscription_id uuid,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Type/account invariants (spec §3.1)
  constraint payment_needs_destination
    check (type <> 'payment' or to_account_id is not null),
  constraint non_payment_has_no_destination
    check (type = 'payment' or to_account_id is null),
  constraint expense_requires_category
    check (type <> 'expense' or category_id is not null),
  constraint income_has_no_category
    check (type <> 'income' or category_id is null),
  constraint no_self_transfer
    check (to_account_id is null or to_account_id <> account_id)
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id);
create index transactions_category_occurred_idx
  on public.transactions (category_id, occurred_at);

-- RLS
alter table public.transactions enable row level security;
create policy "transactions: owner read" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions: owner insert" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions: owner update" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions: owner delete" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- Compute tax/fee/total/base from the source account's fee settings and the
-- user-provided exchange rate. tax + fee leave the source account (spec §3.4).
create or replace function public.transactions_compute_amounts()
returns trigger language plpgsql as $$
declare
  src public.accounts%rowtype;
begin
  select * into src from public.accounts where id = new.account_id;

  new.tax_amount := case
    when new.include_tax then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4)
    else 0 end;
  new.fee_amount := case
    when new.include_commission then coalesce(src.network_fee_amount, 0)
    else 0 end;

  new.total_amount      := new.amount + new.tax_amount + new.fee_amount;
  new.base_amount       := round(new.amount * new.exchange_rate, 4);
  new.base_total_amount := round(new.total_amount * new.exchange_rate, 4);
  return new;
end;
$$;

create trigger transactions_compute_amounts
  before insert or update on public.transactions
  for each row execute function public.transactions_compute_amounts();

-- currency and exchange_rate are immutable once saved (spec §9).
create or replace function public.transactions_forbid_money_change()
returns trigger language plpgsql as $$
begin
  if new.currency is distinct from old.currency
     or new.exchange_rate is distinct from old.exchange_rate then
    raise exception 'transactions.currency and exchange_rate are immutable';
  end if;
  return new;
end;
$$;

create trigger transactions_immutable_money before update on public.transactions
  for each row execute function public.transactions_forbid_money_change();

-- Payments to a credit card reduce its reconciled current_balance; reversing on
-- delete/update keeps the maintained figure correct. Card charges are never
-- transactions, so this is the only path that moves current_balance.
create or replace function public.transactions_sync_card_balance()
returns trigger language plpgsql as $$
declare
  is_card boolean;
begin
  if tg_op in ('DELETE','UPDATE') and old.type = 'payment' and old.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = old.to_account_id;
    if is_card then
      update public.accounts set current_balance = current_balance + old.amount
      where id = old.to_account_id;  -- undo the prior effect
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select type = 'credit_card' into is_card from public.accounts where id = new.to_account_id;
    if is_card then
      update public.accounts set current_balance = current_balance - new.amount
      where id = new.to_account_id;  -- apply the new effect
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger transactions_sync_card_balance
  after insert or update or delete on public.transactions
  for each row execute function public.transactions_sync_card_balance();
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify computed money and card sync**

```sql
do $$
declare
  u uuid := '00000000-0000-0000-0000-000000000000';
  bank uuid; card uuid; tx uuid;
begin
  insert into public.accounts (user_id, name, type, currency, transfer_tax_rate, network_fee_amount)
    values (u,'Checking','checking','DOP',0.0020,100) returning id into bank;
  insert into public.accounts (user_id, name, type, currency, current_balance)
    values (u,'Visa','credit_card','DOP',5000) returning id into card;

  -- Pay 1000 DOP to the card with tax + commission on.
  insert into public.transactions
    (user_id, type, account_id, to_account_id, amount, currency, include_tax, include_commission)
    values (u,'payment',bank,card,1000,'DOP',true,true)
  returning id into tx;

  -- Expect: tax=2.00 (0.20%), fee=100, total=1102, card balance 5000-1000=4000
  raise notice 'tax=%% fee=%% total=%% base_total=%%',
    (select tax_amount from public.transactions where id=tx),
    (select fee_amount from public.transactions where id=tx),
    (select total_amount from public.transactions where id=tx),
    (select base_total_amount from public.transactions where id=tx);
  raise notice 'card_balance=%% (expect 4000)', (select current_balance from public.accounts where id=card);

  delete from public.transactions where id = tx;
  raise notice 'card_balance_after_delete=%% (expect 5000)', (select current_balance from public.accounts where id=card);

  delete from public.accounts where id in (bank, card);
end $$;
```
Expected notices: `tax=2.0000 fee=100.0000 total=1102.0000 base_total=1102.0000`, `card_balance=4000`, `card_balance_after_delete=5000`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): transactions with invariants, computed money trigger, card-balance sync"
```

---

### Task 6: Subscriptions (+ transactions.subscription_id FK)

**Files:**
- Create: `supabase/migrations/<timestamp>_subscriptions.sql`

**Interfaces:**
- Consumes: `public.accounts`, `public.categories`, enum `billing_cycle`, `public.transactions` (adds the deferred FK).
- Produces: `public.subscriptions(...)` with RLS; adds `transactions.subscription_id` foreign key to `public.subscriptions`.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new subscriptions
```

- [ ] **Step 2: Write the subscriptions SQL**

```sql
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  brand         text,
  logo_url      text,
  amount        numeric(18,4) not null default 0,
  currency      text not null check (char_length(currency) = 3),
  billing_cycle public.billing_cycle not null default 'monthly',
  anchor_day    smallint check (anchor_day between 1 and 31),
  account_id    uuid references public.accounts (id) on delete set null,
  category_id   uuid references public.categories (id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;
create policy "subscriptions: owner read" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "subscriptions: owner insert" on public.subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "subscriptions: owner update" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "subscriptions: owner delete" on public.subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Now that subscriptions exists, wire up the deferred FK from transactions.
alter table public.transactions
  add constraint transactions_subscription_id_fkey
  foreign key (subscription_id) references public.subscriptions (id) on delete set null;
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify the FK and RLS**

```sql
select conname from pg_constraint
where conrelid = 'public.transactions'::regclass
  and conname = 'transactions_subscription_id_fkey';  -- expect one row

select count(*) from pg_policies
where schemaname='public' and tablename='subscriptions';  -- expect 4
```
Expected: the FK row exists; policy count is 4.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): subscriptions with RLS and transactions.subscription_id FK"
```

---

### Task 7: Card statements (reserved for import)

**Files:**
- Create: `supabase/migrations/<timestamp>_card_statements.sql`

**Interfaces:**
- Consumes: `public.accounts`, enum `statement_source`.
- Produces: `public.card_statements(...)` with RLS. No app feature consumes it yet (import is a later spec); the latest statement per card feeds `card_status` in Task 8.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new card_statements
```

- [ ] **Step 2: Write the card_statements SQL**

```sql
create table public.card_statements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  account_id        uuid not null references public.accounts (id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  statement_balance numeric(18,4) not null default 0,
  total_balance     numeric(18,4) not null default 0,
  total_debits      numeric(18,4) not null default 0,
  total_credits     numeric(18,4) not null default 0,
  due_date          date,
  source            public.statement_source not null default 'manual',
  file_url          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (period_end >= period_start)
);

create index card_statements_account_period_idx
  on public.card_statements (account_id, period_end desc);

alter table public.card_statements enable row level security;
create policy "card_statements: owner read" on public.card_statements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_statements: owner insert" on public.card_statements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_statements: owner update" on public.card_statements
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_statements: owner delete" on public.card_statements
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger card_statements_set_updated_at before update on public.card_statements
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify RLS and the period check**

```sql
select count(*) from pg_policies
where schemaname='public' and tablename='card_statements';  -- expect 4
```
Expected: 4.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): card_statements table (reserved for import) with RLS"
```

---

### Task 8: Derived views & functions (money math)

**Files:**
- Create: `supabase/migrations/<timestamp>_derived_views.sql`

**Interfaces:**
- Consumes: all tables above.
- Produces (all `security_invoker`, so each caller only sees their own rows):
  - View `account_balances` — derived own-currency + base balance per non-card account.
  - View `card_status` — owed, utilization %, latest statement balance, estimated next due date.
  - View `loan_status` — outstanding balance, installments paid, next payment date.
  - View `net_worth` — single base-currency figure per user (assets +, cards/loans −).
  - View `monthly_cashflow` — income vs expense vs net per month (base currency).
  - Function `category_usage(p_month date)` — budget, used, left, status per category.
  - Function `spend_distribution(p_month date)` — expense totals by category (base currency).

> **Balance rules encoded below (spec §3.2, §3.4):** non-card balance = `starting_balance` + Σ incoming `amount` − Σ outgoing `total_amount`, excluding `budget_only` rows, in the account's own currency; base figures use `base_amount` / `base_total_amount`. Cross-currency transfer destinations are assumed same-currency in v1 (rate-to-base only per spec §3.3); revisit if multi-currency transfers are added.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new derived_views
```

- [ ] **Step 2: Write the derived-views SQL**

```sql
-- Non-card account balances (own currency + base) -----------------------
create view public.account_balances
with (security_invoker = true) as
with movements as (
  select a.id as account_id,
         a.user_id,
         a.currency,
         a.starting_balance,
         -- own-currency net from transactions (exclude budget_only)
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.amount
           when t.type = 'expense' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.amount
           else 0 end), 0) as net_amount,
         coalesce(sum(case
           when t.budget_only then 0
           when t.type = 'income'  and t.account_id = a.id then t.base_amount
           when t.type = 'expense' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.base_amount
           else 0 end), 0) as net_base_amount
  from public.accounts a
  left join public.transactions t
    on (t.account_id = a.id or t.to_account_id = a.id)
  where a.type <> 'credit_card'
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance + net_amount as balance,
       net_base_amount               as base_movement,
       starting_balance + net_amount as balance_own_currency
from movements;

-- Credit-card status ----------------------------------------------------
create view public.card_status
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
       a.payment_due_day
from public.accounts a
left join lateral (
  select statement_balance, due_date
  from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

-- Loan status -----------------------------------------------------------
create view public.loan_status
with (security_invoker = true) as
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       -- outstanding = principal − Σ payments into the loan (exclude budget_only)
       a.principal - coalesce((
         select sum(t.amount) from public.transactions t
         where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
       ), 0) as outstanding_balance,
       coalesce((
         select count(*) from public.transactions t
         where t.to_account_id = a.id and t.type = 'payment' and not t.budget_only
       ), 0) as installments_paid
from public.accounts a
where a.type = 'loan';

-- Net worth (base currency) ---------------------------------------------
create view public.net_worth
with (security_invoker = true) as
select p.id as user_id,
       p.base_currency,
       coalesce((
         select sum(ab.starting_balance + ab.base_movement)
         from public.account_balances ab where ab.user_id = p.id
       ), 0)
       - coalesce((
         select sum(cs.owed) from public.card_status cs where cs.user_id = p.id
       ), 0)
       - coalesce((
         select sum(ls.outstanding_balance) from public.loan_status ls where ls.user_id = p.id
       ), 0) as net_worth
from public.profiles p;

-- Monthly cash flow (base currency) -------------------------------------
create view public.monthly_cashflow
with (security_invoker = true) as
select t.user_id,
       date_trunc('month', t.occurred_at)::date as month,
       sum(case when t.type = 'income' then t.base_amount else 0 end)  as income,
       sum(case when t.type = 'expense' and not t.budget_only
                then t.base_total_amount else 0 end)                    as expense,
       sum(case when t.type = 'income' then t.base_amount
                when t.type = 'expense' and not t.budget_only then -t.base_total_amount
                else 0 end)                                             as net
from public.transactions t
group by t.user_id, date_trunc('month', t.occurred_at)::date;

-- Category usage for a month --------------------------------------------
-- used = Σ base_total of categorized expenses + categorized payments in the
-- month (incl. tax/fee, incl. budget_only expenses). (spec §3.5)
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
  with m as (select date_trunc('month', p_month)::date as month)
  select c.id as category_id,
         coalesce(b.amount, 0) as budget,
         coalesce(u.used, 0)   as used,
         coalesce(b.amount, 0) - coalesce(u.used, 0) as remaining,
         case
           when coalesce(u.used,0) > coalesce(b.amount,0) then 'over'::public.budget_status
           when coalesce(b.amount,0) > 0
             and coalesce(u.used,0) >= 0.9 * b.amount     then 'approaching'::public.budget_status
           else 'within'::public.budget_status
         end as status
  from public.categories c
  cross join m
  left join public.category_budgets b
    on b.category_id = c.id and b.month = m.month
  left join (
    select t.category_id, sum(t.base_total_amount) as used
    from public.transactions t, m
    where t.category_id is not null
      and t.type in ('expense','payment')
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- Spend distribution for a month ----------------------------------------
create or replace function public.spend_distribution(p_month date)
returns table (category_id uuid, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.base_total_amount) as total
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.type = 'expense'
    and t.category_id is not null
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify a full money scenario**

```sql
do $$
declare
  u uuid := '00000000-0000-0000-0000-000000000000';
  bank uuid; cat uuid;
begin
  insert into public.accounts (user_id, name, type, currency, starting_balance)
    values (u,'Checking','checking','USD',1000) returning id into bank;
  insert into public.categories (user_id, name) values (u,'Groceries') returning id into cat;
  insert into public.category_budgets (user_id, category_id, month, amount)
    values (u, cat, date_trunc('month', now())::date, 300);

  insert into public.transactions (user_id, type, account_id, category_id, amount, currency, occurred_at)
    values (u,'expense',bank,cat,120,'USD', now());

  -- balance 1000-120=880; net_worth 880; category used 120, remaining 180, within
  raise notice 'balance=%% (expect 880.0000)',
    (select balance from public.account_balances where account_id = bank);
  raise notice 'used=%% remaining=%% status=%%',
    (select used from public.category_usage(now()::date) where category_id = cat),
    (select remaining from public.category_usage(now()::date) where category_id = cat),
    (select status from public.category_usage(now()::date) where category_id = cat);

  delete from public.transactions where account_id = bank;
  delete from public.categories where id = cat;
  delete from public.accounts where id = bank;
end $$;
```
Expected: `balance=880.0000`, `used=120.0000 remaining=180.0000 status=within`.

- [ ] **Step 5: Run the security advisor and fix findings**

```bash
npx supabase db advisors --linked   # or MCP get_advisors; Dashboard → Advisors as fallback
```
Expected: no `security_definer_view` or missing-RLS warnings. (Every view is `security_invoker`; every base table has RLS.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): derived views and functions for balances, status, budgets, net worth"
```

---

### Task 9: Seed reference data & default categories for new users

**Files:**
- Create: `supabase/migrations/<timestamp>_seed_defaults.sql`

**Interfaces:**
- Consumes: `public.profiles`, `public.categories`, `public.handle_new_user` (extended).
- Produces:
  - Table `public.currencies(code, name, symbol)` — shared reference data readable by all authenticated users (RLS: read-only), seeded with the currencies the user actually uses.
  - Extends the new-user flow so each new profile is seeded a starter set of categories.

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new seed_defaults
```

- [ ] **Step 2: Write the seed SQL**

```sql
-- Shared, read-only currency reference table -----------------------------
create table public.currencies (
  code   text primary key check (char_length(code) = 3),
  name   text not null,
  symbol text not null
);

alter table public.currencies enable row level security;
create policy "currencies: readable by authenticated"
  on public.currencies for select to authenticated using (true);

insert into public.currencies (code, name, symbol) values
  ('USD','US Dollar','$'),
  ('DOP','Dominican Peso','RD$'),
  ('EUR','Euro','€')
on conflict (code) do nothing;

-- Seed starter categories for each new profile ---------------------------
create or replace function public.seed_default_categories(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, emoji, sort_order)
  values
    (p_user,'Groceries','🛒',1),
    (p_user,'Dining','🍽️',2),
    (p_user,'Transport','🚗',3),
    (p_user,'Housing','🏠',4),
    (p_user,'Utilities','💡',5),
    (p_user,'Health','⚕️',6),
    (p_user,'Shopping','🛍️',7),
    (p_user,'Entertainment','🎬',8),
    (p_user,'Savings','💰',9),
    (p_user,'Other','•',10);
end;
$$;

-- Extend the new-user handler to also seed categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
```

- [ ] **Step 3: Apply the migration.**

- [ ] **Step 4: Verify a brand-new user gets currencies + categories**

Create a fresh user (Studio → Authentication → Add user, or a signup through the app), then:

```sql
select count(*) from public.currencies;  -- expect 3
-- As that user (or by user_id):
select count(*) from public.categories where user_id = '<new-user-id>';  -- expect 10
```
Expected: `currencies = 3`, `categories = 10` for the new user.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): seed currencies and default categories for new users"
```

---

### Task 10: Generate TypeScript types

**Files:**
- Create: `lib/supabase/types.ts` (generated).
- Modify: `lib/supabase/client.ts`, `lib/supabase/server.ts` (type the client with `Database`).

**Interfaces:**
- Consumes: the applied remote schema.
- Produces: `Database` type consumed by both Supabase clients so Server Components/Actions get typed rows in later phases.

- [ ] **Step 1: Generate types from the linked project**

```bash
npm run db:types   # supabase gen types typescript --linked > lib/supabase/types.ts
```
Expected: `lib/supabase/types.ts` contains `export type Database = { ... }` with `public.accounts`, `public.transactions`, etc.

- [ ] **Step 2: Type the browser client**

Edit `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 3: Type the server client**

Edit `lib/supabase/server.ts` — change `createServerClient(` to `createServerClient<Database>(` and add `import type { Database } from "./types";` at the top (leave the cookie config untouched).

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat(db): generate and wire Supabase Database types"
```

---

## Self-Review

**Spec coverage (Phase 2 scope = spec §10.2 + data model §4 + derived views §4/§6):**
- `profiles`, `accounts`, `card_groups`, `categories`, `category_budgets`, `transactions`, `subscriptions`, `card_statements` → Tasks 2–7. ✅
- RLS on every table, owner-scoped for select/insert/update/delete → every table task. ✅
- Money as `numeric(18,4)`, rates `numeric(18,8)` → all columns. ✅
- Tax/fee/base computed from account settings + provided rate; total leaves source; base amounts stored → Task 5 trigger. ✅
- Immutable account currency, transaction currency/rate → Tasks 3 & 5 triggers. ✅
- Credit-card reconciliation (`current_balance`, payments reduce it, charges never logged) → Task 5 sync trigger + Task 8 `card_status`. ✅
- `budget_only` excluded from balances/net worth, included in budgets → Task 8 views + `category_usage`. ✅
- Derived views/functions: `account_balances`, `card_status`, `loan_status`, `category_usage`, `net_worth`, `monthly_cashflow`, `spend_distribution` → Task 8. ✅ (`net_worth_history` deferred — see below.)
- Seed reference data (currencies) + default categories → Task 9. ✅
- Types for the app → Task 10. ✅

**Deliberately deferred (not gaps):**
- **`net_worth_history`** (spec §4/§6 "net worth over time"): a point-in-time series needs either periodic snapshots or a balance-as-of-date function; it is an **Insights (Phase 7)** concern and depends on charting decisions. Building it now would be speculative. Flag it in the Phase 7 plan.
- **`subscriptions.next_charge_date`** and card **estimated next due date** as fully-computed calendar math: `card_status` exposes the closing/due days and latest due date; turning day-of-month + cycle into the next concrete date is trivial in the UI/Server Action layer and is done in Accounts (Phase 3) / Subscriptions (Phase 6) where the calendar rules live. The schema carries every input field.
- **Data API exposure:** if the project's Data API does not auto-expose new `public` tables, grant `select/insert/update/delete` to `authenticated` per the Supabase skill; RLS still gates rows. Verify in Task 2's apply step and add grants if the app gets empty results despite correct RLS.

**Placeholder scan:** No "TODO/TBD/handle edge cases" in steps; every migration is complete SQL; every verification is a runnable block with expected output.

**Type consistency:** `set_updated_at`, `handle_new_user`, `seed_default_categories`, `transactions_compute_amounts`, `accounts_forbid_currency_change`, `transactions_forbid_money_change`, `transactions_sync_card_balance` are each defined once and referenced by matching trigger names. Enum names (`account_type`, `transaction_type`, `billing_cycle`, `budget_status`, `statement_source`) are defined in Task 2 and used consistently. `category_usage(date)` / `spend_distribution(date)` signatures match their Task 8 definitions and the verification calls.

## Next phases (written just-in-time before each is executed)
- **Phase 3** — Accounts: CRUD for all account types, card groups, fee settings, account gallery + detail, reconcile/statement panel, loan amortization.
- **Phase 4** — Transactions & Quick-Add forms. **Phase 5** — Budgets. **Phase 6** — Subscriptions. **Phase 7** — Insights (incl. `net_worth_history`). **Phase 8** — Polish.
