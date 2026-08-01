# Credit Card Budget & Cashflow Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Credit card expenses default to excluded from budget/cashflow (the card *payment* counts instead), card payments can carry a category, and the unused `budget_only` toggle is removed everywhere.

**Architecture:** Two SQL migrations (budget/cashflow logic flip; then the `budget_only` teardown) followed by application-code changes that either follow the new default or delete dead references to the removed column. No new tables, no new server actions — existing `category_usage`, `monthly_cashflow`, and `import_card_statement` are redefined in place, and `exclude_from_budget` (which already exists) gains a new default and a new caller (the statement import panel).

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS, `security invoker` views/functions), react-hook-form, next-intl, Vitest.

## Global Constraints

- No live Supabase project is linked in this dev environment — migrations cannot be applied or tested against a real database. `lib/supabase/types.ts` must be hand-edited to match (same situation as the prior `exclude_from_budget` work).
- No SQL test harness exists in this repo (no pgTAP). SQL changes are verified by careful reading against the spec, not automated tests.
- Every `create or replace function`/`create or replace view` in this plan reproduces the **full** current body plus the change — Postgres `create or replace` cannot do a partial edit, and `create or replace view` cannot add/remove/reorder columns (not needed here — no view here changes its column list).
- i18n: every UI-facing string change must land in both `messages/en.json` and `messages/es.json`.
- Full spec: `docs/superpowers/specs/2026-07-31-cc-budget-cashflow-design.md`.
- Tasks 3–8 jointly remove `budget_only` from a dozen-odd files (schema, actions, form, row, chart, insights, overview). They're written to run in the order given (1 → 11). A full-repo `npx tsc --noEmit` will show errors from files a not-yet-reached task hasn't fixed — that's expected mid-sequence, not a regression. Each task's own verification step scopes the check to files it touched; only Task 11 requires the whole repo to be clean.

---

### Task 1: Migration A — budget counts card payments, cashflow tracks real money out

**Files:**
- Create: `supabase/migrations/20260731130000_card_payment_default_and_cashflow.sql`

**Interfaces:**
- Produces: `category_usage(p_month date)` (unchanged signature) now counts categorized payments into a credit card. `monthly_cashflow` (unchanged columns: `user_id, month, income, expense, net`) now includes card/loan payments as outflow and excludes card/loan expenses. `import_card_statement(p jsonb)` (unchanged signature) reads an optional `p->>'exclude_from_budget'` key (defaults to `true`) and applies it to every inserted expense row.

- [ ] **Step 1: Write the migration**

```sql
-- Card payments now count toward budget by category — the mirror of card
-- *expenses* defaulting to exclude_from_budget (see the import default
-- below and the transaction-form default in the app code). Drops the
-- hardcoded exclusion added in 20260722120000_statement_import.sql, which
-- assumed expenses (not payments) were the thing that counted.
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
      and not t.exclude_from_budget
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- Cashflow: real money out, not transaction type. A card/loan *expense*
-- hasn't left an account yet (it's borrowed); a *payment* that pays down a
-- card or loan has. A payment between two non-liability accounts is a
-- transfer between your own accounts and stays excluded, same as today
-- (monthly_cashflow ignored every payment before this change).
create or replace view public.monthly_cashflow
with (security_invoker = true) as
select t.user_id,
       date_trunc('month', t.occurred_at)::date as month,
       sum(case when t.type = 'income' then t.base_amount else 0 end) as income,
       sum(case
             when t.type = 'expense' and a.type not in ('credit_card','loan')
               then t.base_total_amount
             when t.type = 'payment' and da.type in ('credit_card','loan')
               then t.base_total_amount
             else 0
           end) as expense,
       sum(case
             when t.type = 'income' then t.base_amount
             when t.type = 'expense' and a.type not in ('credit_card','loan')
               then -t.base_total_amount
             when t.type = 'payment' and da.type in ('credit_card','loan')
               then -t.base_total_amount
             else 0
           end) as net
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts da on da.id = t.to_account_id
group by t.user_id, date_trunc('month', t.occurred_at)::date;

-- Statement import: the panel's "exclude these expenses from budget"
-- checkbox (default checked) now reaches the inserted rows. Body is
-- otherwise identical to 20260722160000_statement_fx_fallback.sql's
-- definition — the true latest `import_card_statement` before this
-- migration (NOT 20260722120000, which two later migrations,
-- 20260722130000_import_checksum_guard.sql and
-- 20260722150000_import_reject_duplicate_sections.sql, already
-- superseded; this preserves both of their guards plus the fx_fallback
-- capture from 20260722160000 itself).
create or replace function public.import_card_statement(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_import   uuid;
  v_stmt     uuid;
  v_line     uuid;
  v_txn      uuid;
  sec        jsonb;
  ln         jsonb;
  v_account  uuid;
  v_currency text;
  v_movement numeric;
  v_computed numeric;
  v_exclude  boolean := coalesce((p->>'exclude_from_budget')::boolean, true);
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if nullif(p->>'card_group_id','') is not null then
    if not exists (
      select 1 from public.card_groups
      where id = (p->>'card_group_id')::uuid and user_id = v_user
    ) then
      raise exception 'card_group % does not belong to you', p->>'card_group_id';
    end if;
  end if;

  if (select count(*) from jsonb_array_elements(p->'sections') s) <>
     (select count(distinct s->>'account_id') from jsonb_array_elements(p->'sections') s) then
    raise exception 'duplicate account_id across sections: each section must import to a distinct credit line';
  end if;

  insert into public.statement_imports (user_id, parser_id, card_group_id, file_name, file_path)
  values (v_user, p->>'parser_id', nullif(p->>'card_group_id','')::uuid,
          p->>'file_name', nullif(p->>'file_path',''))
  returning id into v_import;

  for sec in select * from jsonb_array_elements(p->'sections') loop
    v_account := (sec->>'account_id')::uuid;
    select currency into v_currency from public.accounts
      where id = v_account and user_id = v_user and type = 'credit_card';
    if v_currency is null then
      raise exception 'account % is not one of your credit cards', v_account;
    end if;

    if (sec->>'previous_balance') is null
       or (sec->>'total_balance') is null
       or (sec->>'total_debits') is null
       or (sec->>'total_credits') is null then
      raise exception 'section % is missing balance fields required for checksum validation',
        sec->>'section_key';
    end if;

    -- Defense in depth: the statement's own arithmetic must tie before any
    -- write. previous + Σlines = closing when lines exist; stated totals
    -- otherwise (line-less sections like Cuotas). App-layer validation can
    -- be bypassed by calling this RPC directly, so the invariant lives here.
    if jsonb_array_length(coalesce(sec->'lines', '[]'::jsonb)) > 0 then
      select coalesce(sum((l->>'amount')::numeric), 0) into v_movement
      from jsonb_array_elements(sec->'lines') l;
    else
      v_movement := (sec->>'total_debits')::numeric - (sec->>'total_credits')::numeric;
    end if;
    v_computed := (sec->>'previous_balance')::numeric + v_movement;
    if v_computed <> (sec->>'total_balance')::numeric then
      raise exception 'section % checksum mismatch: computed % vs stated %',
        sec->>'section_key', v_computed, (sec->>'total_balance')::numeric;
    end if;

    delete from public.card_statements
      where account_id = v_account and period_end = (sec->>'period_end')::date;

    insert into public.card_statements (
      user_id, account_id, import_id, section_key, source,
      period_start, period_end, due_date,
      previous_balance, total_debits, total_credits,
      statement_balance, total_balance,
      minimum_payment, overdue_amount, overdue_installments,
      credit_limit, available_credit,
      interest_rate_annual, avg_daily_balance, avg_daily_balance_prior,
      cost_of_carry, cost_of_carry_prior
    ) values (
      v_user, v_account, v_import, sec->>'section_key', 'import',
      (sec->>'period_start')::date, (sec->>'period_end')::date,
      nullif(sec->>'due_date','')::date,
      (sec->>'previous_balance')::numeric,
      (sec->>'total_debits')::numeric, (sec->>'total_credits')::numeric,
      (sec->>'statement_balance')::numeric, (sec->>'total_balance')::numeric,
      nullif(sec->>'minimum_payment','')::numeric,
      nullif(sec->>'overdue_amount','')::numeric,
      nullif(sec->>'overdue_installments','')::integer,
      nullif(sec->>'credit_limit','')::numeric,
      nullif(sec->>'available_credit','')::numeric,
      nullif(sec->>'interest_rate_annual','')::numeric,
      nullif(sec->>'avg_daily_balance','')::numeric,
      nullif(sec->>'avg_daily_balance_prior','')::numeric,
      nullif(sec->>'cost_of_carry','')::numeric,
      nullif(sec->>'cost_of_carry_prior','')::numeric
    ) returning id into v_stmt;

    for ln in select * from jsonb_array_elements(sec->'lines') loop
      insert into public.card_statement_lines (
        user_id, statement_id, account_id, line_no, made_on, posted_on,
        reference, description, mcc, auth_code, amount, kind
      ) values (
        v_user, v_stmt, v_account,
        (ln->>'line_no')::integer, (ln->>'made_on')::date, (ln->>'posted_on')::date,
        nullif(ln->>'reference',''), ln->>'description',
        nullif(ln->>'mcc',''), nullif(ln->>'auth_code',''),
        (ln->>'amount')::numeric, (ln->>'kind')::public.statement_line_kind
      ) returning id into v_line;

      if (ln->>'kind') <> 'payment' then
        if not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;

        insert into public.transactions (
          user_id, type, account_id, category_id, amount, currency, exchange_rate,
          fx_fallback, occurred_at, description, statement_line_id, exclude_from_budget
        ) values (
          v_user, 'expense', v_account, (ln->>'category_id')::uuid,
          (ln->>'amount')::numeric, v_currency,
          coalesce(nullif(sec->>'exchange_rate','')::numeric, 1),
          coalesce((sec->>'fx_fallback')::boolean, false),
          (ln->>'made_on')::timestamptz, ln->>'description', v_line, v_exclude
        ) returning id into v_txn;

        update public.card_statement_lines set transaction_id = v_txn where id = v_line;
      end if;
    end loop;

    perform public.recompute_card_balance(v_account);
  end loop;

  return v_import;
end;
$$;
revoke execute on function public.import_card_statement(jsonb) from anon;
```

- [ ] **Step 2: Read the file back and confirm five things**

1. `category_usage` still has `left join public.category_budgets b on b.category_id = c.id and b.month = m.month` (right after `cross join m`) — its `select` list references `b.amount` three times and would fail to create without this join in scope.
2. `category_usage`'s `used` subquery has no `and not (t.type = 'payment' and exists (...))` clause left.
3. `monthly_cashflow` joins `accounts a` (inner, on `t.account_id`) and `accounts da` (left, on `t.to_account_id`), and neither `expense` nor `net` reference `budget_only`.
4. `import_card_statement` still has the duplicate-account-across-sections guard (the `if (select count(*) ... <> (select count(distinct ...` block), the checksum validation block (the `if (sec->>'previous_balance') is null ...` and `v_computed <> ... ` checks), and `fx_fallback` in both the transactions column list and its values (`coalesce((sec->>'fx_fallback')::boolean, false)`) — these come from three migrations after the one this task's comment used to cite, and dropping any of them silently reopens a previously-fixed data-integrity bug.
5. `import_card_statement`'s expense insert list includes `exclude_from_budget` as its last column, with `v_exclude` as the matching last value.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731130000_card_payment_default_and_cashflow.sql
git commit -m "feat(budgets): count card payments toward budget, redefine cashflow as real money out"
```

---

### Task 2: Migration B — remove `budget_only`

**Files:**
- Create: `supabase/migrations/20260731140000_remove_budget_only.sql`

**Interfaces:**
- Consumes: nothing from Task 1 (touches a disjoint set of functions/views).
- Produces: `account_balances`, `loan_status`, `recompute_card_balance` no longer reference `budget_only`; the column no longer exists on `transactions`.

- [ ] **Step 1: Write the migration**

```sql
-- budget_only ("counts toward budget only, not balance") has no real use —
-- nothing in this codebase or its data ever sets it true outside a test
-- fixture. Removing it end to end: every view/function below stops
-- special-casing it (equivalent to treating every row as budget_only=false,
-- which was already the default and, in practice, the only value that ever
-- existed), then the column is dropped. Functions must stop referencing the
-- column before it's dropped, so this migration does that first.

create or replace view public.account_balances
with (security_invoker = true) as
with movements as (
  select a.id as account_id,
         a.user_id,
         a.currency,
         a.starting_balance,
         -- own-currency net from transactions
         coalesce(sum(case
           when t.type = 'income'  and t.account_id = a.id then t.amount
           when t.type = 'expense' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.total_amount
           when t.type = 'payment' and t.to_account_id = a.id
             then coalesce(t.to_amount, t.amount)
           else 0 end), 0) as net_amount,
         -- base-currency net. The destination leg is worth the same in base as
         -- the source leg, so base_amount serves both; only tax/fee (which stay
         -- with the source) make the two sides differ.
         coalesce(sum(case
           when t.type = 'income'  and t.account_id = a.id then t.base_amount
           when t.type = 'expense' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.account_id = a.id then -t.base_total_amount
           when t.type = 'payment' and t.to_account_id = a.id then t.base_amount
           else 0 end), 0) as net_base_amount
  from public.accounts a
  left join public.transactions t
    on (t.account_id = a.id or t.to_account_id = a.id)
  -- loans and cards are represented solely by their *_status views
  where a.type not in ('credit_card', 'loan')
  group by a.id, a.user_id, a.currency, a.starting_balance
)
select account_id, user_id, currency,
       starting_balance,
       starting_balance + net_amount as balance,   -- own currency
       net_base_amount               as base_movement
from movements;

create or replace view public.loan_status
with (security_invoker = true) as
with recursive pay as (
  select t.to_account_id as account_id,
         coalesce(t.to_amount, t.amount) as amount,
         row_number() over (
           partition by t.to_account_id
           order by t.occurred_at, t.created_at, t.id
         ) as seq
  from public.transactions t
  join public.accounts la
    on la.id = t.to_account_id and la.type = 'loan'
  where t.type = 'payment'
),
-- One row per loan per payment applied: seq 0 is the loan at origination,
-- seq n the balance left after its nth payment.
run as (
  select a.id                                      as account_id,
         0::bigint                                 as seq,
         coalesce(a.principal, 0)::numeric         as balance,
         coalesce(a.interest_rate, 0)::numeric / 12 as monthly_rate,
         a.term_months                             as term_months
  from public.accounts a
  where a.type = 'loan'
  union all
  select run.account_id,
         pay.seq,
         case
           when run.term_months is not null and pay.seq >= run.term_months then 0
           else run.balance - least(
                  greatest(pay.amount - round(run.balance * run.monthly_rate, 2), 0),
                  run.balance)
         end,
         run.monthly_rate,
         run.term_months
  from run
  join pay on pay.account_id = run.account_id and pay.seq = run.seq + 1
),
amortized as (
  select distinct on (account_id) account_id, balance
  from run
  order by account_id, seq desc
)
select a.id as account_id,
       a.user_id,
       a.currency,
       a.principal,
       a.installment_amount,
       a.term_months,
       a.payment_due_day,
       round(coalesce(am.balance, a.principal, 0), 2) as outstanding_balance,
       coalesce(p.paid_count, 0)                      as installments_paid,
       a.original_term_months,
       coalesce(a.original_term_months, a.term_months) as progress_term_months,
       greatest(coalesce(a.original_term_months, a.term_months) - coalesce(a.term_months, 0), 0)
         + coalesce(p.paid_count, 0) as progress_installments_paid
from public.accounts a
left join amortized am on am.account_id = a.id
left join lateral (
  select count(*) as paid_count
  from public.transactions t
  where t.to_account_id = a.id and t.type = 'payment'
) p on true
where a.type = 'loan';

comment on view public.loan_status is
  'Per-loan status. outstanding_balance amortizes each logged payment (interest first, then principal) rather than subtracting the full installment, so it tracks the Balance column of the account page amortization schedule.';

create or replace function public.recompute_card_balance(p_account uuid)
returns void language plpgsql
set search_path = ''
as $$
declare
  anchor record;
begin
  select cs.total_balance, cs.period_end into anchor
  from public.card_statements cs
  where cs.account_id = p_account
  order by cs.period_end desc
  limit 1;
  if not found then return; end if;

  update public.accounts a
  set current_balance = anchor.total_balance - coalesce((
        select sum(coalesce(t.to_amount, t.amount))
        from public.transactions t
        where t.to_account_id = p_account
          and t.type = 'payment'
          and t.occurred_at::date > anchor.period_end
      ), 0)
  where a.id = p_account and a.type = 'credit_card';
end;
$$;

alter table public.transactions drop column budget_only;
```

- [ ] **Step 2: Read the file back and confirm two things**

1. Every redefined view/function body has zero occurrences of `budget_only`.
2. The `drop column` statement is the last statement in the file (after every function/view that used to reference it has been redefined).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731140000_remove_budget_only.sql
git commit -m "feat(transactions): drop the unused budget_only column"
```

---

### Task 3: Schema and server actions — drop `budget_only`

**Files:**
- Modify: `lib/transactions/schema.ts`
- Modify: `app/(app)/transactions/actions.ts`
- Modify: `app/(app)/subscriptions/actions.ts`

**Interfaces:**
- Produces: `transactionInput` (Zod schema) no longer has a `budget_only` field; `TransactionInput` type shrinks to match.

- [ ] **Step 1: Remove the field from the Zod schema**

In `lib/transactions/schema.ts`, delete this line (currently line 34):

```ts
    budget_only: z.boolean().default(false),
```

- [ ] **Step 2: Remove it from `toRow()`**

In `app/(app)/transactions/actions.ts`, delete this line from `toRow()` (currently line 39):

```ts
    budget_only: v.type === "expense" ? v.budget_only : false,
```

- [ ] **Step 3: Remove the hardcoded field from subscription-generated transactions**

In `app/(app)/subscriptions/actions.ts`, delete this line (currently line 149):

```ts
    budget_only: false,
```

- [ ] **Step 4: Verify the package still type-checks against the two callers**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/transactions/schema.ts`, `app/(app)/transactions/actions.ts`, or `app/(app)/subscriptions/actions.ts`. (Other files still referencing `budget_only` will still error at this point — later tasks fix those. If this step's three files themselves produce no errors, the step passes.)

- [ ] **Step 5: Commit**

```bash
git add lib/transactions/schema.ts "app/(app)/transactions/actions.ts" "app/(app)/subscriptions/actions.ts"
git commit -m "refactor(transactions): remove budget_only from schema and server actions"
```

---

### Task 4: Generated types — drop `budget_only`

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Remove `budget_only` from the `transactions` table's Row, Insert, and Update shapes**

Find the three occurrences (`budget_only: boolean` in the Row shape, `budget_only?: boolean` in Insert and Update — currently around lines 836, 865, 894) and delete each line. Leave `exclude_from_budget` untouched; it's a separate field.

- [ ] **Step 2: Verify**

Run: `grep -n "budget_only" lib/supabase/types.ts`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore(types): remove budget_only from hand-maintained Supabase types"
```

---

### Task 5: Transaction form — card expense default and card payment category

**Files:**
- Modify: `components/transactions/transaction-form.tsx`

**Interfaces:**
- Consumes: nothing new (uses the existing `exclude_from_budget` field already on `transactionInput`/`FormValues`).
- Produces: on create, `exclude_from_budget` defaults to `true` whenever `type === "expense"` and the selected account's `type === "credit_card"`; card payments (`type === "payment"` into a `credit_card` account) show and allow an optional category, matching how loan payments already behave.

- [ ] **Step 1: Remove `budget_only` from `FormValues` and its default-value wiring**

Delete the `budget_only: boolean;` line from the `FormValues` type (currently line 49).

Delete `budget_only: transaction.budget_only,` from the edit-mode `defaultValues` block (currently line 152).

Delete `budget_only: false,` from the create-mode `defaultValues` block (currently line 166).

- [ ] **Step 2: Remove the `budget_only` toggle from the form body**

Delete this whole block (currently lines 515–529):

```tsx
          {type === "expense" ? (
            <Controller
              control={control}
              name="budget_only"
              render={({ field }) => (
                <ToggleRow
                  id="budget_only"
                  label={t("budgetOnlyLabel")}
                  checked={field.value}
                  onChange={field.onChange}
                  disabled={fromStatement}
                />
              )}
            />
          ) : null}
```

- [ ] **Step 3: Remove the card-payment category lockout**

Delete this effect (currently lines 210–216):

```tsx
  // Payments into credit cards carry no category — the imported statement
  // lines hold the real spending categories; a categorized payment would
  // double-deduct the budget (spec §3.7).
  useEffect(() => {
    if (cardPayment) setValue("category_id", "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPayment]);
```

Change the category field's visibility condition (currently line 452) from:

```tsx
      {type !== "income" && !cardPayment ? (
```

to:

```tsx
      {type !== "income" ? (
```

Update the comment directly above it (currently `{/* Category (expense + payment, minus card payments — those carry no category) */}`) to:

```tsx
      {/* Category (expense + payment; income has none) */}
```

`cardPayment` (line 205, `const cardPayment = type === "payment" && dst?.type === "credit_card";`) stays — it still exists purely as a derived boolean, but is no longer read anywhere after this step. Remove the now-dead `const cardPayment = ...` declaration too, since nothing consumes it (check with the grep in Step 5 below before deleting, in case a later step in this same task reintroduces a use).

- [ ] **Step 4: Add the credit-card-expense default for `exclude_from_budget`**

In the existing smart-defaults effect (currently lines 233–238):

```tsx
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("include_tax", type === "payment" && dst?.type === "loan");
    setValue("include_commission", !sameBankPayment && !src.network_fee_optional);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);
```

add one line so it reads:

```tsx
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("include_tax", type === "payment" && dst?.type === "loan");
    setValue("include_commission", !sameBankPayment && !src.network_fee_optional);
    setValue("exclude_from_budget", type === "expense" && src.type === "credit_card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);
```

This only fires on account/type change while creating (same guard the tax/fee defaults already use), so a manual uncheck of "Exclude from budget" survives until the user changes the account or type again — identical behavior to how the tax/fee toggles already work in this form.

- [ ] **Step 5: Confirm `cardPayment` has no remaining reads before deleting its declaration**

Run: `grep -n "cardPayment" components/transactions/transaction-form.tsx`
Expected: zero matches once Steps 2–3 are applied. If any remain, leave the declaration in place and re-check which usage still needs it before removing.

- [ ] **Step 6: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no errors in `components/transactions/transaction-form.tsx`.

- [ ] **Step 7: Commit**

```bash
git add components/transactions/transaction-form.tsx
git commit -m "feat(transactions): default card expenses out of budget, allow a category on card payments"
```

---

### Task 6: Remove `budget_only` badge and balance-chart check

**Files:**
- Modify: `components/transactions/transaction-row.tsx`
- Modify: `components/accounts/balance-chart.tsx`

- [ ] **Step 1: Remove the badge**

In `components/transactions/transaction-row.tsx`, delete this block (currently lines 101–105):

```tsx
          {txn.budget_only ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("budgetOnlyBadge")}
            </span>
          ) : null}
```

Leave the `exclude_from_budget` badge directly below it untouched.

- [ ] **Step 2: Remove the balance-chart check**

In `components/accounts/balance-chart.tsx`, delete this line (currently line 14):

```ts
  if (txn.budget_only) return 0;
```

- [ ] **Step 3: Type-check both files**

Run: `npx tsc --noEmit`
Expected: no errors in either file. `balance-chart.tsx`'s `txn` is typed as `TransactionWithRefs` (`lib/transactions/queries.ts:31`), inferred entirely from a `select("*", ...)` against the `transactions` table — no local type to edit here; it loses `budget_only` automatically once Task 4 removes the field from `lib/supabase/types.ts`. This task removes the last *read* of `txn.budget_only`, so it type-checks regardless of whether Task 4 has landed yet (an unused field still present on the type is not an error). If Task 4 happens to land first, this task's Step 1/2 edits are what clear the resulting "Property 'budget_only' does not exist" errors.

- [ ] **Step 4: Commit**

```bash
git add components/transactions/transaction-row.tsx components/accounts/balance-chart.tsx
git commit -m "refactor(transactions): remove the budget_only badge and balance check"
```

---

### Task 7: Net worth history — remove `budget_only`

**Files:**
- Modify: `lib/insights/net-worth-history.ts`
- Test: `lib/insights/net-worth-history.test.ts`

**Interfaces:**
- Produces: `TxRow` no longer has `budget_only`; `accountMovement(tx, accountId)` no longer special-cases it (every row behaves as if `budget_only` were always `false`, its only real-world value).

- [ ] **Step 1: Update the failing test first**

In `lib/insights/net-worth-history.test.ts`:

Remove `budget_only: false,` from the `tx` fixture (currently line 18).

Replace this test (currently lines 61–64):

```ts
  it("ignores budget-only rows and unrelated accounts", () => {
    expect(accountMovement(tx({ budget_only: true }), "checking")).toBe(0);
    expect(accountMovement(tx(), "savings")).toBe(0);
  });
```

with:

```ts
  it("ignores unrelated accounts", () => {
    expect(accountMovement(tx(), "savings")).toBe(0);
  });
```

- [ ] **Step 2: Run the test to see it fail on the type, not the assertion**

Run: `npx vitest run lib/insights/net-worth-history.test.ts`
Expected: FAIL — `tx()`'s inferred type still requires `budget_only` (from `TxRow`) until Step 3 removes it, or `accountMovement` still reads a field the fixture no longer sets. Either way, the test file itself is not yet broken by a wrong assertion — this step exists to confirm the test change is exercised before the implementation catches up.

- [ ] **Step 3: Remove `budget_only` from `TxRow` and `accountMovement`**

In `lib/insights/net-worth-history.ts`, delete `budget_only: boolean;` from the `TxRow` type (currently line 62).

Delete this line from `accountMovement` (currently line 109):

```ts
  if (tx.budget_only) return 0;
```

- [ ] **Step 4: Remove the two `.select()`/`.eq()` filters that read it from the DB**

Around lines 274–301, in the `Promise.all` that loads `transactions`, `cardPayments`, and `loanPayments`:

Change the `transactions` select (currently line 277) from:

```ts
      .select("type,account_id,to_account_id,amount,to_amount,total_amount,budget_only,occurred_at")
```

to:

```ts
      .select("type,account_id,to_account_id,amount,to_amount,total_amount,occurred_at")
```

Remove `.eq("budget_only", false)` from the `cardPayments` query (currently line 284) and from the `loanPayments` query (currently line 293) — each becomes a plain `.eq("type", "payment")` followed directly by the next filter in its chain (`.in(...)`).

- [ ] **Step 5: Run the test again**

Run: `npx vitest run lib/insights/net-worth-history.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/insights/net-worth-history.ts` or its test.

- [ ] **Step 7: Commit**

```bash
git add lib/insights/net-worth-history.ts lib/insights/net-worth-history.test.ts
git commit -m "refactor(insights): remove budget_only from net worth history"
```

---

### Task 8: Insights and overview queries — remove `budget_only` filters

**Files:**
- Modify: `lib/insights/queries.ts`
- Modify: `lib/overview/queries.ts`

- [ ] **Step 1: Remove the pace-chart filter**

In `lib/insights/queries.ts`, in the `expenses` query inside `getInsights` (currently around line 61), delete:

```ts
      .eq("budget_only", false)
```

leaving `.eq("type", "expense")` followed directly by `.eq("exclude_from_budget", false)`.

- [ ] **Step 2: Remove the card-payment filter**

In `lib/overview/queries.ts`, in `statementPaymentsByCard` (currently around line 68), delete:

```ts
    .eq("budget_only", false)
```

leaving `.eq("type", "payment")` followed directly by `.in("to_account_id", ...)`.

- [ ] **Step 3: Type-check both files**

Run: `npx tsc --noEmit`
Expected: no errors in either file.

- [ ] **Step 4: Commit**

```bash
git add lib/insights/queries.ts lib/overview/queries.ts
git commit -m "refactor(insights): remove budget_only filter from pace chart and card-paid query"
```

---

### Task 9: i18n — remove `budgetOnly*` keys, add statement-import exclude copy

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Remove the now-unused keys**

In both files, delete `"budgetOnlyBadge": "..."` (Transactions section, currently line 337) and `"budgetOnlyLabel": "..."` (TransactionForm section, currently line 369).

- [ ] **Step 2: Add the statement-import checkbox copy**

In `messages/en.json`, in the `Statements` section, add two keys near `confirmButton` (currently line 261) — anywhere in that object is fine, e.g. directly after `confirmButton`:

```json
    "excludeFromBudgetLabel": "Exclude these expenses from budget",
    "excludeFromBudgetHint": "They'll still count toward the card balance and net worth — add the payment separately to track it against your budget.",
```

In `messages/es.json`, same section, same position:

```json
    "excludeFromBudgetLabel": "Excluir estos gastos del presupuesto",
    "excludeFromBudgetHint": "Seguirán contando para el saldo de la tarjeta y el patrimonio neto — agrega el pago por separado para reflejarlo en tu presupuesto.",
```

- [ ] **Step 3: Validate both files are still well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Confirm no remaining references to the removed keys**

Run: `grep -rn "budgetOnlyLabel\|budgetOnlyBadge" --include="*.ts" --include="*.tsx" .`
Expected: no output (Tasks 5 and 6 already removed the code that read them; this just double-checks).

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "chore(i18n): remove budget-only copy, add statement-import exclude-from-budget copy"
```

---

### Task 10: Statement import — exclude-from-budget checkbox

**Files:**
- Modify: `components/accounts/statements-panel.tsx`
- Modify: `app/(app)/accounts/statement-actions.ts`

**Interfaces:**
- Consumes: `import_card_statement`'s `p->>'exclude_from_budget'` handling from Task 1.
- Produces: `confirmStatementImport(formData)` now reads an `exclude_from_budget` field off the `FormData` it's called with (`"true"`/`"false"` string; treated as `true` when absent) and forwards it as a boolean on the RPC payload.

- [ ] **Step 1: Add the checkbox to the review panel**

In `components/accounts/statements-panel.tsx`, add `Switch` to the imports (alongside the other `@/components/ui/*` imports, currently lines 19–38):

```tsx
import { Switch } from "@/components/ui/switch";
```

Add state next to the other preview-related state (currently around line 65, near `const [mappings, setMappings] = useState<Record<string, string>>({});`):

```tsx
  const [excludeFromBudget, setExcludeFromBudget] = useState(true);
```

In `onConfirm` (currently lines 109–131), add the field to the `FormData` right after the existing `fd.set("mappings", ...)` call:

```tsx
    fd.set("exclude_from_budget", String(excludeFromBudget));
```

In the preview block, add the toggle directly above the `confirmButton`/`cancelButton` row (currently right before line 283's `<div className="flex gap-2">`):

```tsx
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
            <Label htmlFor="exclude_from_budget" className="font-normal text-muted-foreground">
              {t("excludeFromBudgetLabel")}
              <span className="ml-1.5 block text-xs">{t("excludeFromBudgetHint")}</span>
            </Label>
            <Switch
              id="exclude_from_budget"
              checked={excludeFromBudget}
              onCheckedChange={setExcludeFromBudget}
            />
          </div>
```

Reset it alongside the other preview state when the import completes or is cancelled: in `onConfirm`'s success branch (currently around lines 125–129) and in the cancel button's `onClick` (currently around lines 290–295), add `setExcludeFromBudget(true);` next to the existing `setPreview(null); setFile(null); ...` calls.

- [ ] **Step 2: Forward the field through `confirmStatementImport`**

In `app/(app)/accounts/statement-actions.ts`, inside `confirmStatementImport`, read the form field near the other `formData.get(...)` reads (currently around line 246–249):

```ts
  const excludeFromBudget = formData.get("exclude_from_budget") !== "false";
```

Add it to the `payload` object built for the RPC call (currently the object literal starting around line 302, `const payload = { parser_id: ..., ... }`) as a new top-level key, e.g. directly after `file_path: "",`:

```ts
    exclude_from_budget: excludeFromBudget,
```

- [ ] **Step 3: Run the existing statement-actions test**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`
Expected: PASS — the existing test doesn't set `exclude_from_budget` in its `FormData`, so it exercises the "absent → treated as `true`" branch and should still pass unchanged (the mocked `rpc` call accepts any payload).

- [ ] **Step 4: Type-check both files**

Run: `npx tsc --noEmit`
Expected: no errors in either file.

- [ ] **Step 5: Commit**

```bash
git add components/accounts/statements-panel.tsx "app/(app)/accounts/statement-actions.ts"
git commit -m "feat(statements): add exclude-from-budget checkbox to the import review panel"
```

---

### Task 11: Full verification and manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Confirm no stray `budget_only` references remain anywhere**

Run: `grep -rn "budget_only" --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.json" . | grep -v node_modules`
Expected: no output.

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Manual walkthrough (dev server)**

Start the dev server and, signed in with an account that has at least one credit card:

1. Create a new expense on the credit card account — confirm "Exclude from budget" is checked by default; uncheck it and save, then confirm it now counts in the Budgets page `used` figure for its category.
2. Import a statement onto that card with the new "Exclude these expenses from budget" checkbox left checked (default) — confirm the imported expenses do **not** move the Budgets page `used` figure. Re-import (or import a different period) with the checkbox unchecked — confirm they now do.
3. Create a payment from a checking account to the credit card — confirm the category field is visible and optional, pick a category, save, and confirm it shows up in that category's Budgets `used` figure and in the Insights donut.
4. On the dashboard, note the month's cashflow "expense" figure before and after logging a card payment — a card expense alone shouldn't move it; the payment should.
5. Create a transfer-like payment between two non-liability accounts (e.g. checking → savings) — confirm cashflow is unaffected.
6. Spot-check an existing credit card and loan account's balance/outstanding figures against what they showed before this branch (no `budget_only: true` rows exist in this environment's data, so these should be numerically unchanged).

- [ ] **Step 6: Report results**

Summarize pass/fail for each of Steps 1–5 above (this task has no code changes to commit — it's a checkpoint before considering the feature done).
