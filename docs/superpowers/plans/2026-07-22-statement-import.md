# Credit-Card Statement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual card reconciliation with statement-PDF import: deterministic per-bank parsers, checksum validation, anchor+drift balance, auto-categorized expense transactions, and cost-of-carry surfacing.

**Architecture:** Parsers in `lib/statements/` turn layout-preserved PDF text into `ParsedStatement` objects (money as integer cents), validated by an internal checksum. A stateless two-step server action flow (parse→preview, then re-parse→confirm) writes atomically through a Postgres RPC (`import_card_statement`) that replaces the period's statement, lines, and generated transactions, then recomputes the card balance as `latest statement total_balance − payments after period_end`. UI: a `StatementsPanel` on card pages replaces `ReconcilePanel`; insights gain a cost-of-carry section.

**Tech Stack:** Next.js 16 App Router (server actions), Supabase (Postgres + RLS + Storage), pdfjs-dist (Node, legacy build), vitest, zod, next-intl, react-hook-form.

**Spec:** `docs/superpowers/specs/2026-07-22-statement-import-design.md` — read it before starting any task.

## Global Constraints

- All user-facing strings via next-intl: add every key to BOTH `messages/en.json` and `messages/es.json`.
- Parser layer holds money as **integer cents** (`…Cents` fields); convert to decimal only in the RPC payload.
- Real bank statements are NEVER committed; test fixtures are synthetic text. `.gitignore` already has `*.pdf`.
- Checksum rule: any section failing `previous + Σlines == closing` (or totals for line-less sections) blocks the whole file; nothing is written.
- Payment lines are stored as `kind='payment'` audit lines but never generate transactions.
- `budget_only` is always false on imported transactions.
- Tests: vitest, colocated `*.test.ts` next to the lib file (existing convention). Run with `npx vitest run <path>`.
- DB migrations via `supabase/migrations/`; `npm run db:push` (confirm with the user first — it targets their linked project), then `npm run db:types` to regenerate `lib/supabase/types.ts`.
- Existing untouched invariants: `accounts.currency` immutable; `account_balances` excludes credit cards; expenses require a category.
- Work on a feature branch in a worktree (superpowers:using-git-worktrees). Per user memory: when finished and verified, merge to main and delete the branch without asking.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260722120000_statement_import.sql`
- Regenerate: `lib/supabase/types.ts` (via `npm run db:types`)

**Interfaces:**
- Produces tables `statement_imports`, `card_statement_lines`, `statement_section_mappings`, `category_rules`; extends `card_statements` and `transactions`; RPC `import_card_statement(p jsonb) returns uuid`; function `recompute_card_balance(uuid)`; view `card_cost_of_carry`; storage bucket `statements`; replaces `category_usage` and `transactions_sync_card_balance`.

- [ ] **Step 1: Write the migration**

```sql
-- Statement import: statements become the source of truth for card balances.
-- Spec: docs/superpowers/specs/2026-07-22-statement-import-design.md

-- 1) Line kind ------------------------------------------------------------
create type public.statement_line_kind as enum ('purchase','fee','credit','payment');

-- 2) statement_imports: one row per uploaded file -------------------------
create table public.statement_imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  parser_id     text not null,
  card_group_id uuid references public.card_groups (id) on delete set null,
  file_name     text not null,
  file_path     text,
  status        text not null default 'imported'
                check (status in ('imported','failed_detection','failed_validation')),
  error         text,
  created_at    timestamptz not null default now()
);
create index statement_imports_user_idx on public.statement_imports (user_id, created_at desc);

alter table public.statement_imports enable row level security;
create policy "statement_imports: owner read" on public.statement_imports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "statement_imports: owner insert" on public.statement_imports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "statement_imports: owner delete" on public.statement_imports
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3) card_statements: statement is now a full anchor ----------------------
alter table public.card_statements
  add column import_id              uuid references public.statement_imports (id) on delete set null,
  add column section_key            text,
  add column previous_balance       numeric(18,4),
  add column minimum_payment        numeric(18,4),
  add column overdue_amount         numeric(18,4),
  add column overdue_installments   integer,
  add column credit_limit           numeric(18,4),
  add column available_credit       numeric(18,4),
  add column interest_rate_annual   numeric(18,8),
  add column avg_daily_balance      numeric(18,4),
  add column avg_daily_balance_prior numeric(18,4),
  add column cost_of_carry          numeric(18,4),
  add column cost_of_carry_prior    numeric(18,4);

-- One statement per account per closing date; re-import replaces it.
create unique index card_statements_account_period_uidx
  on public.card_statements (account_id, period_end);

-- 4) card_statement_lines: raw parsed lines (audit trail) -----------------
create table public.card_statement_lines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  statement_id   uuid not null references public.card_statements (id) on delete cascade,
  account_id     uuid not null references public.accounts (id) on delete cascade,
  line_no        integer not null,
  made_on        date not null,
  posted_on      date not null,
  reference      text,
  description    text not null,
  mcc            text,
  auth_code      text,
  amount         numeric(18,4) not null,   -- negative = credit
  kind           public.statement_line_kind not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (statement_id, line_no)
);
create index card_statement_lines_statement_idx on public.card_statement_lines (statement_id);
create index card_statement_lines_account_idx on public.card_statement_lines (account_id);

alter table public.card_statement_lines enable row level security;
create policy "card_statement_lines: owner read" on public.card_statement_lines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner insert" on public.card_statement_lines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner update" on public.card_statement_lines
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "card_statement_lines: owner delete" on public.card_statement_lines
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 5) transactions: statement linkage + relaxed amount sign ----------------
alter table public.transactions
  add column statement_line_id uuid references public.card_statement_lines (id) on delete cascade;
create index transactions_statement_line_idx on public.transactions (statement_line_id);

-- Refunds/rebates import as negative expenses; only statement-sourced rows may be negative.
alter table public.transactions drop constraint transactions_amount_check;
alter table public.transactions
  add constraint transactions_amount_check
  check (amount >= 0 or statement_line_id is not null);

-- 6) statement_section_mappings: learned section → account routing --------
create table public.statement_section_mappings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  parser_id     text not null,
  card_group_id uuid not null references public.card_groups (id) on delete cascade,
  section_key   text not null,
  account_id    uuid not null references public.accounts (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, parser_id, card_group_id, section_key)
);
alter table public.statement_section_mappings enable row level security;
create policy "section_mappings: owner read" on public.statement_section_mappings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "section_mappings: owner insert" on public.statement_section_mappings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "section_mappings: owner update" on public.statement_section_mappings
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "section_mappings: owner delete" on public.statement_section_mappings
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger section_mappings_set_updated_at before update on public.statement_section_mappings
  for each row execute function public.set_updated_at();

-- 7) category_rules: user-owned MCC/merchant → category ------------------
create table public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  rule_type   text not null check (rule_type in ('mcc','merchant')),
  pattern     text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  priority    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, rule_type, pattern)
);
alter table public.category_rules enable row level security;
create policy "category_rules: owner read" on public.category_rules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "category_rules: owner insert" on public.category_rules
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "category_rules: owner update" on public.category_rules
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "category_rules: owner delete" on public.category_rules
  for delete to authenticated using ((select auth.uid()) = user_id);
create trigger category_rules_set_updated_at before update on public.category_rules
  for each row execute function public.set_updated_at();

-- 8) Anchor + drift balance ----------------------------------------------
-- current_balance = latest statement total_balance
--                 − Σ payments to the card dated after that statement's period_end.
-- No statement → no-op (legacy incremental behavior still applies).
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
          and not t.budget_only
          and t.occurred_at::date > anchor.period_end
      ), 0)
  where a.id = p_account and a.type = 'credit_card';
end;
$$;

-- Payments: anchored cards recompute (idempotent); anchor-less cards keep
-- the incremental adjustment they had before this migration.
create or replace function public.transactions_sync_card_balance()
returns trigger language plpgsql
set search_path = ''
as $$
declare
  v_card uuid;
begin
  if tg_op in ('DELETE','UPDATE') and old.type = 'payment' and old.to_account_id is not null then
    select id into v_card from public.accounts
      where id = old.to_account_id and type = 'credit_card';
    if v_card is not null then
      if exists (select 1 from public.card_statements where account_id = v_card) then
        perform public.recompute_card_balance(v_card);
      else
        update public.accounts
        set current_balance = current_balance + coalesce(old.to_amount, old.amount)
        where id = v_card;
      end if;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.type = 'payment' and new.to_account_id is not null then
    select id into v_card from public.accounts
      where id = new.to_account_id and type = 'credit_card';
    if v_card is not null then
      if exists (select 1 from public.card_statements where account_id = v_card) then
        perform public.recompute_card_balance(v_card);
      else
        update public.accounts
        set current_balance = current_balance - coalesce(new.to_amount, new.amount)
        where id = v_card;
      end if;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Statements are anchors: any change recomputes the account.
create or replace function public.card_statements_recompute()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  perform public.recompute_card_balance(coalesce(new.account_id, old.account_id));
  return coalesce(new, old);
end;
$$;
create trigger card_statements_recompute_balance
  after insert or update or delete on public.card_statements
  for each row execute function public.card_statements_recompute();

-- 9) Budgets: card payments stop counting (statement lines carry the real
-- categories now; counting both would double-deduct). Loans stay budgetable.
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
      and not (t.type = 'payment' and exists (
        select 1 from public.accounts ca
        where ca.id = t.to_account_id and ca.type = 'credit_card'))
      and date_trunc('month', t.occurred_at)::date = m.month
    group by t.category_id
  ) u on u.category_id = c.id
  where c.user_id = (select auth.uid());
$$;

-- 10) Cost of carry: latest statement per credit line ---------------------
create view public.card_cost_of_carry
with (security_invoker = true) as
select a.id   as account_id,
       a.user_id,
       a.name,
       a.currency,
       g.name as group_name,
       s.period_end,
       s.interest_rate_annual,
       s.avg_daily_balance,
       s.cost_of_carry,
       s.cost_of_carry_prior
from public.accounts a
left join public.card_groups g on g.id = a.card_group_id
join lateral (
  select * from public.card_statements cs
  where cs.account_id = a.id
  order by cs.period_end desc
  limit 1
) s on true
where a.type = 'credit_card';

-- 11) Private storage for the original PDFs -------------------------------
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "statements bucket: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'statements'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "statements bucket: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'statements'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "statements bucket: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'statements'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 12) Atomic import -------------------------------------------------------
-- One call per confirmed upload. Replaces same-period statements, writes
-- lines, generates expense transactions (payments excluded), recomputes.
-- All rows are owner-scoped; RLS also applies (security invoker).
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
begin
  if v_user is null then
    raise exception 'not authenticated';
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
        insert into public.transactions (
          user_id, type, account_id, category_id, amount, currency, exchange_rate,
          occurred_at, description, statement_line_id
        ) values (
          v_user, 'expense', v_account, (ln->>'category_id')::uuid,
          (ln->>'amount')::numeric, v_currency,
          coalesce(nullif(sec->>'exchange_rate','')::numeric, 1),
          (ln->>'made_on')::timestamptz, ln->>'description', v_line
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

- [ ] **Step 2: Push and regenerate types**

Ask the user to confirm before pushing (their linked Supabase project), then:

Run: `npm run db:push`
Expected: `Applying migration 20260722120000_statement_import.sql... Finished.`

Run: `npm run db:types`
Expected: `lib/supabase/types.ts` regenerated; `git diff --stat lib/supabase/types.ts` shows the new tables/columns (`statement_imports`, `card_statement_lines`, `statement_section_mappings`, `category_rules`, `statement_line_id`, `cost_of_carry`, …).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors (pre-existing errors, if any, are unchanged).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722120000_statement_import.sql lib/supabase/types.ts
git commit -m "feat(db): statement-import schema, anchor+drift balance, atomic import RPC"
```

---

### Task 2: Statement domain types, money parsing, checksum validation

**Files:**
- Create: `lib/statements/types.ts`
- Create: `lib/statements/money.ts`
- Create: `lib/statements/validate.ts`
- Test: `lib/statements/money.test.ts`, `lib/statements/validate.test.ts`

**Interfaces:**
- Produces (used by every later task):

```ts
// lib/statements/types.ts
export type LineKind = "purchase" | "fee" | "credit" | "payment";

export interface ParsedLine {
  lineNo: number;
  madeOn: string;   // ISO date (yyyy-mm-dd) — the date the user made the transaction
  postedOn: string; // ISO date — bank posting date
  reference: string | null;
  description: string;
  mcc: string | null;
  authCode: string | null;
  amountCents: number; // negative = credit
  kind: LineKind;
}

export interface ParsedSection {
  sectionKey: string;      // stable per parser: "DOP" | "USD" | "CUOTAS_DOP" | ...
  currency: string;        // ISO 4217
  periodStart: string;     // ISO date
  periodEnd: string;       // ISO date (fecha de corte) — the anchor date
  dueDate: string | null;
  previousBalanceCents: number;
  totalDebitsCents: number;   // Σ positive line amounts (or stated total when no lines)
  totalCreditsCents: number;  // Σ |negative| line amounts (or stated total)
  closingBalanceCents: number;   // BALANCE TOTAL / BALANCE AL CORTE — the anchor value
  balanceToPayCents: number;     // BALANCE A PAGAR (equals closing when absent)
  minimumPaymentCents: number | null;
  overdueAmountCents: number | null;
  overdueInstallments: number | null;
  creditLimitCents: number | null;
  availableCreditCents: number | null;
  interestRateAnnual: number | null;      // percent, e.g. 40 or 60
  avgDailyBalanceCents: number | null;
  avgDailyBalancePriorCents: number | null;
  costOfCarryCents: number | null;
  costOfCarryPriorCents: number | null;
  lines: ParsedLine[];
}

export interface ParsedStatement {
  parserId: string;
  cardLast4: string | null;
  sections: ParsedSection[];
}

export interface StatementParser {
  id: string;
  detect(text: string): boolean;
  parse(text: string): ParsedStatement;
}
```

```ts
// lib/statements/money.ts
export function parseMoneyCents(raw: string): number; // "  -1,234.56." → -123456
export function centsToDecimal(cents: number): string; // -123456 → "-1234.56"
```

```ts
// lib/statements/validate.ts
export interface ChecksumFailure {
  sectionKey: string;
  computedCents: number;
  statedCents: number;
}
export function validateChecksums(parsed: ParsedStatement): ChecksumFailure[];
```

- [ ] **Step 1: Write failing tests**

`lib/statements/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMoneyCents, centsToDecimal } from "./money";

describe("parseMoneyCents", () => {
  it("parses plain amounts", () => {
    expect(parseMoneyCents("3,388.00")).toBe(338800);
  });
  it("parses negatives", () => {
    expect(parseMoneyCents("-19,765.46")).toBe(-1976546);
  });
  it("tolerates the Scotia trailing dot and surrounding spaces", () => {
    expect(parseMoneyCents("  1,300.00.  ")).toBe(130000);
    expect(parseMoneyCents("-4,000.00.")).toBe(-400000);
  });
  it("parses amounts without thousands separators", () => {
    expect(parseMoneyCents("62.00")).toBe(6200);
  });
});

describe("centsToDecimal", () => {
  it("renders with two decimals and sign", () => {
    expect(centsToDecimal(338800)).toBe("3388.00");
    expect(centsToDecimal(-1976546)).toBe("-19765.46");
    expect(centsToDecimal(0)).toBe("0.00");
  });
});
```

`lib/statements/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateChecksums } from "./validate";
import type { ParsedSection, ParsedStatement } from "./types";

function section(over: Partial<ParsedSection>): ParsedSection {
  return {
    sectionKey: "DOP",
    currency: "DOP",
    periodStart: "2026-05-26",
    periodEnd: "2026-06-25",
    dueDate: null,
    previousBalanceCents: 100000,
    totalDebitsCents: 0,
    totalCreditsCents: 0,
    closingBalanceCents: 100000,
    balanceToPayCents: 100000,
    minimumPaymentCents: null,
    overdueAmountCents: null,
    overdueInstallments: null,
    creditLimitCents: null,
    availableCreditCents: null,
    interestRateAnnual: null,
    avgDailyBalanceCents: null,
    avgDailyBalancePriorCents: null,
    costOfCarryCents: null,
    costOfCarryPriorCents: null,
    lines: [],
    ...over,
  };
}
const stmt = (...sections: ParsedSection[]): ParsedStatement => ({
  parserId: "test",
  cardLast4: "0000",
  sections,
});
const line = (amountCents: number, lineNo: number) => ({
  lineNo,
  madeOn: "2026-06-01",
  postedOn: "2026-06-02",
  reference: null,
  description: "X",
  mcc: null,
  authCode: null,
  amountCents,
  kind: amountCents < 0 ? ("payment" as const) : ("purchase" as const),
});

describe("validateChecksums", () => {
  it("passes when previous + lines == closing (payments included)", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1), line(-20000, 2)],
      closingBalanceCents: 130000,
    });
    expect(validateChecksums(stmt(s))).toEqual([]);
  });
  it("fails with computed vs stated when the sum is off", () => {
    const s = section({
      previousBalanceCents: 100000,
      lines: [line(50000, 1)],
      closingBalanceCents: 140000,
    });
    expect(validateChecksums(stmt(s))).toEqual([
      { sectionKey: "DOP", computedCents: 150000, statedCents: 140000 },
    ]);
  });
  it("uses stated totals for line-less sections (Cuotas)", () => {
    const ok = section({
      sectionKey: "CUOTAS_DOP",
      previousBalanceCents: 0,
      totalDebitsCents: 0,
      totalCreditsCents: 0,
      closingBalanceCents: 0,
      lines: [],
    });
    const bad = section({
      sectionKey: "CUOTAS_DOP",
      previousBalanceCents: 0,
      totalDebitsCents: 5000,
      totalCreditsCents: 0,
      closingBalanceCents: 0,
      lines: [],
    });
    expect(validateChecksums(stmt(ok))).toEqual([]);
    expect(validateChecksums(stmt(bad))).toEqual([
      { sectionKey: "CUOTAS_DOP", computedCents: 5000, statedCents: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/statements`
Expected: FAIL — cannot resolve `./money`, `./validate`.

- [ ] **Step 3: Implement**

`lib/statements/types.ts`: exactly the interfaces from the block above (no logic).

`lib/statements/money.ts`:

```ts
/** Statement money is held as integer cents: statements carry their own
 *  checksum and float drift would produce false validation failures. */
export function parseMoneyCents(raw: string): number {
  const cleaned = raw.trim().replace(/\.$/, "").replace(/,/g, "");
  const m = cleaned.match(/^(-?)(\d+)\.(\d{2})$/);
  if (!m) throw new Error(`unparseable amount: "${raw}"`);
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 100 + Number(m[3]));
}

export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
```

`lib/statements/validate.ts`:

```ts
import type { ParsedStatement } from "./types";

export interface ChecksumFailure {
  sectionKey: string;
  computedCents: number;
  statedCents: number;
}

/** previous + Σ(all lines, payments included) must equal the closing balance.
 *  Line-less sections (e.g. Cuotas) fall back to the stated totals. */
export function validateChecksums(parsed: ParsedStatement): ChecksumFailure[] {
  const failures: ChecksumFailure[] = [];
  for (const s of parsed.sections) {
    const movement =
      s.lines.length > 0
        ? s.lines.reduce((sum, l) => sum + l.amountCents, 0)
        : s.totalDebitsCents - s.totalCreditsCents;
    const computed = s.previousBalanceCents + movement;
    if (computed !== s.closingBalanceCents) {
      failures.push({
        sectionKey: s.sectionKey,
        computedCents: computed,
        statedCents: s.closingBalanceCents,
      });
    }
  }
  return failures;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/statements`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/statements/types.ts lib/statements/money.ts lib/statements/validate.ts lib/statements/money.test.ts lib/statements/validate.test.ts
git commit -m "feat(statements): domain types, cents money parsing, checksum validation"
```

---

### Task 3: Banco Popular VISA parser

**Files:**
- Create: `lib/statements/dates.ts`
- Create: `lib/statements/parsers/popular-visa.ts`
- Create: `lib/statements/fixtures/popular-visa.ts` (synthetic fixture text)
- Test: `lib/statements/dates.test.ts`, `lib/statements/parsers/popular-visa.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `money.ts` (Task 2).
- Produces:

```ts
// lib/statements/dates.ts
/** dd/mm with the year inferred from the cutoff date (statement period_end).
 *  A month later than the cutoff's month belongs to the previous year. */
export function inferYear(ddmm: string, cutoffIso: string): string; // "28/05" + "2026-06-25" → "2026-05-28"
export function ddmmyyyyToIso(s: string): string; // "25/06/2026" or "15-07-2026" → "2026-06-25"
export function monthBeforePlusDay(cutoffIso: string): string; // "2026-06-25" → "2026-05-26"

// lib/statements/parsers/popular-visa.ts
export const popularVisa: StatementParser; // id: "popular_visa"
```

**Format notes (from the real statement — verified tying to the cent):**
- Fingerprint: `RNC 101010632` and `Banco Popular Dominicano`.
- Header value line: `****-****-****-5850   50,000.00   12,007.92   25/06/2026   20/07/2026   19,765.46` → last4, credit limit, available credit, fecha de corte (period end), due date, previous balance. Repeats every page — parse first occurrence only.
- Transaction line: `  25/06   25/06   0622199159   Rebate VISA ISI      -1,623.00` → entry date (posted), transaction date (made), reference, description (internal runs of 2+ spaces collapse to one), amount. Next line may be an MCC continuation: `  5812   045602` (4-digit MCC + 6-digit auth).
- Footer line after the `CUOTAS VENCIDAS` block: `0   0.00   1,541.46   37,992.08   37,992.08` → overdue installments, overdue amount, minimum payment, balance a pagar, balance total (closing). Repeats per page — first occurrence.
- Interest block: `Tasa de Interés Anual....: 40.00 %`, `Saldo Promedio Diario de los Consumos del Mes  29,384.70`, `Interés si Opta Por Financiar los Consumos del Mes  979.49`, `Saldo Promedio Diario del Capital Pendiente de Meses Anteriores  0.00`, `Interés por Financiamiento del Capital Pendiente de Meses Anteriores  0.00`.
- Dates are `dd/mm` with NO year → `inferYear` with the cutoff. Currency is always DOP. Single section, key `"DOP"`.
- Line kinds: amount < 0 and description starts with `Pago` (case-insensitive) → `payment`; other amount < 0 → `credit`; description starts with `CARGO` → `fee`; else `purchase`.
- `totalDebitsCents`/`totalCreditsCents` are computed from the lines (the statement prints no totals row).
- `periodStart` = `monthBeforePlusDay(periodEnd)`.

- [ ] **Step 1: Write the synthetic fixture**

`lib/statements/fixtures/popular-visa.ts` — two exports. Amounts are chosen so the checksum ties: 1,000.00 + (500.00 + 100.00 + 75.50 − 200.00 − 50.00) = 1,425.50.

```ts
/** Synthetic replica of the Banco Popular VISA layout (fake data, real shape). */
export const POPULAR_FIXTURE = `
                                                                    ESTADO DE CUENTA
                       LÍNEA DE             CRÉDITO                  FECHA LÍMITE       BALANCE
 VISA TEST
                       CRÉDITO              DISPONIBLE   FECHA DE CORTE   DE PAGO       ANTERIOR
 ****-****-****-1234                     10,000.00      8,574.50        25/06/2026     20/07/2026       1,000.00

       FECHAS DE
                  NO. DE REFERENCIA        CARGOS, PAGOS, CRÉDITOS Y AJUSTES ANTERIORES        CANTIDAD
  ENTRADA    TRANSAC.

  28/05         26/05   74763946147620851045422            MERCADO UNO                    CIUDAD FALSA           500.00
                                                           5411   045602
  01/06         30/05   74589056150016437936842            GASOLINERA DOS                 CIUDAD FALSA           100.00
                                                           5541   082832
  05/06         03/06   0613554270                         Pago via SPE                                         -200.00

  10/06         09/06   74763946155622940137862            RESTAURANTE TRES               CIUDAD FALSA            75.50
                                                           5812   013148
  25/06         25/06   0622199159                         Rebate VISA TEST                                      -50.00

                              UNA CANTIDAD CON EL SIGNO (-) DE MENOS ES UN CRÉDITO.

     CUOTAS
                         MONTO VENCIDO       PAGO MÍNIMO        BALANCE A PAGAR       BALANCE TOTAL
     VENCIDAS
      0                       0.00              142.55              1,425.50             1,425.50

                             Tasa de Interés Anual....: 40.00 %

                             Saldo Promedio Diario de los Consumos del Mes                    1,200.00
                             Interés si Opta Por Financiar los Consumos del Mes                  40.00

                             Saldo Promedio Diario del Capital Pendiente de Meses Anteriores        0.00
                             Interés por Financiamiento del Capital Pendiente de Meses Anteriores   0.00

                              Banco Popular Dominicano, S. A. - Banco Múltiple      Tel. 809-544-5000
                              Av. Falsa #1                                          RNC 101010632
`;

/** December→January wrap: cutoff 10/01/2027, transactions from late December. */
export const POPULAR_WRAP_FIXTURE = `
 VISA TEST
 ****-****-****-1234                     10,000.00      9,700.00        10/01/2027     05/02/2027         0.00

  28/12         27/12   74763946147620851099999            MERCADO UNO                    CIUDAD FALSA           300.00
                                                           5411   045603

     CUOTAS
                         MONTO VENCIDO       PAGO MÍNIMO        BALANCE A PAGAR       BALANCE TOTAL
     VENCIDAS
      0                       0.00               30.00                300.00               300.00

                              Banco Popular Dominicano, S. A. - Banco Múltiple      Tel. 809-544-5000
                              RNC 101010632
`;
```

- [ ] **Step 2: Write failing tests**

`lib/statements/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { inferYear, ddmmyyyyToIso, monthBeforePlusDay } from "./dates";

describe("inferYear", () => {
  it("uses the cutoff year for same-or-earlier months", () => {
    expect(inferYear("28/05", "2026-06-25")).toBe("2026-05-28");
    expect(inferYear("25/06", "2026-06-25")).toBe("2026-06-25");
  });
  it("rolls back a year when the month is after the cutoff month", () => {
    expect(inferYear("28/12", "2027-01-10")).toBe("2026-12-28");
  });
});

describe("ddmmyyyyToIso", () => {
  it("parses slash and dash forms", () => {
    expect(ddmmyyyyToIso("25/06/2026")).toBe("2026-06-25");
    expect(ddmmyyyyToIso("15-07-2026")).toBe("2026-07-15");
  });
});

describe("monthBeforePlusDay", () => {
  it("computes the day after the previous cutoff", () => {
    expect(monthBeforePlusDay("2026-06-25")).toBe("2026-05-26");
    expect(monthBeforePlusDay("2027-01-10")).toBe("2026-12-11");
  });
});
```

`lib/statements/parsers/popular-visa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { popularVisa } from "./popular-visa";
import { POPULAR_FIXTURE, POPULAR_WRAP_FIXTURE } from "../fixtures/popular-visa";
import { validateChecksums } from "../validate";

describe("popularVisa.detect", () => {
  it("recognizes the RNC fingerprint", () => {
    expect(popularVisa.detect(POPULAR_FIXTURE)).toBe(true);
    expect(popularVisa.detect("some other bank RNC 999")).toBe(false);
  });
});

describe("popularVisa.parse", () => {
  const parsed = popularVisa.parse(POPULAR_FIXTURE);
  const s = parsed.sections[0];

  it("emits a single DOP section with header fields", () => {
    expect(parsed.parserId).toBe("popular_visa");
    expect(parsed.cardLast4).toBe("1234");
    expect(parsed.sections).toHaveLength(1);
    expect(s.sectionKey).toBe("DOP");
    expect(s.currency).toBe("DOP");
    expect(s.periodEnd).toBe("2026-06-25");
    expect(s.periodStart).toBe("2026-05-26");
    expect(s.dueDate).toBe("2026-07-20");
    expect(s.previousBalanceCents).toBe(100000);
    expect(s.creditLimitCents).toBe(1000000);
    expect(s.availableCreditCents).toBe(857450);
  });

  it("parses all five lines with kinds, MCC, and inferred years", () => {
    expect(s.lines).toHaveLength(5);
    const [mercado, gas, pago, resto, rebate] = s.lines;
    expect(mercado).toMatchObject({
      madeOn: "2026-05-26", postedOn: "2026-05-28",
      reference: "74763946147620851045422",
      mcc: "5411", authCode: "045602",
      amountCents: 50000, kind: "purchase",
    });
    expect(mercado.description).toBe("MERCADO UNO CIUDAD FALSA");
    expect(gas.kind).toBe("purchase");
    expect(pago).toMatchObject({ amountCents: -20000, kind: "payment", mcc: null });
    expect(resto.amountCents).toBe(7550);
    expect(rebate).toMatchObject({ amountCents: -5000, kind: "credit" });
  });

  it("reads footer totals and cost of carry", () => {
    expect(s.closingBalanceCents).toBe(142550);
    expect(s.balanceToPayCents).toBe(142550);
    expect(s.minimumPaymentCents).toBe(14255);
    expect(s.overdueAmountCents).toBe(0);
    expect(s.overdueInstallments).toBe(0);
    expect(s.interestRateAnnual).toBe(40);
    expect(s.avgDailyBalanceCents).toBe(120000);
    expect(s.costOfCarryCents).toBe(4000);
    expect(s.avgDailyBalancePriorCents).toBe(0);
    expect(s.costOfCarryPriorCents).toBe(0);
  });

  it("computes totals from lines and passes the checksum", () => {
    expect(s.totalDebitsCents).toBe(67550);
    expect(s.totalCreditsCents).toBe(25000);
    expect(validateChecksums(parsed)).toEqual([]);
  });

  it("handles the December→January year wrap", () => {
    const wrap = popularVisa.parse(POPULAR_WRAP_FIXTURE);
    const line = wrap.sections[0].lines[0];
    expect(wrap.sections[0].periodEnd).toBe("2027-01-10");
    expect(line.madeOn).toBe("2026-12-27");
    expect(line.postedOn).toBe("2026-12-28");
  });

  it("does not duplicate lines when pages repeat headers/footers", () => {
    const doubled = popularVisa.parse(POPULAR_FIXTURE + POPULAR_FIXTURE);
    // header/footer parse first-occurrence; lines dedupe by reference+amount+dates
    expect(doubled.sections[0].lines).toHaveLength(5);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/statements`
Expected: FAIL — `./dates`, `./popular-visa` unresolved.

- [ ] **Step 4: Implement**

`lib/statements/dates.ts`:

```ts
export function ddmmyyyyToIso(s: string): string {
  const m = s.trim().match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!m) throw new Error(`unparseable date: "${s}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function inferYear(ddmm: string, cutoffIso: string): string {
  const m = ddmm.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!m) throw new Error(`unparseable dd/mm date: "${ddmm}"`);
  const [, dd, mm] = m;
  const cutYear = Number(cutoffIso.slice(0, 4));
  const cutMonth = Number(cutoffIso.slice(5, 7));
  const year = Number(mm) > cutMonth ? cutYear - 1 : cutYear;
  return `${year}-${mm}-${dd}`;
}

export function monthBeforePlusDay(cutoffIso: string): string {
  const d = new Date(`${cutoffIso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
```

`lib/statements/parsers/popular-visa.ts`:

```ts
import type { ParsedLine, ParsedStatement, StatementParser } from "../types";
import { parseMoneyCents } from "../money";
import { ddmmyyyyToIso, inferYear, monthBeforePlusDay } from "../dates";

const HEADER =
  /^\s*\*{4}-\*{4}-\*{4}-(\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(-?[\d,]+\.\d{2})\s*$/;
const TXN =
  /^\s*(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d+)\s+(.+?)\s{2,}(-?[\d,]+\.\d{2})\s*$/;
const CONT = /^\s*(\d{4})\s+(\d{6})\s*$/;
const FOOTER =
  /^\s*(\d+)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const money = (label: RegExp, text: string): number | null => {
  const m = text.match(label);
  return m ? parseMoneyCents(m[1]) : null;
};

export const popularVisa: StatementParser = {
  id: "popular_visa",

  detect(text) {
    return /RNC\s*101010632/.test(text) || /Banco Popular Dominicano/i.test(text);
  },

  parse(text) {
    const lines = text.split("\n");

    const headerLine = lines.find((l) => HEADER.test(l));
    const header = headerLine?.match(HEADER);
    if (!header) throw new Error("popular_visa: header line not found");
    const [, last4, limit, available, cutoff, due, previous] = header;
    const periodEnd = ddmmyyyyToIso(cutoff);

    // Footer appears on every page; the first is authoritative. It follows
    // the CUOTAS VENCIDAS heading, which keeps it unambiguous vs. other rows.
    let footer: RegExpMatchArray | null = null;
    for (let i = 0; i < lines.length && !footer; i++) {
      if (/VENCIDAS/.test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const m = lines[j].match(FOOTER);
          if (m) { footer = m; break; }
        }
      }
    }
    if (!footer) throw new Error("popular_visa: totals footer not found");

    const parsedLines: ParsedLine[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(TXN);
      if (!m) continue;
      const [, posted, made, reference, rawDesc, rawAmount] = m;
      const key = `${reference}|${rawAmount}|${posted}|${made}`;
      if (seen.has(key)) continue; // page overlap safety
      seen.add(key);

      const cont = i + 1 < lines.length ? lines[i + 1].match(CONT) : null;
      const amountCents = parseMoneyCents(rawAmount);
      const description = rawDesc.trim().replace(/\s{2,}/g, " ");
      parsedLines.push({
        lineNo: parsedLines.length + 1,
        madeOn: inferYear(made, periodEnd),
        postedOn: inferYear(posted, periodEnd),
        reference,
        description,
        mcc: cont ? cont[1] : null,
        authCode: cont ? cont[2] : null,
        amountCents,
        kind:
          amountCents < 0
            ? /^pago/i.test(description) ? "payment" : "credit"
            : /^CARGO/.test(description) ? "fee" : "purchase",
      });
    }

    const totalDebitsCents = parsedLines
      .filter((l) => l.amountCents > 0)
      .reduce((s, l) => s + l.amountCents, 0);
    const totalCreditsCents = parsedLines
      .filter((l) => l.amountCents < 0)
      .reduce((s, l) => s - l.amountCents, 0);

    return {
      parserId: "popular_visa",
      cardLast4: last4,
      sections: [
        {
          sectionKey: "DOP",
          currency: "DOP",
          periodStart: monthBeforePlusDay(periodEnd),
          periodEnd,
          dueDate: ddmmyyyyToIso(due),
          previousBalanceCents: parseMoneyCents(previous),
          totalDebitsCents,
          totalCreditsCents,
          closingBalanceCents: parseMoneyCents(footer[5]),
          balanceToPayCents: parseMoneyCents(footer[4]),
          minimumPaymentCents: parseMoneyCents(footer[3]),
          overdueAmountCents: parseMoneyCents(footer[2]),
          overdueInstallments: Number(footer[1]),
          creditLimitCents: parseMoneyCents(limit),
          availableCreditCents: parseMoneyCents(available),
          interestRateAnnual: (() => {
            const m = text.match(/Tasa de Inter[eé]s Anual\.*:?\s*([\d.]+)\s*%/);
            return m ? Number(m[1]) : null;
          })(),
          avgDailyBalanceCents: money(
            /Saldo Promedio Diario de los Consumos del Mes\s+(-?[\d,]+\.\d{2})/, text),
          avgDailyBalancePriorCents: money(
            /Saldo Promedio Diario del Capital Pendiente de Meses Anteriores\s+(-?[\d,]+\.\d{2})/, text),
          costOfCarryCents: money(
            /Inter[eé]s si Opta Por Financiar los Consumos del Mes\s+(-?[\d,]+\.\d{2})/, text),
          costOfCarryPriorCents: money(
            /Inter[eé]s por Financiamiento del Capital Pendiente de Meses Anteriores\s+(-?[\d,]+\.\d{2})/, text),
          lines: parsedLines,
        },
      ],
    } satisfies ParsedStatement;
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/statements`
Expected: PASS. If a fixture regex mismatches, fix the PARSER (regexes must tolerate variable column spacing — `\s+` between fields, `\s{2,}` only before the amount), not the assertion values.

- [ ] **Step 6: Commit**

```bash
git add lib/statements/dates.ts lib/statements/dates.test.ts lib/statements/parsers/popular-visa.ts lib/statements/parsers/popular-visa.test.ts lib/statements/fixtures/popular-visa.ts
git commit -m "feat(statements): Banco Popular VISA parser with synthetic fixtures"
```

---

### Task 4: Scotiabank AMEX parser + registry

**Files:**
- Create: `lib/statements/parsers/scotia-amex.ts`
- Create: `lib/statements/fixtures/scotia-amex.ts`
- Create: `lib/statements/registry.ts`
- Test: `lib/statements/parsers/scotia-amex.test.ts`, `lib/statements/registry.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3 (`types.ts`, `money.ts`, `dates.ts`, `popularVisa`).
- Produces:

```ts
// lib/statements/parsers/scotia-amex.ts
export const scotiaAmex: StatementParser; // id: "scotia_amex"

// lib/statements/registry.ts
export const parsers: StatementParser[];               // [popularVisa, scotiaAmex]
export function detectParser(text: string): StatementParser | null;
```

**Format notes (from the real statement — verified tying to the cent):**
- Fingerprint: `RNC 101-04359-8` or `Scotiabank República Dominicana`.
- Card: `***********6760` → last4 `6760`. `Fecha de Corte: 15-07-2026`, `Fecha límite de pago: 10-08-2026` (dashed dd-mm-yyyy).
- MONEDA header rows (limits/minimums): `DOP  624,400.00  28,717.43  798.35`, `USD  6,036.00  1,831.32  50.91`, `Cuotas Scotiabank DOP  40,000.00  0.00  0.00` → currency line, limit, balance al corte, minimum.
- `Resumen de Cuenta` rows: `DOP  0.00  36,297.43  1,300.00  -8,880.00  4,903.82  28,717.43` → previous, purchases+debits, interest+charges, payments+credits (negative), avg monthly capital balance, closing.
- Transaction sections switch on `Detalle Transacciones en Pesos (DOP)` / `Detalle Transacciones en Dólares (USD)`; the section header also carries `Tasa de Interés Anual DOP: 60%`.
- Transaction line: `1169.  26/06/2026.  26/06/2026  CARGO SEGURO FRAUDE   350.00.` → card suffix (may have trailing dot), fecha de trans (made), fecha de posteo (posted), detail, amount (trailing dot). **No MCC, no reference.**
- Per-section footer: `Balance al Corte  28,717.43`, `Balance Promedio Diario de Capital del Mes  4,903.82`, `Balance Promedio Diario de Capital Anterior  0.00`, `Intereses Nuevos Consumos  223.15`, `Intereses por Financiamiento del Mes  0.00` — assign to the section currently open.
- Cuotas: emit section `CUOTAS_DOP` (currency DOP) from the MONEDA + Resumen rows only, no lines.
- Section keys: `DOP`, `USD`, `CUOTAS_DOP`. `periodStart` = `monthBeforePlusDay(periodEnd)`. `availableCreditCents` = null (not printed).
- Kinds: detail starts `PAGOS TARJETAS` or `PAGO ` → `payment`; other negative → `credit`; starts `CARGO ` → `fee`; else `purchase`.
- Totals: previous from Resumen row; debits/credits computed from lines for DOP/USD; for CUOTAS use Resumen columns (`purchases+interest` as debits, `|payments|` as credits).

- [ ] **Step 1: Write the synthetic fixture**

`lib/statements/fixtures/scotia-amex.ts`. DOP ties: 0 + (1,000.00 + 300.00 − 500.00) = 800.00. USD ties: 0 + (44.98 + 20.00 − 30.00) = 34.98.

```ts
/** Synthetic replica of the Scotiabank AMEX layout (fake data, real shape). */
export const SCOTIA_FIXTURE = `
                                                              RNC 101-04359-8
             Estado de cuenta de:                             Fecha de Corte: 15-07-2026
             CLIENTE FALSO                                    Fecha límite de pago: 10-08-2026

             American Express
             THE PLATINUM CARD METAL
             No. de Tarjeta:
             ***********6760
                     MONEDA             LIMITE DE CREDITO BALANCE AL CORTE PAGO MINIMO AL CORTE
             DOP                                 20,000.00                  800.00                 80.00
             USD                                  1,000.00                   34.98                  5.00
             Cuotas Scotiabank DOP               5,000.00                     0.00                  0.00

             Resumen de Cuenta
                     MONEDA           BALANCE               COMPRAS           INTERESES Y         TOTAL PAGOS            BALANCE PROMEDIO                  BALANCE
                                   CORTE ANTERIOR           Y DEBITOS           CARGOS             Y CREDITOS            MENSUAL DE CAPITAL                AL CORTE
             DOP                                 0.00         1,000.00              300.00              -500.00                       650.00                 800.00
             USD                                 0.00            64.98                0.00               -30.00                        20.00                  34.98
             Cuotas Scotiabank DOP               0.00             0.00                0.00                 0.00                         0.00                   0.00

             Detalle Transacciones en Pesos (DOP)                                    Tasa de Interés Anual DOP: 60%
                  NO. TARJETA               FECHA DE          FECHA DE                                  DETALLE DE
                                                                                                                      DEBITOS Y CREDITOS
                   CREDITO                   TRANS.            POSTEO                                 TRANSACCIONES

                   1169.              26/06/2026.        26/06/2026        CARGO COBERTURA DE SEGURO                       300.00.
                   6760.              27/06/2026.        29/06/2026        TIENDA FALSA UNO, CIUDAD FALSA               1,000.00.
                   1169.              01/07/2026.        01/07/2026        PAGOS TARJETAS ACH                             -500.00.

             Balance al Corte                                                 800.00
             Balance Promedio Diario de Capital del Mes                       650.00
             Balance Promedio Diario de Capital Anterior                        0.00
             Intereses Nuevos Consumos                                         29.57
             Intereses por Financiamiento del Mes                               0.00

             Detalle Transacciones en Dólares (USD)                                  Tasa de Interés Anual USD: 60%
                   6760                 28/06/2026.         30/06/2026         AMAZON MKTPL*FAKE, AMZN.COM/BILL              44.98.
                   6760                 29/06/2026.         30/06/2026         ANTHROPIC* CLAUDE SUB, SAN FRANCISCO          20.00.
                   1177                 06/07/2026.         06/07/2026         PAGO VENTANILLA                              -30.00.

             Balance al Corte                                                  34.98
             Balance Promedio Diario de Capital del Mes                        20.00
             Balance Promedio Diario de Capital Anterior                        0.00
             Intereses Nuevos Consumos                                          1.00
             Intereses por Financiamiento del Mes                               0.00

             Cuotas Scotiabank por facturar
             Scotiabank República Dominicana, S. A., Banco Múltiple - www.scotiabank.com.do
`;
```

- [ ] **Step 2: Write failing tests**

`lib/statements/parsers/scotia-amex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scotiaAmex } from "./scotia-amex";
import { SCOTIA_FIXTURE } from "../fixtures/scotia-amex";
import { validateChecksums } from "../validate";

describe("scotiaAmex.detect", () => {
  it("recognizes the RNC fingerprint", () => {
    expect(scotiaAmex.detect(SCOTIA_FIXTURE)).toBe(true);
    expect(scotiaAmex.detect("RNC 101010632 Banco Popular")).toBe(false);
  });
});

describe("scotiaAmex.parse", () => {
  const parsed = scotiaAmex.parse(SCOTIA_FIXTURE);
  const byKey = Object.fromEntries(parsed.sections.map((s) => [s.sectionKey, s]));

  it("emits DOP, USD and CUOTAS_DOP sections", () => {
    expect(parsed.parserId).toBe("scotia_amex");
    expect(parsed.cardLast4).toBe("6760");
    expect(parsed.sections.map((s) => s.sectionKey).sort()).toEqual(
      ["CUOTAS_DOP", "DOP", "USD"],
    );
    expect(byKey.USD.currency).toBe("USD");
    expect(byKey.CUOTAS_DOP.currency).toBe("DOP");
  });

  it("reads period, limits, minimums per section", () => {
    expect(byKey.DOP.periodEnd).toBe("2026-07-15");
    expect(byKey.DOP.periodStart).toBe("2026-06-16");
    expect(byKey.DOP.dueDate).toBe("2026-08-10");
    expect(byKey.DOP.creditLimitCents).toBe(2000000);
    expect(byKey.DOP.minimumPaymentCents).toBe(8000);
    expect(byKey.USD.creditLimitCents).toBe(100000);
    expect(byKey.CUOTAS_DOP.creditLimitCents).toBe(500000);
  });

  it("parses lines with kinds and dates (made = fecha de trans)", () => {
    expect(byKey.DOP.lines).toHaveLength(3);
    const [seguro, tienda, pago] = byKey.DOP.lines;
    expect(seguro).toMatchObject({
      kind: "fee", amountCents: 30000,
      madeOn: "2026-06-26", postedOn: "2026-06-26", mcc: null, reference: null,
    });
    expect(tienda).toMatchObject({ kind: "purchase", amountCents: 100000 });
    expect(pago).toMatchObject({ kind: "payment", amountCents: -50000 });
    expect(byKey.USD.lines).toHaveLength(3);
    expect(byKey.USD.lines[2].kind).toBe("payment");
    expect(byKey.CUOTAS_DOP.lines).toHaveLength(0);
  });

  it("reads per-section closing balance and cost of carry", () => {
    expect(byKey.DOP.closingBalanceCents).toBe(80000);
    expect(byKey.DOP.costOfCarryCents).toBe(2957);
    expect(byKey.DOP.avgDailyBalanceCents).toBe(65000);
    expect(byKey.DOP.interestRateAnnual).toBe(60);
    expect(byKey.USD.closingBalanceCents).toBe(3498);
    expect(byKey.USD.costOfCarryCents).toBe(100);
    expect(byKey.CUOTAS_DOP.closingBalanceCents).toBe(0);
  });

  it("passes checksums on every section", () => {
    expect(validateChecksums(parsed)).toEqual([]);
  });
});
```

`lib/statements/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectParser } from "./registry";
import { POPULAR_FIXTURE } from "./fixtures/popular-visa";
import { SCOTIA_FIXTURE } from "./fixtures/scotia-amex";

describe("detectParser", () => {
  it("routes each fixture to its parser", () => {
    expect(detectParser(POPULAR_FIXTURE)?.id).toBe("popular_visa");
    expect(detectParser(SCOTIA_FIXTURE)?.id).toBe("scotia_amex");
  });
  it("returns null for unknown layouts", () => {
    expect(detectParser("ACME BANK STATEMENT 2026")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/statements`
Expected: FAIL — `./scotia-amex`, `./registry` unresolved.

- [ ] **Step 4: Implement**

`lib/statements/parsers/scotia-amex.ts`:

```ts
import type { ParsedLine, ParsedSection, ParsedStatement, StatementParser } from "../types";
import { parseMoneyCents } from "../money";
import { ddmmyyyyToIso, monthBeforePlusDay } from "../dates";

const TXN =
  /^\s*(\d{4})\.?\s+(\d{2}\/\d{2}\/\d{4})\.?\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}(-?[\d,]+\.\d{2})\.?\s*$/;
const MONEDA_ROW =
  /^\s*(DOP|USD|Cuotas Scotiabank DOP)\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
const RESUMEN_ROW =
  /^\s*(DOP|USD|Cuotas Scotiabank DOP)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

const KEYS: Record<string, string> = {
  DOP: "DOP",
  USD: "USD",
  "Cuotas Scotiabank DOP": "CUOTAS_DOP",
};
const slashDate = (s: string) => ddmmyyyyToIso(s.replace(/\./g, "").trim());

function lineKind(detail: string, amountCents: number): ParsedLine["kind"] {
  if (/^(PAGOS TARJETAS|PAGO )/i.test(detail)) return "payment";
  if (amountCents < 0) return "credit";
  if (/^CARGO /.test(detail)) return "fee";
  return "purchase";
}

export const scotiaAmex: StatementParser = {
  id: "scotia_amex",

  detect(text) {
    return /RNC\s*101-04359-8/.test(text) || /Scotiabank Rep[uú]blica Dominicana/i.test(text);
  },

  parse(text) {
    const lines = text.split("\n");

    const cutMatch = text.match(/Fecha de Corte:\s*(\d{2}-\d{2}-\d{4})/);
    const dueMatch = text.match(/Fecha l[ií]mite de pago:\s*(\d{2}-\d{2}-\d{4})/);
    const cardMatch = text.match(/\*{6,}(\d{4})/);
    if (!cutMatch) throw new Error("scotia_amex: fecha de corte not found");
    const periodEnd = ddmmyyyyToIso(cutMatch[1]);
    const periodStart = monthBeforePlusDay(periodEnd);
    const dueDate = dueMatch ? ddmmyyyyToIso(dueMatch[1]) : null;

    // Header tables: first occurrence per row label wins (pages repeat them).
    const moneda = new Map<string, RegExpMatchArray>();
    const resumen = new Map<string, RegExpMatchArray>();
    for (const l of lines) {
      const mm = l.match(MONEDA_ROW);
      if (mm && !moneda.has(mm[1]) && !resumen.size) moneda.set(mm[1], mm);
      const rm = l.match(RESUMEN_ROW);
      if (rm && !resumen.has(rm[1])) resumen.set(rm[1], rm);
    }

    // Walk the detail sections, collecting lines + per-section footers.
    type Open = { key: string; currency: string; lines: ParsedLine[]; footer: Record<string, number> ; apr: number | null };
    const open = new Map<string, Open>();
    let current: Open | null = null;
    const FOOTERS: Array<[RegExp, string]> = [
      [/Balance al Corte\s+(-?[\d,]+\.\d{2})/, "closing"],
      [/Balance Promedio Diario de Capital del Mes\s+(-?[\d,]+\.\d{2})/, "avg"],
      [/Balance Promedio Diario de Capital Anterior\s+(-?[\d,]+\.\d{2})/, "avgPrior"],
      [/Intereses Nuevos Consumos\s+(-?[\d,]+\.\d{2})/, "carry"],
      [/Intereses por Financiamiento del Mes\s+(-?[\d,]+\.\d{2})/, "carryPrior"],
    ];
    for (const l of lines) {
      const dop = /Detalle Transacciones en Pesos/.test(l);
      const usd = /Detalle Transacciones en D[oó]lares/.test(l);
      if (dop || usd) {
        const key = dop ? "DOP" : "USD";
        if (!open.has(key)) {
          const aprMatch = l.match(/Tasa de Inter[eé]s Anual \w+:\s*([\d.]+)\s*%/);
          open.set(key, { key, currency: key, lines: [], footer: {}, apr: aprMatch ? Number(aprMatch[1]) : null });
        }
        current = open.get(key)!;
        continue;
      }
      if (!current) continue;
      const t = l.match(TXN);
      if (t) {
        const [, , made, posted, detail, rawAmount] = t;
        const amountCents = parseMoneyCents(rawAmount);
        const description = detail.trim().replace(/\s{2,}/g, " ");
        current.lines.push({
          lineNo: current.lines.length + 1,
          madeOn: slashDate(made),
          postedOn: slashDate(posted),
          reference: null,
          description,
          mcc: null,
          authCode: null,
          amountCents,
          kind: lineKind(description, amountCents),
        });
        continue;
      }
      for (const [re, name] of FOOTERS) {
        const m = l.match(re);
        if (m && current.footer[name] === undefined) current.footer[name] = parseMoneyCents(m[1]);
      }
    }

    const sections: ParsedSection[] = [];
    for (const [label, key] of Object.entries(KEYS)) {
      const mon = moneda.get(label);
      const res = resumen.get(label);
      if (!mon || !res) continue;
      const o = open.get(key) ?? null;
      const previousBalanceCents = parseMoneyCents(res[2]);
      const statedDebits = parseMoneyCents(res[3]) + parseMoneyCents(res[4]);
      const statedCredits = -parseMoneyCents(res[5]);
      const sectionLines = o?.lines ?? [];
      const totalDebitsCents = sectionLines.length
        ? sectionLines.filter((l) => l.amountCents > 0).reduce((s, l) => s + l.amountCents, 0)
        : statedDebits;
      const totalCreditsCents = sectionLines.length
        ? sectionLines.filter((l) => l.amountCents < 0).reduce((s, l) => s - l.amountCents, 0)
        : statedCredits;
      const closing = o?.footer.closing ?? parseMoneyCents(res[7]);
      sections.push({
        sectionKey: key,
        currency: label === "USD" ? "USD" : "DOP",
        periodStart,
        periodEnd,
        dueDate,
        previousBalanceCents,
        totalDebitsCents,
        totalCreditsCents,
        closingBalanceCents: closing,
        balanceToPayCents: closing,
        minimumPaymentCents: parseMoneyCents(mon[4]),
        overdueAmountCents: null,
        overdueInstallments: null,
        creditLimitCents: parseMoneyCents(mon[2]),
        availableCreditCents: null,
        interestRateAnnual: o?.apr ?? null,
        avgDailyBalanceCents: o?.footer.avg ?? parseMoneyCents(res[6]),
        avgDailyBalancePriorCents: o?.footer.avgPrior ?? null,
        costOfCarryCents: o?.footer.carry ?? null,
        costOfCarryPriorCents: o?.footer.carryPrior ?? null,
        lines: sectionLines,
      });
    }
    if (!sections.length) throw new Error("scotia_amex: no sections found");

    return { parserId: "scotia_amex", cardLast4: cardMatch ? cardMatch[1] : null, sections };
  },
};
```

Note on `RESUMEN_ROW` capture indices: `res[7]` is BALANCE AL CORTE (7 captures: label + 6 numbers). If the test fails on `resumen`, count the captures — label is `res[1]`, previous `res[2]`, purchases `res[3]`, interest `res[4]`, payments `res[5]`, avg `res[6]`, closing `res[7]`.

`lib/statements/registry.ts`:

```ts
import type { StatementParser } from "./types";
import { popularVisa } from "./parsers/popular-visa";
import { scotiaAmex } from "./parsers/scotia-amex";

export const parsers: StatementParser[] = [popularVisa, scotiaAmex];

export function detectParser(text: string): StatementParser | null {
  return parsers.find((p) => p.detect(text)) ?? null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/statements`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add lib/statements/parsers/scotia-amex.ts lib/statements/parsers/scotia-amex.test.ts lib/statements/fixtures/scotia-amex.ts lib/statements/registry.ts lib/statements/registry.test.ts
git commit -m "feat(statements): Scotiabank AMEX parser and parser registry"
```

---

### Task 5: Auto-categorization

**Files:**
- Create: `lib/statements/categorize.ts`
- Test: `lib/statements/categorize.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:

```ts
export interface CategoryRuleRow {
  rule_type: "mcc" | "merchant";
  pattern: string;
  category_id: string;
  priority: number;
}
/** MCC → seeded category NAME (used when no user rule matches). */
export const MCC_DEFAULT_CATEGORY: Record<string, string>;
/**
 * Resolution order: user merchant rules (substring, case-insensitive, priority
 * desc) → user mcc rules → built-in MCC defaults (by category name) → otherId.
 */
export function resolveCategoryId(
  line: { mcc: string | null; description: string },
  rules: CategoryRuleRow[],
  categoryIdByName: Map<string, string>,
  otherId: string,
): string;
```

- [ ] **Step 1: Write failing tests**

`lib/statements/categorize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveCategoryId, MCC_DEFAULT_CATEGORY } from "./categorize";

const names = new Map([
  ["Groceries", "cat-groceries"],
  ["Dining", "cat-dining"],
  ["Transport", "cat-transport"],
  ["Shopping", "cat-shopping"],
  ["Entertainment", "cat-entertainment"],
  ["Health", "cat-health"],
  ["Other", "cat-other"],
]);

describe("resolveCategoryId", () => {
  it("merchant rule beats mcc rule beats defaults", () => {
    const rules = [
      { rule_type: "merchant" as const, pattern: "UBER EATS", category_id: "cat-dining", priority: 0 },
      { rule_type: "mcc" as const, pattern: "4111", category_id: "cat-transport", priority: 0 },
    ];
    expect(
      resolveCategoryId({ mcc: "4111", description: "UBER EATS-WB*UBER EATS" }, rules, names, "cat-other"),
    ).toBe("cat-dining");
    expect(
      resolveCategoryId({ mcc: "4111", description: "METRO CARD" }, rules, names, "cat-other"),
    ).toBe("cat-transport");
  });

  it("merchant matching is case-insensitive substring, higher priority wins", () => {
    const rules = [
      { rule_type: "merchant" as const, pattern: "pricemart", category_id: "cat-groceries", priority: 1 },
      { rule_type: "merchant" as const, pattern: "price", category_id: "cat-shopping", priority: 0 },
    ];
    expect(
      resolveCategoryId({ mcc: null, description: "PRICEMART SAN ISIDRO" }, rules, names, "cat-other"),
    ).toBe("cat-groceries");
  });

  it("falls back to built-in MCC defaults by seeded category name", () => {
    expect(resolveCategoryId({ mcc: "5411", description: "X" }, [], names, "cat-other")).toBe("cat-groceries");
    expect(resolveCategoryId({ mcc: "5812", description: "X" }, [], names, "cat-other")).toBe("cat-dining");
    expect(resolveCategoryId({ mcc: "5541", description: "X" }, [], names, "cat-other")).toBe("cat-transport");
  });

  it("falls back to Other when nothing matches or the named category is missing", () => {
    expect(resolveCategoryId({ mcc: null, description: "MYSTERY" }, [], names, "cat-other")).toBe("cat-other");
    expect(resolveCategoryId({ mcc: "9999", description: "X" }, [], names, "cat-other")).toBe("cat-other");
    const empty = new Map<string, string>();
    expect(resolveCategoryId({ mcc: "5411", description: "X" }, [], empty, "cat-other")).toBe("cat-other");
  });

  it("covers the MCCs seen on real statements", () => {
    for (const mcc of ["5411", "5499", "5812", "5813", "5814", "5541", "4111", "9399", "5311", "5999", "5921", "5912", "8011", "8099"]) {
      expect(MCC_DEFAULT_CATEGORY[mcc]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/statements/categorize.ts`:

```ts
export interface CategoryRuleRow {
  rule_type: "mcc" | "merchant";
  pattern: string;
  category_id: string;
  priority: number;
}

/** MCC → seeded category NAME (see supabase seed_defaults). User rules override. */
export const MCC_DEFAULT_CATEGORY: Record<string, string> = {
  "5411": "Groceries", // supermarkets
  "5499": "Groceries", // convenience / colmados
  "5812": "Dining",    // restaurants
  "5813": "Dining",    // bars
  "5814": "Dining",    // fast food
  "5541": "Transport", // fuel
  "4111": "Transport", // local transport
  "9399": "Transport", // government services (tolls)
  "5311": "Shopping",  // department stores
  "5999": "Shopping",  // misc retail
  "5921": "Entertainment", // liquor stores
  "5912": "Health",    // pharmacies
  "8011": "Health",    // doctors
  "8099": "Health",    // health services
};

export function resolveCategoryId(
  line: { mcc: string | null; description: string },
  rules: CategoryRuleRow[],
  categoryIdByName: Map<string, string>,
  otherId: string,
): string {
  const desc = line.description.toUpperCase();
  const merchant = rules
    .filter((r) => r.rule_type === "merchant" && desc.includes(r.pattern.toUpperCase()))
    .sort((a, b) => b.priority - a.priority)[0];
  if (merchant) return merchant.category_id;

  if (line.mcc) {
    const mccRule = rules
      .filter((r) => r.rule_type === "mcc" && r.pattern === line.mcc)
      .sort((a, b) => b.priority - a.priority)[0];
    if (mccRule) return mccRule.category_id;

    const name = MCC_DEFAULT_CATEGORY[line.mcc];
    const byDefault = name ? categoryIdByName.get(name) : undefined;
    if (byDefault) return byDefault;
  }
  return otherId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/categorize.ts lib/statements/categorize.test.ts
git commit -m "feat(statements): MCC and merchant-rule categorization"
```

---

### Task 6: PDF text extraction (pdfjs-dist)

**Files:**
- Modify: `package.json` (add `pdfjs-dist`)
- Create: `lib/statements/extract.ts`
- Create: `scripts/parse-statement.mjs` (local verification harness; committed, but reads only local paths passed as args)

**Interfaces:**
- Produces:

```ts
// lib/statements/extract.ts
export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "password_required" | "bad_password" | "unreadable" };
export async function extractStatementText(
  data: Uint8Array,
  password?: string,
): Promise<ExtractResult>;
```

No unit tests: exercising pdfjs needs a real PDF, and real statements are never committed. Verification is manual against the two local statements (Step 3) — that check is REQUIRED before this task is done.

- [ ] **Step 1: Install dependency**

Run: `npm install pdfjs-dist`
Expected: added to `package.json` dependencies.

- [ ] **Step 2: Implement extraction**

`lib/statements/extract.ts`:

```ts
/**
 * PDF → layout-preserved text for the statement parsers.
 *
 * pdfjs gives positioned text runs; parsers need lines where columns are
 * separated by 2+ spaces. Runs are grouped into rows by y (2pt tolerance),
 * sorted by x, and joined with spacing proportional to the horizontal gap.
 * Passwords are used in memory only — never persisted (spec §3.1).
 */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "password_required" | "bad_password" | "unreadable" };

type Run = { str: string; x: number; y: number; w: number };

export async function extractStatementText(
  data: Uint8Array,
  password?: string,
): Promise<ExtractResult> {
  let doc;
  try {
    doc = await getDocument({ data, password, isEvalSupported: false }).promise;
  } catch (err) {
    const e = err as { name?: string; code?: number };
    if (e.name === "PasswordException") {
      // code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      return { ok: false, reason: e.code === 2 ? "bad_password" : "password_required" };
    }
    return { ok: false, reason: "unreadable" };
  }

  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const runs: Run[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      runs.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        w: item.width,
      });
    }
    // Group into rows by y (descending page order), 2pt tolerance.
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Run[][] = [];
    for (const run of runs) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].y - run.y) <= 2) row.push(run);
      else rows.push([run]);
    }
    const lines = rows.map((row) => {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let cursor = 0; // running x in pt
      for (const run of row) {
        const gap = run.x - cursor;
        // ~4pt per character; 2+ spaces marks a column boundary for the parsers.
        const spaces = line === "" ? Math.round(run.x / 4) : Math.max(gap > 6 ? 2 : 1, Math.round(gap / 4));
        line += " ".repeat(Math.max(spaces, line === "" ? 0 : 1)) + run.str;
        cursor = run.x + run.w;
      }
      return line;
    });
    pages.push(lines.join("\n"));
  }
  await doc.destroy();
  return { ok: true, text: pages.join("\n") };
}
```

`scripts/parse-statement.mjs` (dev harness — run locally, never in CI):

```js
// Usage: node scripts/parse-statement.mjs <path.pdf> [password]
// Prints parser id, per-section totals, line counts, checksum result.
import { readFile } from "node:fs/promises";
import { extractStatementText } from "../lib/statements/extract.ts";
import { detectParser } from "../lib/statements/registry.ts";
import { validateChecksums } from "../lib/statements/validate.ts";
import { centsToDecimal } from "../lib/statements/money.ts";

const [path, password] = process.argv.slice(2);
const bytes = new Uint8Array(await readFile(path));
const extracted = await extractStatementText(bytes, password);
if (!extracted.ok) {
  console.error("extract failed:", extracted.reason);
  process.exit(1);
}
const parser = detectParser(extracted.text);
if (!parser) {
  console.error("no parser detected");
  process.exit(1);
}
const parsed = parser.parse(extracted.text);
console.log("parser:", parsed.parserId, "last4:", parsed.cardLast4);
for (const s of parsed.sections) {
  console.log(
    `  [${s.sectionKey}] ${s.currency} ${s.periodStart}..${s.periodEnd}`,
    `lines=${s.lines.length}`,
    `closing=${centsToDecimal(s.closingBalanceCents)}`,
    `carry=${s.costOfCarryCents === null ? "-" : centsToDecimal(s.costOfCarryCents)}`,
  );
}
const failures = validateChecksums(parsed);
console.log(failures.length ? failures : "checksums OK");
```

Run the harness with `npx tsx scripts/parse-statement.mjs …` if plain `node` rejects the TS imports (`npm i -D tsx` is acceptable).

- [ ] **Step 3: REQUIRED manual verification against the real statements**

The two real files are in the repo root (untracked, gitignored). The VISA password is in the session transcript; ask the user if it is not available.

Run: `npx tsx scripts/parse-statement.mjs 266202681319221682_4921-XXXX-XXXX-5850.pdf <password>`
Expected: `parser: popular_visa last4: 5850`, 1 section, `lines=42`, `closing=37992.08`, `carry=979.49`, `checksums OK`.

Run: `npx tsx scripts/parse-statement.mjs d942f5db-a59f-4d4a-bb0f-5cc2bba7d27f.pdf`
Expected: `parser: scotia_amex last4: 6760`, 3 sections, DOP `lines=23 closing=28717.43 carry=223.15`, USD `lines=11 closing=1831.32 carry=27.13`, CUOTAS_DOP `lines=0 closing=0.00`, `checksums OK`.

If extraction spacing breaks a parser regex, fix `extract.ts` spacing heuristics or loosen the parser regex (`\s+` between fields, `\s{2,}` only before amounts) until BOTH real files pass AND the fixture tests still pass (`npx vitest run lib/statements`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/statements/extract.ts scripts/parse-statement.mjs
git commit -m "feat(statements): pdfjs text extraction with layout reconstruction"
```

---

### Task 7: Server actions (parse → preview → confirm)

**Files:**
- Create: `lib/statements/mapping.ts`
- Create: `app/(app)/accounts/statement-actions.ts`
- Test: `lib/statements/mapping.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–6; DB objects from Task 1.
- Produces (used by Task 8's UI):

```ts
// lib/statements/mapping.ts
export interface CardAccountOption {
  id: string;
  name: string;
  currency: string;
  credit_limit: number | null;
}
/** Heuristic pre-fill only — the user confirms. Currency match first, then
 *  nearest credit limit; null when nothing matches the currency. */
export function suggestAccountId(
  section: { currency: string; creditLimitCents: number | null },
  options: CardAccountOption[],
): string | null;

// app/(app)/accounts/statement-actions.ts   ("use server")
export interface SectionPreview {
  sectionKey: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  closingBalance: string;      // decimal string
  costOfCarry: string | null;
  lineCount: number;           // transactions to create
  paymentCount: number;        // payment lines skipped
  creditLimit: string | null;
  mappedAccountId: string | null;    // from saved mapping (or the only account)
  suggestedAccountId: string | null; // heuristic pre-fill for the dialog
}
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    cardGroupId: string | null;
    needsMapping: boolean;
    sections: SectionPreview[];
    accountOptions: { id: string; name: string; currency: string }[];
  };
}
export async function parseStatement(formData: FormData): Promise<StatementPreviewResult>;
// formData: file: File, account_id: string, password?: string

export async function confirmStatementImport(formData: FormData): Promise<{ error?: string }>;
// formData: file: File, account_id: string, password?: string,
//           mappings: JSON string of Record<sectionKey, accountId>

export async function deleteCardStatement(id: string, accountId: string): Promise<{ error?: string }>;
export async function saveMerchantRule(pattern: string, categoryId: string): Promise<{ error?: string }>;
```

**Design notes:**
- Stateless two-step: `confirmStatementImport` re-runs extract+parse+validate on the re-sent file rather than trusting client-held parse output. The client only contributes the section→account mapping.
- Account resolution: load the clicked account; if it has a `card_group_id`, options = all non-archived credit-card accounts in that group; else options = just that account. Single section + single option → auto-map (`needsMapping: false`).
- Saved mappings: read `statement_section_mappings` for `(parser_id, card_group_id)`; a section is `needsMapping` when it has no saved mapping AND options > 1.
- On confirm: validate every section has a mapped account whose currency equals the section currency (reject otherwise); resolve categories via `resolveCategoryId` (fetch `category_rules` + `categories`; `otherId` = the user's category named "Other", falling back to the first category — every expense needs one); compute `exchange_rate` per section via `getExchangeRates(baseCurrency)` — rate = base per unit of section currency = `1 / rates[currency]`, defaulting to 1 when missing (existing fx fallback convention); upload the ORIGINAL file bytes to storage at `statements/{userId}/{yyyy-mm}-{parserId}-{last4}.pdf` (upsert); call `supabase.rpc("import_card_statement", { p: payload })`; upsert the used mappings; `revalidatePath` for `/accounts`, the account pages involved, and `/`.
- Checksum failure → return `{ error }` listing each failing section as `"<key>: computed <x> ≠ stated <y>"`, and insert a `statement_imports` row with status `failed_validation` for the audit trail (same for `failed_detection`).
- `deleteCardStatement`: delete the `card_statements` row (cascades lines→transactions; DB trigger recomputes), revalidate.
- `saveMerchantRule`: upsert into `category_rules` (`rule_type: 'merchant'`, `onConflict: 'user_id,rule_type,pattern'`).

- [ ] **Step 1: Write failing tests for the mapping heuristic**

`lib/statements/mapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestAccountId } from "./mapping";

const options = [
  { id: "dop-main", name: "AMEX DOP", currency: "DOP", credit_limit: 624400 },
  { id: "usd", name: "AMEX USD", currency: "USD", credit_limit: 6036 },
  { id: "cuotas", name: "AMEX Cuotas", currency: "DOP", credit_limit: 40000 },
];

describe("suggestAccountId", () => {
  it("matches by currency when unambiguous", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: 603600 }, options)).toBe("usd");
  });
  it("disambiguates same-currency lines by nearest credit limit", () => {
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 62440000 }, options)).toBe("dop-main");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 4000000 }, options)).toBe("cuotas");
  });
  it("returns null when no option shares the currency", () => {
    expect(suggestAccountId({ currency: "EUR", creditLimitCents: null }, options)).toBeNull();
  });
  it("without a statement limit, picks the sole currency match or null", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: null }, options)).toBe("usd");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: null }, options)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/statements/mapping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/statements/mapping.ts`**

```ts
export interface CardAccountOption {
  id: string;
  name: string;
  currency: string;
  credit_limit: number | null;
}

/** Heuristic pre-fill only — the user confirms in the mapping dialog.
 *  Never trusted to route money silently (spec §2.2). */
export function suggestAccountId(
  section: { currency: string; creditLimitCents: number | null },
  options: CardAccountOption[],
): string | null {
  const sameCurrency = options.filter((o) => o.currency === section.currency);
  if (sameCurrency.length === 0) return null;
  if (sameCurrency.length === 1) return sameCurrency[0].id;
  if (section.creditLimitCents === null) return null;
  const target = section.creditLimitCents / 100;
  return sameCurrency
    .slice()
    .sort(
      (a, b) =>
        Math.abs((a.credit_limit ?? Infinity) - target) -
        Math.abs((b.credit_limit ?? Infinity) - target),
    )[0].id;
}
```

Run: `npx vitest run lib/statements/mapping.test.ts` → PASS.

- [ ] **Step 4: Implement `app/(app)/accounts/statement-actions.ts`**

Follow the file conventions of `app/(app)/accounts/actions.ts` (`"use server"`, `requireUser` pattern, `dbError`). Complete implementation:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { extractStatementText } from "@/lib/statements/extract";
import { detectParser } from "@/lib/statements/registry";
import { validateChecksums } from "@/lib/statements/validate";
import { centsToDecimal } from "@/lib/statements/money";
import { suggestAccountId, type CardAccountOption } from "@/lib/statements/mapping";
import { resolveCategoryId, type CategoryRuleRow } from "@/lib/statements/categorize";
import { getExchangeRates } from "@/lib/fx";
import type { ParsedStatement } from "@/lib/statements/types";

export interface SectionPreview {
  sectionKey: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  closingBalance: string;
  costOfCarry: string | null;
  lineCount: number;
  paymentCount: number;
  creditLimit: string | null;
  mappedAccountId: string | null;
  suggestedAccountId: string | null;
}
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    cardGroupId: string | null;
    needsMapping: boolean;
    sections: SectionPreview[];
    accountOptions: { id: string; name: string; currency: string }[];
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Shared by parse and confirm: extract → detect → parse → checksum. */
async function runPipeline(formData: FormData) {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;

  const file = formData.get("file");
  const accountId = String(formData.get("account_id") ?? "");
  const password = String(formData.get("password") ?? "") || undefined;
  if (!(file instanceof File) || !accountId) return { error: t("invalidUpload") } as const;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    return { needsPassword: true } as const;
  }

  const parser = detectParser(extracted.text);
  if (!parser) {
    await supabase.from("statement_imports").insert({
      user_id: user.id, parser_id: "unknown", file_name: file.name,
      status: "failed_detection", error: "no parser matched",
    });
    return { error: t("unsupportedBank") } as const;
  }

  let parsed: ParsedStatement;
  try {
    parsed = parser.parse(extracted.text);
  } catch (e) {
    await supabase.from("statement_imports").insert({
      user_id: user.id, parser_id: parser.id, file_name: file.name,
      status: "failed_detection", error: String(e),
    });
    return { error: t("parseFailed") } as const;
  }

  const failures = validateChecksums(parsed);
  if (failures.length) {
    const detail = failures
      .map((f) => `${f.sectionKey}: ${centsToDecimal(f.computedCents)} ≠ ${centsToDecimal(f.statedCents)}`)
      .join("; ");
    await supabase.from("statement_imports").insert({
      user_id: user.id, parser_id: parser.id, file_name: file.name,
      status: "failed_validation", error: detail,
    });
    return { error: t("checksumFailed", { detail }) } as const;
  }

  // Resolve the card group + account options from the account the user is on.
  const { data: account } = await supabase
    .from("accounts")
    .select("id,name,currency,credit_limit,card_group_id,type")
    .eq("id", accountId)
    .single();
  if (!account || account.type !== "credit_card") return { error: t("notACard") } as const;

  let options: CardAccountOption[] = [
    { id: account.id, name: account.name, currency: account.currency, credit_limit: account.credit_limit },
  ];
  if (account.card_group_id) {
    const { data: group } = await supabase
      .from("accounts")
      .select("id,name,currency,credit_limit")
      .eq("card_group_id", account.card_group_id)
      .eq("type", "credit_card")
      .eq("is_archived", false);
    if (group?.length) options = group;
  }

  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parser.id)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { supabase, user, file, bytes, parser, parsed, account, options, saved, t } as const;
}

export async function parseStatement(formData: FormData): Promise<StatementPreviewResult> {
  const ctx = await runPipeline(formData);
  if ("error" in ctx || "needsPassword" in ctx) return ctx as StatementPreviewResult;
  const { parsed, parser, account, options, saved, file } = ctx;

  const sections: SectionPreview[] = parsed.sections.map((s) => {
    const mapped =
      saved.get(s.sectionKey) ??
      (parsed.sections.length === 1 && options.length === 1 ? options[0].id : null);
    return {
      sectionKey: s.sectionKey,
      currency: s.currency,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      dueDate: s.dueDate,
      closingBalance: centsToDecimal(s.closingBalanceCents),
      costOfCarry: s.costOfCarryCents === null ? null : centsToDecimal(s.costOfCarryCents),
      lineCount: s.lines.filter((l) => l.kind !== "payment").length,
      paymentCount: s.lines.filter((l) => l.kind === "payment").length,
      creditLimit: s.creditLimitCents === null ? null : centsToDecimal(s.creditLimitCents),
      mappedAccountId: mapped,
      suggestedAccountId: mapped ?? suggestAccountId(s, options),
    };
  });

  return {
    preview: {
      parserId: parser.id,
      cardLast4: parsed.cardLast4,
      fileName: file.name,
      cardGroupId: account.card_group_id,
      needsMapping: sections.some((s) => !s.mappedAccountId),
      sections,
      accountOptions: options.map(({ id, name, currency }) => ({ id, name, currency })),
    },
  };
}

export async function confirmStatementImport(formData: FormData): Promise<{ error?: string }> {
  const ctx = await runPipeline(formData);
  if ("error" in ctx) return { error: ctx.error };
  if ("needsPassword" in ctx) return { error: (await getTranslations("Statements"))("passwordRequired") };
  const { supabase, user, parsed, parser, account, options, bytes, file, t } = ctx;

  const mappings: Record<string, string> = JSON.parse(String(formData.get("mappings") ?? "{}"));
  const optionById = new Map(options.map((o) => [o.id, o]));

  // Every section must land on a currency-matching card the user owns.
  for (const s of parsed.sections) {
    const target = mappings[s.sectionKey];
    const opt = target ? optionById.get(target) : undefined;
    if (!opt) return { error: t("unmappedSection", { section: s.sectionKey }) };
    if (opt.currency !== s.currency)
      return { error: t("currencyMismatch", { section: s.sectionKey, currency: s.currency }) };
  }

  // Category resolution inputs.
  const [{ data: cats }, { data: ruleRows }, { data: profile }] = await Promise.all([
    supabase.from("categories").select("id,name"),
    supabase.from("category_rules").select("rule_type,pattern,category_id,priority"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const otherId = categoryIdByName.get("Other") ?? cats?.[0]?.id;
  if (!otherId) return { error: t("noCategories") };
  const rules = (ruleRows ?? []) as CategoryRuleRow[];
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);

  // Store the original file (still encrypted if it was) in the private bucket.
  const filePath = `${user.id}/${parsed.sections[0].periodEnd}-${parser.id}-${parsed.cardLast4 ?? "xxxx"}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("statements")
    .upload(filePath, bytes, { contentType: "application/pdf", upsert: true });
  // Upload failure is non-fatal: the import is the point; the file is a nicety.
  const storedPath = uploadError ? "" : filePath;

  const payload = {
    parser_id: parser.id,
    card_group_id: account.card_group_id ?? "",
    file_name: file.name,
    file_path: storedPath,
    sections: parsed.sections.map((s) => {
      const rate = s.currency === baseCurrency ? 1 : rates[s.currency] ? 1 / rates[s.currency] : 1;
      return {
        account_id: mappings[s.sectionKey],
        section_key: s.sectionKey,
        period_start: s.periodStart,
        period_end: s.periodEnd,
        due_date: s.dueDate ?? "",
        previous_balance: centsToDecimal(s.previousBalanceCents),
        total_debits: centsToDecimal(s.totalDebitsCents),
        total_credits: centsToDecimal(s.totalCreditsCents),
        statement_balance: centsToDecimal(s.balanceToPayCents),
        total_balance: centsToDecimal(s.closingBalanceCents),
        minimum_payment: s.minimumPaymentCents === null ? "" : centsToDecimal(s.minimumPaymentCents),
        overdue_amount: s.overdueAmountCents === null ? "" : centsToDecimal(s.overdueAmountCents),
        overdue_installments: s.overdueInstallments === null ? "" : String(s.overdueInstallments),
        credit_limit: s.creditLimitCents === null ? "" : centsToDecimal(s.creditLimitCents),
        available_credit: s.availableCreditCents === null ? "" : centsToDecimal(s.availableCreditCents),
        interest_rate_annual: s.interestRateAnnual === null ? "" : String(s.interestRateAnnual),
        avg_daily_balance: s.avgDailyBalanceCents === null ? "" : centsToDecimal(s.avgDailyBalanceCents),
        avg_daily_balance_prior:
          s.avgDailyBalancePriorCents === null ? "" : centsToDecimal(s.avgDailyBalancePriorCents),
        cost_of_carry: s.costOfCarryCents === null ? "" : centsToDecimal(s.costOfCarryCents),
        cost_of_carry_prior:
          s.costOfCarryPriorCents === null ? "" : centsToDecimal(s.costOfCarryPriorCents),
        exchange_rate: String(rate),
        lines: s.lines.map((l) => ({
          line_no: String(l.lineNo),
          made_on: l.madeOn,
          posted_on: l.postedOn,
          reference: l.reference ?? "",
          description: l.description,
          mcc: l.mcc ?? "",
          auth_code: l.authCode ?? "",
          amount: centsToDecimal(l.amountCents),
          kind: l.kind,
          category_id:
            l.kind === "payment"
              ? ""
              : resolveCategoryId(l, rules, categoryIdByName, otherId),
        })),
      };
    }),
  };

  const { error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };

  // Remember confirmed mappings for zero-touch future imports.
  if (account.card_group_id) {
    for (const s of parsed.sections) {
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parser.id,
          card_group_id: account.card_group_id,
          section_key: s.sectionKey,
          account_id: mappings[s.sectionKey],
        },
        { onConflict: "user_id,parser_id,card_group_id,section_key" },
      );
    }
  }

  revalidatePath("/accounts");
  for (const id of new Set(Object.values(mappings))) revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/insights");
  return {};
}

export async function deleteCardStatement(id: string, accountId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("card_statements").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteCardStatement") };
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/");
  return {};
}

export async function saveMerchantRule(pattern: string, categoryId: string): Promise<{ error?: string }> {
  const trimmed = pattern.trim();
  if (!trimmed) return { error: "empty pattern" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("category_rules").upsert(
    { user_id: user.id, rule_type: "merchant", pattern: trimmed, category_id: categoryId, priority: 10 },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (error) return { error: await dbError(error, "saveMerchantRule") };
  return {};
}
```

- [ ] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npx vitest run lib/statements`
Expected: clean typecheck, all statement tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/statements/mapping.ts lib/statements/mapping.test.ts app/(app)/accounts/statement-actions.ts
git commit -m "feat(statements): parse/confirm server actions with mapping heuristics"
```

---

### Task 8: StatementsPanel UI; remove ReconcilePanel and manual balance recording

**Files:**
- Create: `components/accounts/statements-panel.tsx`
- Modify: `app/(app)/accounts/[id]/page.tsx` (swap panel, fetch statements, anchor caption)
- Modify: `lib/accounts/queries.ts` (add `getCardStatements`)
- Delete: `components/accounts/reconcile-panel.tsx`
- Modify: `app/(app)/accounts/actions.ts` (remove `addCardStatement`, `setCardBalance`)
- Modify: `lib/accounts/schema.ts` (remove `cardStatementInput`)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `parseStatement`, `confirmStatementImport`, `deleteCardStatement` (Task 7); `getCardStatements` (this task).
- Produces:

```ts
// lib/accounts/queries.ts
export type CardStatementRow = Database["public"]["Tables"]["card_statements"]["Row"];
export async function getCardStatements(accountId: string): Promise<CardStatementRow[]>;
// select("*").eq("account_id", accountId).order("period_end", { ascending: false })
```

- [ ] **Step 1: Add `getCardStatements` to `lib/accounts/queries.ts`**

Follow the file's existing query style (server `createClient`, typed rows):

```ts
export type CardStatementRow = Database["public"]["Tables"]["card_statements"]["Row"];

export async function getCardStatements(accountId: string): Promise<CardStatementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
    .order("period_end", { ascending: false });
  return data ?? [];
}
```

- [ ] **Step 2: Create `components/accounts/statements-panel.tsx`**

Client component. Structure (complete this skeleton with the project's existing UI primitives — `Card`, `Button`, `Input`, `Label`, `Select`, `Dialog` from `components/ui/`, toasts via `sonner`, sounds via `useUiSound`, exactly as `reconcile-panel.tsx` did):

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Upload, Trash2, FileText } from "lucide-react";
import {
  parseStatement,
  confirmStatementImport,
  deleteCardStatement,
  type StatementPreviewResult,
} from "@/app/(app)/accounts/statement-actions";
import type { CardStatementRow } from "@/lib/accounts/queries";
import { formatMoney } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Preview = NonNullable<StatementPreviewResult["preview"]>;

export function StatementsPanel({
  accountId,
  currency,
  statements,
}: {
  accountId: string;
  currency: string;
  statements: CardStatementRow[];
}) {
  const t = useTranslations("Statements");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { playSuccess, playError } = useUiSound();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  function buildFormData(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("account_id", accountId);
    if (password) fd.set("password", password);
    return fd;
  }

  function onParse(f: File) {
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) { setNeedsPassword(true); return; }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed")); playError(); return;
      }
      setNeedsPassword(false);
      setPreview(result.preview);
      setMappings(Object.fromEntries(
        result.preview.sections
          .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
          .filter(([, v]) => v),
      ));
    });
  }

  function onConfirm() {
    if (!file || !preview) return;
    const fd = buildFormData(file);
    fd.set("mappings", JSON.stringify(mappings));
    startTransition(async () => {
      const result = await confirmStatementImport(fd);
      if (result.error) { toast.error(result.error); playError(); return; }
      toast.success(t("imported")); playSuccess();
      setPreview(null); setFile(null); setPassword("");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCardStatement(id, accountId);
      if (result.error) { toast.error(result.error); playError(); return; }
      toast.success(t("statementDeleted")); playSuccess();
      router.refresh();
    });
  }

  const latest = statements[0];
  const allMapped = preview?.sections.every((s) => mappings[s.sectionKey]) ?? false;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1.5 size-4" />
          {t("importButton")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setPassword("");
            setNeedsPassword(false);
            setPreview(null);
            onParse(f);
          }}
        />
      </div>

      {needsPassword && file ? (
        <div className="mt-5 space-y-2">
          <Label htmlFor="stmt-password">{t("passwordLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          <div className="flex gap-2">
            <Input
              id="stmt-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={pending || !password}
              onClick={() => onParse(file)}
            >
              {t("retryButton")}
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 space-y-4">
          {preview.sections.map((s) => (
            <div key={s.sectionKey} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {s.sectionKey} · {s.currency} · {s.periodStart} → {s.periodEnd}
                </p>
                <p className="figure text-sm">
                  {formatMoney(Number(s.closingBalance), s.currency)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("sectionSummary", { lines: s.lineCount, payments: s.paymentCount })}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("mapSectionLabel", { section: s.sectionKey })}</Label>
                <Select
                  value={mappings[s.sectionKey] ?? ""}
                  onValueChange={(v) => setMappings((m) => ({ ...m, [s.sectionKey]: v }))}
                  items={Object.fromEntries(preview.accountOptions.map((a) => [a.id, a.name]))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.accountOptions
                      .filter((a) => a.currency === s.currency)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button disabled={pending || !allMapped} onClick={onConfirm}>
              {t("confirmButton")}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setFile(null);
                setPassword("");
              }}
            >
              {t("cancelButton")}
            </Button>
          </div>
        </div>
      ) : null}

      <Separator className="my-6" />

      {latest?.cost_of_carry != null && latest.interest_rate_annual != null ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("costOfCarryStat", {
            amount: formatMoney(Number(latest.cost_of_carry), currency),
            rate: Number(latest.interest_rate_annual),
          })}
        </p>
      ) : null}

      {statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {statements.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {s.period_end}
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.source === "import" ? t("sourceImport") : t("sourceManual")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.due_date ? t("dueLabel", { date: s.due_date }) : null}
                    {s.minimum_payment != null
                      ? ` · ${t("minimumLabel", { amount: formatMoney(Number(s.minimum_payment), currency) })}`
                      : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="figure text-sm">{formatMoney(Number(s.total_balance), currency)}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t("deleteConfirm"))) onDelete(s.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

If `components/ui/button.tsx` has no `size="icon"` variant or `Select` props differ, match the project's actual primitives (check `reconcile-panel.tsx` and `account-form-dialog.tsx` usage) — keep the structure above.

- [ ] **Step 3: Swap the panel on the account page**

In `app/(app)/accounts/[id]/page.tsx`:
- Remove the `ReconcilePanel` import; add `StatementsPanel` and `getCardStatements`.
- Add `const statements = isCardType ? await getCardStatements(id) : [];` after the account loads (add to the existing `Promise.all` is fine since `isCardType` isn't known yet — fetching unconditionally is acceptable).
- Replace the `<ReconcilePanel …/>` block with:

```tsx
{isCardType ? (
  <StatementsPanel accountId={account.id} currency={currency} statements={statements} />
) : null}
```

- Under the hero `balanceOwed` figure, when `statements[0]` exists add the anchor caption:

```tsx
{isCardType && statements[0] ? (
  <p className="mt-1 text-xs text-muted-foreground">
    {t("anchoredToStatement", { date: statements[0].period_end })}
  </p>
) : null}
```

- [ ] **Step 4: Delete manual reconciliation**

- Delete `components/accounts/reconcile-panel.tsx`.
- In `app/(app)/accounts/actions.ts`: remove `addCardStatement` and `setCardBalance` entirely, and the now-unused `cardStatementInput` import.
- In `lib/accounts/schema.ts`: remove `cardStatementInput` (and its type export if present).
- Run `grep -rn "setCardBalance\|addCardStatement\|cardStatementInput\|ReconcilePanel" app components lib` — expect zero hits.

- [ ] **Step 5: Translations**

Add to `messages/en.json` under a new `"Statements"` namespace (and the `AccountDetail.anchoredToStatement` key); mirror in Spanish in `messages/es.json`:

```json
"Statements": {
  "title": "Statements",
  "description": "Upload your monthly statement PDF. It becomes the source of truth: balances anchor to it and purchases import as categorized expenses. Payments you record yourself are never duplicated.",
  "importButton": "Import statement",
  "passwordLabel": "PDF password",
  "passwordHint": "This statement is password-protected. The password is used once and never stored.",
  "retryButton": "Unlock",
  "invalidUpload": "Choose a PDF file first.",
  "unreadablePdf": "That file couldn't be read as a PDF.",
  "unsupportedBank": "This bank's statement layout isn't supported yet.",
  "parseFailed": "The statement couldn't be parsed.",
  "passwordRequired": "The PDF password is required.",
  "checksumFailed": "The statement's own totals don't add up ({detail}). Nothing was imported.",
  "notACard": "Statements can only be imported on credit cards.",
  "unmappedSection": "Section {section} has no destination account.",
  "currencyMismatch": "Section {section} is in {currency}; pick an account in that currency.",
  "noCategories": "You need at least one category before importing.",
  "sectionSummary": "{lines} purchases · {payments} payments (skipped)",
  "mapSectionLabel": "Import {section} into",
  "confirmButton": "Import",
  "cancelButton": "Cancel",
  "imported": "Statement imported.",
  "statementDeleted": "Statement deleted, transactions removed.",
  "historyEmpty": "No statements yet. Import your first one.",
  "sourceImport": "Imported",
  "sourceManual": "Manual",
  "dueLabel": "Due {date}",
  "minimumLabel": "Minimum {amount}",
  "deleteConfirm": "Delete this statement? Its imported transactions are removed and the balance recomputed.",
  "costOfCarryStat": "Carrying this balance costs about {amount}/month at {rate}% APR."
}
```

`AccountDetail`: add `"anchoredToStatement": "As of the {date} statement, plus payments since."`; REMOVE the dead keys `reconcileTitle`, `reconcileDescription`, `currentBalanceOwed`, `update`, `recordStatementHeading`, `latestStatementAmount`, `dueSuffix`, `periodStart`, `periodEnd`, `statementBalance`, `totalBalance`, `totalDebits`, `totalCredits`, `paymentDueDate`, `recordStatementButton`, `statementRecorded`, `balanceUpdated` from BOTH locales (verify each is truly unused first: `grep -rn "<key>" app components lib`).

Spanish (`es.json`) equivalents — translate faithfully, e.g. `"title": "Estados de cuenta"`, `"importButton": "Importar estado"`, `"imported": "Estado de cuenta importado."`, `"costOfCarryStat": "Mantener este balance cuesta aprox. {amount}/mes al {rate}% anual."`, etc. Every English key must exist in Spanish.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean. Also `node -e "const en=require('./messages/en.json'),es=require('./messages/es.json');const k=o=>Object.entries(o).flatMap(([a,b])=>typeof b==='object'?k(b).map(x=>a+'.'+x):[a]);const a=new Set(k(en)),b=new Set(k(es));console.log([...a].filter(x=>!b.has(x)),[...b].filter(x=>!a.has(x)))"` → `[] []`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(accounts): statement import panel replaces manual reconciliation"
```

---

### Task 9: Cost of carry on insights

**Files:**
- Modify: `lib/insights/queries.ts`
- Modify: `app/(app)/insights/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `card_cost_of_carry` view (Task 1), `getExchangeRates`/`convertToBase` (`lib/fx.ts`).
- Produces (added to `lib/insights/queries.ts`):

```ts
export interface CostOfCarryLine {
  accountId: string;
  name: string;        // "Group — Line" when grouped, else account name
  currency: string;
  periodEnd: string;
  apr: number | null;
  avgDailyBalance: number | null;
  costOfCarry: number | null;      // native currency
  costOfCarryBase: number | null;  // base currency
}
export interface CostOfCarry {
  baseCurrency: string;
  lines: CostOfCarryLine[];
  totalBase: number; // Σ costOfCarryBase
}
export async function getCostOfCarry(): Promise<CostOfCarry>;
```

- [ ] **Step 1: Implement `getCostOfCarry`**

Append to `lib/insights/queries.ts`, following its existing conventions:

```ts
export async function getCostOfCarry(): Promise<CostOfCarry> {
  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("card_cost_of_carry")
      .select("account_id,name,currency,group_name,period_end,interest_rate_annual,avg_daily_balance,cost_of_carry"),
  ]);
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);

  const lines: CostOfCarryLine[] = (rows ?? []).map((r) => {
    const carry = r.cost_of_carry === null ? null : Number(r.cost_of_carry);
    return {
      accountId: r.account_id,
      name: r.group_name ? `${r.group_name} — ${r.name}` : r.name,
      currency: r.currency,
      periodEnd: r.period_end,
      apr: r.interest_rate_annual === null ? null : Number(r.interest_rate_annual),
      avgDailyBalance: r.avg_daily_balance === null ? null : Number(r.avg_daily_balance),
      costOfCarry: carry,
      costOfCarryBase: carry === null ? null : convertToBase(carry, r.currency, baseCurrency, rates),
    };
  });
  return {
    baseCurrency,
    lines,
    totalBase: lines.reduce((s, l) => s + (l.costOfCarryBase ?? 0), 0),
  };
}
```

(Import `getExchangeRates, convertToBase` from `@/lib/fx` at the top if not already imported.)

- [ ] **Step 2: Render the section**

In `app/(app)/insights/page.tsx`, fetch `const carry = await getCostOfCarry();` alongside the existing `getInsights` call. After the existing sections, render a `Card` titled `t("costOfCarryTitle")`: one row per `carry.lines` entry that has `costOfCarry !== null` — name, `formatMoney(l.costOfCarry, l.currency)`, `t("costOfCarryApr", { rate: l.apr })`, `l.periodEnd` — plus a footer row `t("costOfCarryTotal")`: `formatMoney(carry.totalBase, carry.baseCurrency)`. When no line has data, show `t("costOfCarryEmpty")`. Match the page's existing Card/typography patterns.

- [ ] **Step 3: Translations**

`Insights` namespace, both locales:

```json
"costOfCarryTitle": "Cost of carry",
"costOfCarryApr": "{rate}% APR",
"costOfCarryTotal": "Total ({currency})",
"costOfCarryEmpty": "Import a card statement to see what carrying your balances would cost.",
"costOfCarryAsOf": "as of {date}"
```

Spanish: `"costOfCarryTitle": "Costo de financiamiento"`, `"costOfCarryApr": "{rate}% anual"`, `"costOfCarryTotal": "Total ({currency})"`, `"costOfCarryEmpty": "Importa un estado de cuenta para ver cuánto costaría financiar tus balances."`, `"costOfCarryAsOf": "al {date}"`.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add lib/insights/queries.ts "app/(app)/insights/page.tsx" messages/en.json messages/es.json
git commit -m "feat(insights): cost-of-carry per credit line with base-currency total"
```

---

### Task 10: Transaction surfaces — card payments lose categories, statement rows constrained

**Files:**
- Modify: `components/transactions/transaction-form.tsx`
- Modify: `components/transactions/transaction-row.tsx` (statement badge)
- Modify: `app/(app)/transactions/actions.ts` (guard delete/update of statement rows)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `saveMerchantRule` (Task 7); `transactions.statement_line_id` (Task 1; present on `TransactionWithRefs` after type regen).

- [ ] **Step 1: Hide the category picker for payments into credit cards**

In `transaction-form.tsx`: `dst` is already computed (`accounts.find((a) => a.id === toAccountId)`). The category block currently renders for `type !== "income"`. Change its condition and add a cleanup effect:

```tsx
const cardPayment = type === "payment" && dst?.type === "credit_card";

// Payments into credit cards carry no category — the imported statement
// lines hold the real spending categories; a categorized payment would
// double-deduct the budget (spec §3.7).
useEffect(() => {
  if (cardPayment) setValue("category_id", "none");
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cardPayment]);
```

and render the category block only when `type !== "income" && !cardPayment`. (`QuickAddData` accounts already include `type` — verify with `grep -n "type" lib/transactions/queries.ts`; if the select omits it, add it.)

- [ ] **Step 2: Constrain statement-sourced rows in the edit form**

In `transaction-form.tsx`:

```tsx
const fromStatement = isEdit && !!transaction?.statement_line_id;
```

- Disable (`disabled={fromStatement}`) the type segmented control buttons, amount input, source-account select, date input, and description input when `fromStatement`. Category stays editable.
- Above the button, when `fromStatement`, show: `<p className="text-xs text-muted-foreground">{t("fromStatementHint")}</p>`.
- Add a merchant-rule checkbox (local `useState`, default false) rendered only when `fromStatement`: label `t("alwaysCategorizeMerchant", { merchant: transaction!.description ?? "" })`. In `onSubmit`, after a successful update, when checked and a category is set:

```ts
if (fromStatement && alwaysRule && values.category_id && values.category_id !== "none") {
  await saveMerchantRule(transaction!.description ?? "", values.category_id);
}
```

(import `saveMerchantRule` from `@/app/(app)/accounts/statement-actions`).

- [ ] **Step 3: Badge + server-side guards**

`transaction-row.tsx`: where the description/category line renders, add a small badge when `transaction.statement_line_id`:

```tsx
{transaction.statement_line_id ? (
  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
    {t("statementBadge")}
  </span>
) : null}
```

`app/(app)/transactions/actions.ts` — statement rows die only with their statement; edits may touch only category and notes:

```ts
async function statementGuard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<{ row: { statement_line_id: string | null; category_id: string | null; notes: string | null } | null }> {
  const { data } = await supabase
    .from("transactions")
    .select("statement_line_id,category_id,notes")
    .eq("id", id)
    .maybeSingle();
  return { row: data };
}
```

In `deleteTransaction`, before deleting:

```ts
const { row } = await statementGuard(supabase, id);
if (row?.statement_line_id) return { error: t("statementRowLocked") };
```

In `updateTransaction`, when the row is statement-sourced, write only the permitted fields instead of `toRow(...)`:

```ts
const { row } = await statementGuard(supabase, id);
if (row?.statement_line_id) {
  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateTransaction") };
  revalidate();
  return { id };
}
```

Add `"statementRowLocked"` to the `Common` namespace (`"This transaction comes from an imported statement. Delete the statement to remove it."` / es: `"Esta transacción proviene de un estado de cuenta importado. Elimina el estado de cuenta para quitarla."`).

- [ ] **Step 4: Translations**

`TransactionForm` (both locales):

```json
"fromStatementHint": "Imported from a statement — only the category and notes can change.",
"alwaysCategorizeMerchant": "Always use this category for \"{merchant}\""
```

`Transactions` (both locales): `"statementBadge": "Statement"` / es `"statementBadge": "Estado"`.

es for the form keys: `"fromStatementHint": "Importado de un estado de cuenta — solo la categoría y las notas pueden cambiar."`, `"alwaysCategorizeMerchant": "Usar siempre esta categoría para \"{merchant}\""`.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean.

```bash
git add components/transactions "app/(app)/transactions/actions.ts" messages/en.json messages/es.json lib/transactions/queries.ts
git commit -m "feat(transactions): statement-row constraints, card payments drop categories"
```

---

### Task 11: End-to-end verification and finish

**Files:** none new.

- [ ] **Step 1: Full static pass**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all clean. Fix anything that isn't before continuing.

- [ ] **Step 2: Live verification (REQUIRED — superpowers:verification-before-completion)**

Ask the user before starting/killing the dev server (their standing preference). Then, with the app running:

1. Import the Popular VISA PDF (password from the user/session) on its card page → preview shows 1 section, 38 transactions, 4 payments skipped → confirm → card balance shows **37,992.08**, anchor caption "as of 2026-06-25 statement…", statement in history with cost of carry 979.49 @ 40%.
2. Record a manual payment (checking → VISA) dated after 2026-06-25 → balance drops by exactly that amount.
3. Re-import the same PDF → transaction count unchanged (`select count(*)` per account or via the transactions page), balance unchanged.
4. Import the AMEX PDF on ANY of its three line pages (create the card group + 3 accounts first if the user hasn't) → mapping step lists 3 sections with sensible pre-fills → confirm → three statements land on three accounts; DOP balance 28,717.43, USD 1,831.32, Cuotas 0.00.
5. Budgets: verify a categorized payment to a card no longer moves any budget, while imported expenses do.
6. Insights: cost-of-carry section lists Popular DOP 979.49 @40%, AMEX DOP 223.15 @60%, AMEX USD 27.13 @60%, plus a base-currency total.
7. Transactions page: imported rows show the Statement badge; editing one only allows category/notes; deleting one is refused; deleting a statement removes its transactions and restores the pre-import balance state.

- [ ] **Step 3: Code review**

Use superpowers:requesting-code-review on the full branch diff against the spec.

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch. Per the user's standing memory: merge into main and delete the branch (local + remote) without asking.

---

## Self-Review Notes (already applied)

- Spec §2.1 anchor formula → Task 1 `recompute_card_balance`; §2.2 mapping → Tasks 1/7/8; §2.3 kinds → Tasks 3/4; §3.x schema → Task 1; §4 pipeline → Tasks 6/7; §5 categorization → Task 5 + Task 10 merchant-rule capture; §6.1 UI/removals → Task 8; §6.2 insights → Task 9; §6.3 badges/read-only → Task 10; §7 error table → Tasks 6/7 (password retry, unknown bank, checksum block, currency mismatch, replace-on-reimport, fx fallback rate 1).
- Type names used across tasks: `ParsedStatement/ParsedSection/ParsedLine/StatementParser` (Task 2) consumed verbatim in Tasks 3,4,6,7; `CardAccountOption` (7); `CardStatementRow` (8).
- The `statement_imports.status` check constraint intentionally omits the spec's `parsed_ok` — the two-step flow is stateless, so only terminal states are recorded (spec §3.1 status list is satisfied by `imported | failed_detection | failed_validation`).
