# Conversational Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A text box at `/ask` where someone asks about their own money in English or Spanish, and Gemini writes read-only SQL against four purpose-built views to answer with real figures.

**Architecture:** Four `security_invoker` views (`q_transactions`, `q_accounts`, `q_card_statements`, `q_budgets`) resolve every column ambiguity the base tables carry, and precompute the two different spend rules the codebase already has. One `stable` Postgres function executes the model's `SELECT` under the caller's RLS. A `streamText` loop with a single `askQuery` tool queries, refines, and answers, narrating each step in the UI from the `purpose` the model supplies with every query.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), AI SDK v7 (`ai`, `@ai-sdk/google`, `@ai-sdk/react`), Gemini 3.6 Flash, zod v4, next-intl, vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-20-conversational-queries-design.md`

## Global Constraints

- **Read-only, always.** No task in this plan may introduce a write path. If a step seems to need one, stop and raise it.
- **No service-role key on this path.** Every query runs through `createClient()` from `lib/supabase/server.ts`, which is cookie-authenticated, so RLS scopes rows to the caller.
- **Views are `with (security_invoker = true)`** — the pattern `monthly_cashflow` already uses.
- **Migrations are pushed by the human, never the agent.** The Supabase project is live and remote. Write the migration file, then stop and ask the user to run `npm run db:push` followed by `npm run db:types`.
- **Model:** `google(process.env.GOOGLE_ASK_MODEL ?? "gemini-3.6-flash")`. Do **not** reuse `GOOGLE_MODEL` — the other four call sites stay on `gemini-3.5-flash-lite`.
- **Budget:** `CHAT_INFERENCE_BUDGET_MS = 15_000` for the whole loop; `statement_timeout` 3s per query; `stopWhen: stepCountIs(3)`; `LIMIT 500` per result set.
- **Whitelisted relations, exactly:** `q_transactions`, `q_accounts`, `q_card_statements`, `q_budgets`.
- **Copy lives in `messages/en.json` and `messages/es.json`** under a new `Ask` namespace. Both files, every key, every time.
- **The in-app help guide moves with the feature** (`app/(app)/help/page.tsx` plus its `Help` message keys) — house rule.
- **Comment style:** this codebase explains *why* in prose comments, not *what*. Match it. See `lib/overview/recommendation/llm.ts` for the register.

---

### Task 1: The SQL guard

The security boundary, and the only part of it that is pure TypeScript. Built first because it needs no database, and because the human can push migrations in parallel with it.

**Files:**
- Create: `lib/ask/guard.ts`
- Test: `lib/ask/guard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export const ALLOWED_RELATIONS: readonly string[];
  export type GuardResult =
    | { ok: true; sql: string }
    | { ok: false; reason: string };
  export function guardSql(input: string): GuardResult;
  ```
  `sql` on success is the **comment-stripped, semicolon-trimmed** statement — Task 3's caller sends that, never the raw input.

- [ ] **Step 1: Write the failing test**

```ts
// lib/ask/guard.test.ts
import { describe, expect, it } from "vitest";
import { guardSql } from "./guard";

/** Convenience: assert rejection and surface the reason when it does not. */
function reject(sql: string): string {
  const r = guardSql(sql);
  if (r.ok) throw new Error(`expected rejection, got ok: ${r.sql}`);
  return r.reason;
}

describe("guardSql — accepts", () => {
  it("a plain select over a whitelisted view", () => {
    const r = guardSql("select sum(budget_spend) from q_transactions");
    expect(r).toEqual({
      ok: true,
      sql: "select sum(budget_spend) from q_transactions",
    });
  });

  it("a schema-qualified relation", () => {
    expect(guardSql("select 1 from public.q_accounts").ok).toBe(true);
  });

  it("joins across whitelisted views with aliases", () => {
    const sql =
      "select a.name, sum(t.budget_spend) from q_transactions t join q_accounts a on a.id = t.account_id group by a.name";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("a CTE, whose own name is not a whitelisted relation", () => {
    const sql =
      "with recent as (select * from q_transactions where occurred_at > '2026-08-01') select count(*) from recent";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("a subquery in the from position", () => {
    const sql = "select * from (select category from q_transactions) s";
    expect(guardSql(sql).ok).toBe(true);
  });

  /* Models end statements with a semicolon out of habit. Rejecting that would
     burn a whole step of the 3-step budget on a formatting nit. */
  it("a trailing semicolon, and strips it", () => {
    const r = guardSql("select 1 from q_budgets;  ");
    expect(r).toEqual({ ok: true, sql: "select 1 from q_budgets" });
  });

  it("strips comments rather than rejecting them", () => {
    const r = guardSql("select 1 from q_budgets -- monthly totals");
    expect(r).toEqual({ ok: true, sql: "select 1 from q_budgets" });
  });
});

describe("guardSql — rejects", () => {
  it.each([
    ["insert into q_transactions values (1)"],
    ["update q_accounts set name = 'x'"],
    ["delete from q_transactions"],
    ["drop view q_transactions"],
    ["truncate q_transactions"],
    ["grant select on q_transactions to anon"],
  ])("the write statement %s", (sql) => {
    expect(reject(sql)).toMatch(/not allowed|must be a select/i);
  });

  /* The whole point of stripping comments before analysis: a write hidden
     behind `--` must not reach the database as a second statement. */
  it("a write smuggled behind a comment", () => {
    expect(reject("select 1 from q_budgets; -- \n delete from q_transactions")).toMatch(
      /one statement|not allowed/i,
    );
  });

  it("a second statement", () => {
    expect(reject("select 1 from q_budgets; select 2 from q_budgets")).toMatch(
      /one statement/i,
    );
  });

  it("a base table, even though RLS would have allowed it", () => {
    expect(reject("select sum(base_total_amount) from transactions")).toMatch(
      /q_transactions|not available/i,
    );
  });

  it("the catalog", () => {
    expect(reject("select * from pg_catalog.pg_tables")).toMatch(/not allowed/i);
  });

  it("information_schema", () => {
    expect(reject("select * from information_schema.columns")).toMatch(/not allowed/i);
  });

  it("the auth schema", () => {
    expect(reject("select * from auth.users")).toMatch(/not allowed/i);
  });

  it("a CTE that shadows nothing but reads a base table", () => {
    expect(
      reject("with x as (select * from accounts) select * from x"),
    ).toMatch(/q_accounts|not available/i);
  });

  it("something that is not a query at all", () => {
    expect(reject("how much did I spend")).toMatch(/must be a select/i);
  });

  it("an empty string", () => {
    expect(reject("   ")).toMatch(/empty/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/ask/guard.test.ts`
Expected: FAIL — `Failed to resolve import "./guard"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/ask/guard.ts

/**
 * The only relations the model may read.
 *
 * This list is a correctness control before it is a security one. RLS already
 * makes every base table safe to read — what it does not do is stop the model
 * from summing `base_total_amount` off `transactions` and quietly returning a
 * number that includes transfers. The `q_` views resolve that ambiguity; the
 * whitelist is what makes reaching around them impossible rather than merely
 * discouraged.
 */
export const ALLOWED_RELATIONS = [
  "q_transactions",
  "q_accounts",
  "q_card_statements",
  "q_budgets",
] as const;

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

/* Whole words only, so `created_at` does not trip on `create` and `offset` does
   not trip on `set`.
   
   Known and accepted false positive: a legitimate `where description ilike
   '%update%'` is rejected. Merchants with a SQL keyword in the name are rare
   enough that loosening this to parse string literals would cost more safety
   than it buys usability. */
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|set|reset|vacuum|analyze|reindex|lock|merge|prepare|execute|listen|notify)\b/;

const FORBIDDEN_NAMESPACES = /\b(pg_[a-z_]*|information_schema|auth|storage|vault|extensions)\s*\./;

/** `from`/`join` followed by a relation — `(` means a subquery, not a name. */
const RELATION_RE = /\b(?:from|join)\s+(?!\()([a-z_][\w$]*(?:\.[a-z_][\w$]*)?)/g;

/** `with x as (` and `, y as (` — CTE names are legal relations downstream. */
const CTE_RE = /(?:\bwith\b|,)\s*([a-z_][\w$]*)\s+as\s*\(/g;

/**
 * Removes `--` line comments and `/* *\/` block comments.
 *
 * Stripping rather than rejecting, because models comment their SQL and losing
 * a step of a 3-step budget to that would be absurd. Stripping is also the
 * safer of the two: it is what stops `select 1; -- \n delete ...` from
 * presenting as a single statement to a naive semicolon count.
 */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decides whether one model-written string may be sent to `ask_query`.
 *
 * Layer one of four. The others — the `stable` function declaration, the
 * statement timeout, and RLS — live in Postgres and do not depend on this
 * regex being airtight. See the spec's Execution section.
 */
export function guardSql(input: string): GuardResult {
  const sql = stripComments(input ?? "").replace(/;+\s*$/, "").trim();

  if (!sql) return { ok: false, reason: "The query was empty." };

  if (sql.includes(";")) {
    return { ok: false, reason: "Only one statement is allowed." };
  }

  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, reason: "The query must be a SELECT." };
  }

  if (FORBIDDEN_KEYWORDS.test(sql.toLowerCase())) {
    return { ok: false, reason: "That keyword is not allowed — this is read-only." };
  }

  if (FORBIDDEN_NAMESPACES.test(sql.toLowerCase())) {
    return { ok: false, reason: "That schema is not allowed." };
  }

  const lower = sql.toLowerCase();

  const ctes = new Set<string>();
  for (const m of lower.matchAll(CTE_RE)) ctes.add(m[1]);

  for (const m of lower.matchAll(RELATION_RE)) {
    const bare = m[1].replace(/^public\./, "");
    if (ctes.has(bare)) continue;
    if (!(ALLOWED_RELATIONS as readonly string[]).includes(bare)) {
      return {
        ok: false,
        reason: `"${bare}" is not available. Query only: ${ALLOWED_RELATIONS.join(", ")}.`,
      };
    }
  }

  return { ok: true, sql };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/ask/guard.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add lib/ask/guard.ts lib/ask/guard.test.ts
git commit -m "feat(ask): guard model-written SQL to read-only q_ views"
```

---

### Task 2: The `q_` view layer

**Files:**
- Create: `supabase/migrations/<timestamp>_ask_views.sql` (generate the name with `npm run db:new ask_views`)
- Modify: `lib/supabase/types.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: `ALLOWED_RELATIONS` from Task 1 — the four view names must match it exactly.
- Produces: views `public.q_transactions`, `public.q_accounts`, `public.q_card_statements`, `public.q_budgets`, and their generated row types in `lib/supabase/types.ts` under `Views`.

- [ ] **Step 1: Create the migration file**

Run: `npm run db:new ask_views`

- [ ] **Step 2: Write the views**

```sql
-- The schema the model reads. Four views that exist because the base tables
-- encode storage, not meaning.
--
-- `transactions` carries four money columns differing by fees, tax, and FX, and
-- puts transfers between a person's own accounts in the same table as real
-- spending. Which column is correct depends on the question, and this codebase
-- already contains two different right answers: `spend_distribution` counts
-- expense+payment minus excluded rows, while `monthly_cashflow` counts what
-- actually left an account (a card expense is borrowed, so it has not).
--
-- Handing a model that column list produces syntactically perfect SQL and a
-- confidently wrong number — the worst failure available, because nothing looks
-- broken. So both rules arrive here precomputed, as columns that say what they
-- mean and that a SUM() cannot get wrong.
--
-- security_invoker throughout: RLS on the base tables scopes every row to the
-- caller, exactly as `monthly_cashflow` does.

create or replace view public.q_transactions
with (security_invoker = true) as
select
  t.id,
  t.user_id,
  t.occurred_at,
  t.type,
  t.description,
  t.notes,
  t.account_id,
  a.name    as account,
  a.type    as account_type,
  a.brand   as account_brand,
  a.last4   as account_last4,
  b.name    as bank,
  t.to_account_id,
  da.name   as to_account,
  da.type   as to_account_type,
  t.category_id,
  c.name    as category,
  t.subscription_id,
  s.name    as subscription,
  t.currency,
  t.amount,
  t.total_amount,
  p.base_currency,
  t.base_amount,
  t.base_total_amount,
  -- Mirrors public.spend_distribution / public.category_usage exactly.
  case
    when t.type in ('expense', 'payment') and not t.exclude_from_budget
      then t.base_total_amount
    else 0
  end as budget_spend,
  -- Mirrors public.monthly_cashflow's `expense` arm exactly.
  case
    when t.type = 'expense' and a.type not in ('credit_card', 'loan')
      then t.base_total_amount
    when t.type = 'payment' and da.type in ('credit_card', 'loan')
      then t.base_total_amount
    else 0
  end as cash_out,
  case when t.type = 'income' then t.base_amount else 0 end as cash_in,
  t.exclude_from_budget,
  t.fx_fallback,
  -- Free merchant-category signal on anything that arrived by statement import.
  sl.mcc
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts da on da.id = t.to_account_id
left join public.banks b on b.id = a.bank_id
left join public.categories c on c.id = t.category_id
left join public.subscriptions s on s.id = t.subscription_id
left join public.card_statement_lines sl on sl.id = t.statement_line_id
left join public.profiles p on p.id = t.user_id;

-- One row per account with live status folded in, so account questions answer
-- without a second hop. This is also what makes "my Amex Platinum" resolvable:
-- the model matches on name, brand, or last4 and gets an account_id to filter
-- q_transactions by.
create or replace view public.q_accounts
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.type,
  a.brand,
  a.last4,
  b.name  as bank,
  cg.name as card_group,
  a.currency,
  a.is_archived,
  ab.balance,
  a.starting_balance,
  a.current_balance,
  cs.credit_limit,
  cs.owed,
  cs.utilization_pct,
  cs.latest_statement_balance,
  cs.latest_due_date,
  cs.latest_period_end,
  a.statement_closing_day,
  a.payment_due_day,
  a.interest_rate,
  ls.outstanding_balance,
  ls.installment_amount,
  ls.installments_paid,
  ls.term_months,
  ls.original_term_months,
  ls.principal,
  a.start_date
from public.accounts a
left join public.banks b on b.id = a.bank_id
left join public.card_groups cg on cg.id = a.card_group_id
left join public.account_balances ab on ab.account_id = a.id
left join public.card_status cs on cs.account_id = a.id
left join public.loan_status ls on ls.account_id = a.id;

-- Statement-level facts are read, not re-derived from lines.
create or replace view public.q_card_statements
with (security_invoker = true) as
select
  st.id,
  st.user_id,
  st.account_id,
  a.name as account,
  st.period_start,
  st.period_end,
  st.due_date,
  st.statement_balance,
  st.minimum_payment,
  st.previous_balance,
  st.total_debits,
  st.total_credits,
  st.cashback_total,
  st.interest_rate_annual,
  st.avg_daily_balance,
  st.cost_of_carry,
  st.credit_limit,
  st.available_credit,
  st.overdue_amount,
  st.source
from public.card_statements st
join public.accounts a on a.id = st.account_id;

-- public.category_usage generalised off its p_month-only signature: every
-- month at once, so the model can compare them.
create or replace view public.q_budgets
with (security_invoker = true) as
select
  cb.user_id,
  cb.month,
  cb.category_id,
  c.name as category,
  cb.amount as budget,
  coalesce(u.used, 0) as used,
  cb.amount - coalesce(u.used, 0) as remaining
from public.category_budgets cb
join public.categories c on c.id = cb.category_id
left join lateral (
  select sum(t.base_total_amount) as used
  from public.transactions t
  where t.category_id = cb.category_id
    and t.user_id = cb.user_id
    and t.type in ('expense', 'payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', cb.month)::date
) u on true;
```

- [ ] **Step 3: Hand the migration to the user**

The agent cannot push to the live project. Stop here and say:

> Migration written to `supabase/migrations/<name>.sql`. Please run `npm run db:push` and then `npm run db:types`, and tell me when it's through.

Do not proceed to Step 4 until they confirm.

- [ ] **Step 4: Verify the views agree with the screens**

The views are only correct if they reproduce what the app already shows. Ask the user to run these against the live project with `supabase db query --linked` and paste the output. Both must return zero rows.

```sql
-- budget_spend must reproduce spend_distribution for any month with data.
with mine as (
  select date_trunc('month', occurred_at)::date as m from public.q_transactions
  group by 1 order by 1 desc limit 1
)
select d.category_id, d.total, q.total as q_total
from mine,
     lateral public.spend_distribution(mine.m) d
full join lateral (
  select category_id, sum(budget_spend) as total
  from public.q_transactions
  where date_trunc('month', occurred_at)::date = mine.m and category_id is not null
  group by category_id
) q on q.category_id = d.category_id
where d.total is distinct from q.total;

-- cash_out must reproduce monthly_cashflow.expense.
select mc.month, mc.expense, q.expense as q_expense
from public.monthly_cashflow mc
join (
  select date_trunc('month', occurred_at)::date as month, sum(cash_out) as expense
  from public.q_transactions group by 1
) q on q.month = mc.month
where mc.expense is distinct from q.expense;
```

If either returns rows, the view logic is wrong — fix the migration and go back to Step 3 rather than continuing. A view that disagrees with the screens makes the whole feature wrong no matter how good the model is.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations lib/supabase/types.ts
git commit -m "feat(ask): add the q_ view layer the model queries"
```

---

### Task 3: The `ask_query` executor

**Files:**
- Create: `supabase/migrations/<timestamp>_ask_query.sql` (`npm run db:new ask_query`)
- Modify: `lib/supabase/types.ts` (regenerated)

**Interfaces:**
- Consumes: the four views from Task 2.
- Produces: `public.ask_query(p_sql text) returns jsonb`, shaped `{ "rows": [...], "truncated": boolean }`. Task 5 calls it via `supabase.rpc("ask_query", { p_sql })`.

- [ ] **Step 1: Create the migration file**

Run: `npm run db:new ask_query`

- [ ] **Step 2: Write the function**

```sql
-- Executes one model-written SELECT against the q_ views.
--
-- `stable` is the guard that matters. Postgres refuses to run a data-modifying
-- statement inside a non-volatile function, EXECUTE included, so a string that
-- beats the TypeScript regex in lib/ask/guard.ts still cannot write — the
-- engine raises instead. That is a property of this declaration rather than a
-- pattern match, which is why it outranks the denylist in front of it.
--
-- `security invoker` puts it under the caller's auth.uid(), so RLS on the base
-- tables behind the views is the same isolation every screen already trusts.
-- No service-role key touches this path.
--
-- The row cap protects the model's context window more than the database: ten
-- thousand rows coming back is a worse problem than a slow query. 501 are
-- fetched so that hitting the cap is detectable, and `truncated` tells the
-- model to narrow or aggregate rather than report a total it only partly saw.
create or replace function public.ask_query(p_sql text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform set_config('statement_timeout', '3000', true);

  execute format(
    'select coalesce(jsonb_agg(r), ''[]''::jsonb) from (select * from (%s) x limit 501) r',
    p_sql
  ) into v_rows;

  if jsonb_array_length(v_rows) > 500 then
    return jsonb_build_object(
      'rows', (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality t(e, i) where i <= 500),
      'truncated', true
    );
  end if;

  return jsonb_build_object('rows', v_rows, 'truncated', false);
end;
$$;

revoke all on function public.ask_query(text) from public, anon;
grant execute on function public.ask_query(text) to authenticated;
```

- [ ] **Step 3: Hand the migration to the user**

Stop and say:

> Migration written to `supabase/migrations/<name>.sql`. Please run `npm run db:push` and then `npm run db:types`.

- [ ] **Step 4: Prove the `stable` guarantee before depending on it**

This is the plan's one unverified assumption and it is the primary security guard. Ask the user to run these with `supabase db query --linked` and paste the output verbatim.

```sql
-- Must succeed and return rows.
select public.ask_query('select count(*) as n from public.q_transactions');

-- Must FAIL. Expected: ERROR ... "INSERT is not allowed in a non-volatile function"
select public.ask_query(
  'insert into public.categories (user_id, name) values ((select auth.uid()), ''guard-probe'') returning id'
);

-- Must FAIL for the same reason.
select public.ask_query('delete from public.categories where name = ''guard-probe''');

-- Must return zero rows — proof nothing was written even if an error was raised late.
select id from public.categories where name = 'guard-probe';
```

**If the write does NOT error**, stop the whole plan and report it. The design's four-layer guard collapses to a regex, and that is not adequate — the spec says so explicitly. Do not continue to Task 5.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations lib/supabase/types.ts
git commit -m "feat(ask): add the read-only SQL executor"
```

---

### Task 4: The schema document and its drift test

**Files:**
- Create: `lib/ask/schema-doc.md`
- Create: `lib/ask/schema-doc.ts`
- Test: `lib/ask/schema-doc.test.ts`

**Interfaces:**
- Consumes: the view row types generated into `lib/supabase/types.ts` by Tasks 2 and 3.
- Produces:
  ```ts
  export function schemaDoc(): string;          // the markdown, read from disk
  export function documentedColumns(): Map<string, string[]>;  // view -> columns named in the doc
  ```

- [ ] **Step 1: Write the schema document**

A file rather than a template literal because it is the highest-churn artifact in the feature: every wrong answer's fix is a sentence here, not a code change.

```markdown
<!-- lib/ask/schema-doc.md -->
# The data you can query

You may query these four views and nothing else. They are already scoped to one
person — never filter by `user_id`, and never mention it.

## q_transactions

One row per transaction.

| column | meaning |
| --- | --- |
| `id`, `occurred_at`, `type` | `type` is `expense`, `income`, or `payment`. |
| `description`, `notes` | Free text. Merchant names live in `description`. |
| `account_id`, `account`, `account_type`, `account_brand`, `account_last4`, `bank` | The account the money moved from. `account_type` is `checking`, `savings`, `cash`, `investment`, `asset`, `credit_card`, or `loan`. |
| `to_account_id`, `to_account`, `to_account_type` | Set when this moved money to another of their own accounts. |
| `category_id`, `category`, `subscription_id`, `subscription` | `category` is null when the transaction has not been categorised yet. |
| `currency`, `amount`, `total_amount` | As charged. `total_amount` includes fees and tax. |
| `base_currency`, `base_amount`, `base_total_amount` | Converted to their base currency. |
| `budget_spend` | **Use this for "how much did I spend".** |
| `cash_out` | **Use this for "how much left my account".** |
| `cash_in` | Income. |
| `exclude_from_budget`, `fx_fallback`, `mcc` | `mcc` is the merchant category code, present only on imported statement rows. |

### budget_spend vs cash_out

These answer different questions and are both already correct — never build
either one yourself out of the raw amount columns.

`budget_spend` is what the app's budget and category screens count: expenses and
card payments, minus anything flagged as excluded. Use it for spending by
category, spending against a budget, "what did I spend on X".

`cash_out` is money that actually left an account. **A credit-card purchase is
borrowed, not spent cash**, so it is zero in `cash_out` and only counts when the
card is paid. Use it for cashflow, "how much did I actually pay out", runway.

Sum the column. Do not re-derive either rule.

## q_accounts

One row per account. To find an account someone names in words, match
case-insensitively across `name`, `brand`, and `last4` — "my Amex Platinum"
might be any of the three. Then filter `q_transactions` by the `id` you found.

Columns: `id`, `name`, `type`, `brand`, `last4`, `bank`, `card_group`,
`currency`, `is_archived`, `balance`, `starting_balance`, `current_balance`,
`credit_limit`, `owed`, `utilization_pct`, `latest_statement_balance`,
`latest_due_date`, `latest_period_end`, `statement_closing_day`,
`payment_due_day`, `interest_rate`, `outstanding_balance`,
`installment_amount`, `installments_paid`, `term_months`,
`original_term_months`, `principal`, `start_date`.

Card fields are null on non-cards; loan fields are null on non-loans.
`is_archived` accounts are closed — exclude them unless asked about history.

## q_card_statements

One row per statement period, per card. Read these rather than re-deriving them
from transactions.

Columns: `id`, `account_id`, `account`, `period_start`, `period_end`,
`due_date`, `statement_balance`, `minimum_payment`, `previous_balance`,
`total_debits`, `total_credits`, `cashback_total`, `interest_rate_annual`,
`avg_daily_balance`, `cost_of_carry`, `credit_limit`, `available_credit`,
`overdue_amount`, `source`.

## q_budgets

One row per month per budgeted category.

Columns: `month`, `category_id`, `category`, `budget`, `used`, `remaining`.
`month` is the first day of the month. A category with no budget set has no row.
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/ask/schema-doc.test.ts
import { describe, expect, it } from "vitest";
import { schemaDoc, documentedColumns } from "./schema-doc";
import { ALLOWED_RELATIONS } from "./guard";

describe("schemaDoc", () => {
  it("names every whitelisted view", () => {
    const doc = schemaDoc();
    for (const view of ALLOWED_RELATIONS) expect(doc).toContain(view);
  });

  /* The document is prose and the views are SQL, so nothing forces them to
     agree. Drift shows up as the model confidently selecting a column that
     used to exist, which reads as a model failure and is not one. */
  it("documents every whitelisted view and its key columns", () => {
    const documented = documentedColumns();
    expect([...documented.keys()].sort()).toEqual([...ALLOWED_RELATIONS].sort());

    // Every documented view must document at least its key columns.
    expect(documented.get("q_transactions")).toContain("budget_spend");
    expect(documented.get("q_transactions")).toContain("cash_out");
    expect(documented.get("q_accounts")).toContain("last4");
    expect(documented.get("q_budgets")).toContain("remaining");
  });

  it("tells the model which column answers a spending question", () => {
    expect(schemaDoc()).toMatch(/budget_spend[\s\S]{0,200}how much did I spend/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/ask/schema-doc.test.ts`
Expected: FAIL — `Failed to resolve import "./schema-doc"`.

- [ ] **Step 4: Write the implementation**

```ts
// lib/ask/schema-doc.ts
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The prose half of the model's schema knowledge, kept beside the migration
 * that defines the views so the two move together.
 *
 * Read from disk rather than imported as a string so that correcting a wrong
 * answer is a text edit, not a code change. Cached after the first read — the
 * file cannot change under a running process.
 */
let cached: string | null = null;

export function schemaDoc(): string {
  cached ??= readFileSync(join(process.cwd(), "lib/ask/schema-doc.md"), "utf8");
  return cached;
}

/**
 * Every column name the document claims exists, per view.
 *
 * Parsed out of the markdown rather than maintained separately, because a
 * second list would drift from the first exactly as fast as the first drifts
 * from the database. Backticked identifiers under each `## view` heading.
 */
export function documentedColumns(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sections = schemaDoc().split(/^## /m).slice(1);

  for (const section of sections) {
    const view = section.split(/\s/)[0].trim();
    if (!view.startsWith("q_")) continue;
    const names = [...section.matchAll(/`([a-z_][a-z0-9_]*)`/g)].map((m) => m[1]);
    out.set(view, [...new Set(names)]);
  }

  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/ask/schema-doc.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ask/schema-doc.md lib/ask/schema-doc.ts lib/ask/schema-doc.test.ts
git commit -m "feat(ask): document the q_ views for the model, with a drift test"
```

---

### Task 5: The tool and the prompt

**Files:**
- Create: `lib/ask/tools.ts`
- Create: `lib/ask/prompt.ts`
- Test: `lib/ask/prompt.test.ts`
- Modify: `lib/llm/budget.ts` (append one constant)
- Modify: `.env.example` (add `GOOGLE_ASK_MODEL`)

**Interfaces:**
- Consumes: `guardSql`, `GuardResult` (Task 1); `schemaDoc()` (Task 4); `ask_query` RPC (Task 3); `createClient()` from `lib/supabase/server.ts`.
- Produces:
  ```ts
  // lib/ask/prompt.ts
  export function systemPrompt(ctx: {
    today: string;          // ISO date, server-supplied
    baseCurrency: string;
    language: string;       // "English" | "Spanish"
  }): string;
  export const LANGUAGE: Record<string, string>;

  // lib/ask/tools.ts
  export function askTools(): { askQuery: Tool };
  export const CHAT_MAX_STEPS = 3;
  ```

- [ ] **Step 1: Add the budget constant**

Append to `lib/llm/budget.ts`, matching the file's existing comment register:

```ts
/**
 * For the one inference the user actually sits and waits for.
 *
 * Bounds the WHOLE multi-step loop, not one call, so three tool round-trips
 * share it. Short on purpose: a chat that answers in eight seconds and
 * sometimes gives up beats one that might answer in forty.
 *
 * This is the budget the cold-call problem documented above actually bites.
 * 15s loses a cold call outright, which is why the /ask route warms the
 * process on mount and on input focus rather than discovering it on send.
 */
export const CHAT_INFERENCE_BUDGET_MS = 15_000;
```

- [ ] **Step 2: Write the failing prompt test**

```ts
// lib/ask/prompt.test.ts
import { describe, expect, it } from "vitest";
import { systemPrompt, LANGUAGE } from "./prompt";

const ctx = { today: "2026-08-20", baseCurrency: "DOP", language: "English" };

describe("systemPrompt", () => {
  /* A model asked what day it is answers from training data, which silently
     corrupts every "last month" and "this week" question in the product. The
     date is injected for exactly this reason, so its absence is a bug worth a
     test rather than a comment. */
  it("states today's date", () => {
    expect(systemPrompt(ctx)).toContain("2026-08-20");
  });

  it("states the base currency", () => {
    expect(systemPrompt(ctx)).toContain("DOP");
  });

  it("names the language to answer in", () => {
    expect(systemPrompt({ ...ctx, language: "Spanish" })).toContain("Spanish");
  });

  it("carries the schema document", () => {
    expect(systemPrompt(ctx)).toContain("q_transactions");
    expect(systemPrompt(ctx)).toContain("budget_spend");
  });

  it("forbids advice, matching the house rule", () => {
    expect(systemPrompt(ctx)).toMatch(/investment, tax/i);
  });
});

describe("LANGUAGE", () => {
  it("covers both app locales", () => {
    expect(LANGUAGE.en).toBe("English");
    expect(LANGUAGE.es).toBe("Spanish");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/ask/prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./prompt"`.

- [ ] **Step 4: Write the prompt**

```ts
// lib/ask/prompt.ts
import { schemaDoc } from "./schema-doc";

/* Same map as lib/overview/recommendation/llm.ts: next-intl gives a locale, the
   model needs a language it recognises by name, and an unknown locale falls
   back to English rather than to a raw code it would try to interpret. */
export const LANGUAGE: Record<string, string> = { en: "English", es: "Spanish" };

export function systemPrompt(ctx: {
  today: string;
  baseCurrency: string;
  language: string;
}): string {
  return `You answer questions about one person's own money, inside their personal finance app. You have one tool: askQuery, which runs a read-only SQL SELECT against the views described below and returns rows.

Today is ${ctx.today}. Use it for every relative date — "last month", "this week", "the 8th to the 14th" — and never guess the date from anything else.

Their base currency is ${ctx.baseCurrency}. Amounts in the base_* columns are already converted to it.

Write in ${ctx.language}. Every word you return must be in ${ctx.language}.

How to work:
- Query first, answer second. Never state a figure you have not read from a query result.
- You get at most 3 tool calls. Prefer one query that aggregates over several that fetch rows and add them up yourself.
- Aggregate in SQL. SUM, COUNT, GROUP BY, date_trunc — the database is better at arithmetic than you are.
- If a query errors, read the message and fix the SQL. That is what the remaining calls are for.
- If a result comes back truncated, narrow it or aggregate it rather than reporting a partial total as a whole one.

How to answer:
- Lead with the number they asked for, with its currency. Then at most a sentence or two of context.
- Use only figures your queries returned. A difference or a percentage of two returned figures is fine; anything else is not.
- If the data cannot answer the question, say so plainly and say what is missing. Never fill a gap with an estimate.
- If a result is empty, say there is nothing recorded rather than reporting zero as a fact about their spending.
- No investment, tax, or legal advice. Do not name financial products or services beyond what is in their data.
- Do not describe your SQL, your tables, or your process. They asked about money, not about a database.

${schemaDoc()}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/ask/prompt.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the tool**

```ts
// lib/ask/tools.ts
import "server-only";
import { z } from "zod";
import { tool } from "ai";
import { createClient } from "@/lib/supabase/server";
import { guardSql } from "./guard";

/**
 * Three, against a 15s budget for the whole loop.
 *
 * One call answers most questions; the second exists so a failed query can be
 * corrected rather than surrendered; the third is slack. A fourth would mostly
 * buy the model room to wander.
 */
export const CHAT_MAX_STEPS = 3;

/**
 * The model's one tool.
 *
 * `purpose` is required and is not a debug field. It is the copy the loading
 * state renders while the query runs, which is what keeps a 15s ceiling from
 * reading as a stall — and asking for it demonstrably sharpens the SQL that
 * comes with it.
 *
 * Errors are returned, never thrown. For free-form SQL that is essential
 * rather than defensive: first attempts get a column name wrong, and
 * self-correction on the next step is the difference between "I could not
 * answer that" and a right answer a second later.
 */
export function askTools() {
  return {
    askQuery: tool({
      description:
        "Run one read-only SQL SELECT against the q_ views and return the rows.",
      inputSchema: z.object({
        sql: z.string().describe("A single SELECT statement. No semicolons, no writes."),
        purpose: z
          .string()
          .describe(
            "One short line, in the user's language, saying what this query is for. Shown to them while it runs.",
          ),
      }),
      execute: async ({ sql }) => {
        const guarded = guardSql(sql);
        if (!guarded.ok) return { error: guarded.reason };

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("ask_query", { p_sql: guarded.sql });

        if (error) return { error: error.message };
        return data;
      },
    }),
  };
}
```

- [ ] **Step 7: Add the env var**

Append to `.env.example`:

```
GOOGLE_ASK_MODEL=gemini-3.6-flash
```

- [ ] **Step 8: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/ask/tools.ts lib/ask/prompt.ts lib/ask/prompt.test.ts lib/llm/budget.ts .env.example
git commit -m "feat(ask): add the query tool and system prompt"
```

---

### Task 6: The route

**Files:**
- Create: `app/api/ask/route.ts`
- Create: `app/api/ask/warm/route.ts`

**Interfaces:**
- Consumes: `askTools`, `CHAT_MAX_STEPS` (Task 5); `systemPrompt`, `LANGUAGE` (Task 5); `CHAT_INFERENCE_BUDGET_MS` (Task 5).
- Produces: `POST /api/ask` returning a UI message stream for `useChat`; `GET /api/ask/warm` returning `204`.

- [ ] **Step 1: Write the chat route**

The app's first route handler — everything else is server components and actions — because streaming needs one.

```ts
// app/api/ask/route.ts
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CHAT_INFERENCE_BUDGET_MS, inferenceSignal } from "@/lib/llm/budget";
import { systemPrompt, LANGUAGE } from "@/lib/ask/prompt";
import { askTools, CHAT_MAX_STEPS } from "@/lib/ask/tools";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();

  /* No .eq("id", ...) — RLS scopes the row, as lib/overview/queries.ts does. */
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();

  const locale = await getLocale();

  const result = streamText({
    model: google(process.env.GOOGLE_ASK_MODEL ?? "gemini-3.6-flash"),
    system: systemPrompt({
      today: new Date().toISOString().slice(0, 10),
      baseCurrency: profile?.base_currency ?? "DOP",
      language: LANGUAGE[locale] ?? LANGUAGE.en,
    }),
    messages: convertToModelMessages(messages),
    tools: askTools(),
    stopWhen: stepCountIs(CHAT_MAX_STEPS),
    abortSignal: inferenceSignal(CHAT_INFERENCE_BUDGET_MS),
  });

  return result.toUIMessageStreamResponse();
}
```

- [ ] **Step 2: Write the warming route**

```ts
// app/api/ask/warm/route.ts

/**
 * Pays the cold-start cost while the user is still typing.
 *
 * lib/llm/budget.ts records that the first inference call in a fresh Node
 * process takes 9 to 70 seconds against ~600ms warm, and that a plain fetch to
 * the host beforehand is enough to fix it. Every other LLM feature here absorbs
 * that quietly — a card colour arrives late and nobody notices. Chat is the one
 * surface where a person sits watching a cursor, and a 15s budget loses a cold
 * call outright, so the cost is moved off the critical path instead.
 */
export async function GET() {
  try {
    await fetch("https://generativelanguage.googleapis.com/", {
      method: "HEAD",
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // Warming is best-effort; a failure here costs latency, never correctness.
  }
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 3: Install the React binding**

`@ai-sdk/react` is not currently installed — only `ai`, `@ai-sdk/google`, and their transitive deps.

Run: `npm install @ai-sdk/react`

- [ ] **Step 4: Verify the route compiles**

Run: `npx tsc --noEmit`
Expected: PASS, no errors in `app/api/ask/`.

- [ ] **Step 5: Commit**

```bash
git add app/api/ask package.json package-lock.json
git commit -m "feat(ask): add the streaming chat route and a warming endpoint"
```

---

### Task 7: The `/ask` page

**Files:**
- Create: `app/(app)/ask/page.tsx`
- Create: `components/ask/ask-chat.tsx`
- Modify: `lib/nav.ts` (add the nav item)
- Modify: `messages/en.json`, `messages/es.json` (new `Ask` namespace, plus `Nav.ask`)

**Interfaces:**
- Consumes: `POST /api/ask` and `GET /api/ask/warm` (Task 6).
- Produces: the `/ask` route and its nav entry.

- [ ] **Step 1: Add the copy**

`messages/en.json` — new top-level `Ask` namespace, and `ask` inside the existing `Nav` namespace:

```json
"Nav": { "ask": "Ask" },
"Ask": {
  "title": "Ask",
  "description": "Ask about your money in your own words.",
  "placeholder": "How much did I spend on transportation last month?",
  "send": "Ask",
  "emptyTitle": "Ask anything about your own numbers",
  "emptyHint": "Try: what went on my Amex between the 8th and the 14th?",
  "thinking": "Working on it…",
  "timeout": "That one is taking too long — try a narrower date range.",
  "error": "Something went wrong. Try asking again.",
  "readOnly": "Read-only — this can look at your data but never change it."
}
```

`messages/es.json` — the same keys:

```json
"Nav": { "ask": "Preguntar" },
"Ask": {
  "title": "Preguntar",
  "description": "Pregunta sobre tu dinero con tus propias palabras.",
  "placeholder": "¿Cuánto gasté en transporte el mes pasado?",
  "send": "Preguntar",
  "emptyTitle": "Pregunta lo que quieras sobre tus números",
  "emptyHint": "Prueba: ¿qué se cargó a mi Amex entre el 8 y el 14?",
  "thinking": "Trabajando en ello…",
  "timeout": "Esto está tardando demasiado — prueba con un rango de fechas más corto.",
  "error": "Algo salió mal. Intenta preguntar de nuevo.",
  "readOnly": "Solo lectura — puede ver tus datos, nunca cambiarlos."
}
```

- [ ] **Step 2: Add the nav entry**

In `lib/nav.ts`, import `MessageCircleQuestion` from `lucide-react` and insert into `NAV_ITEMS` after the `/insights` entry:

```ts
  { href: "/ask", key: "ask", icon: MessageCircleQuestion },
```

Leave `MOBILE_NAV_ITEMS` alone — it is a deliberate five-cell layout documented in that file, and adding a sixth would break it.

- [ ] **Step 3: Write the chat component**

The loading state is the point of this file. Because the model supplies `purpose` with every query, the wait is narrated rather than spun.

```tsx
// components/ask/ask-chat.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";

export function AskChat() {
  const t = useTranslations("Ask");
  const [input, setInput] = useState("");
  const warmed = useRef(false);
  const { messages, sendMessage, status, error } = useChat({ api: "/api/ask" });

  /* Pays the cold start while they are still reading the page. See
     app/api/ask/warm/route.ts for why this is not premature. */
  function warm() {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/ask/warm");
  }
  useEffect(warm, []);

  const busy = status === "submitted" || status === "streaming";

  /* The narration: the purpose of the most recent tool call, which the model
     writes in the user's language. Falls back to a generic line only for the
     gap before the first tool call arrives. */
  const narration = (() => {
    const last = messages.at(-1);
    if (!busy || last?.role !== "assistant") return busy ? t("thinking") : null;
    const calls = last.parts.filter((p) => p.type === "tool-askQuery");
    const latest = calls.at(-1) as { input?: { purpose?: string } } | undefined;
    return latest?.input?.purpose ?? t("thinking");
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="font-medium text-foreground">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
          </Card>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "self-end max-w-[85%]" : "max-w-[85%]"}
          >
            <Card className={m.role === "user" ? "bg-muted p-3" : "p-4"}>
              {m.parts
                .filter((p) => p.type === "text")
                .map((p, i) => (
                  <p key={i} className="whitespace-pre-wrap text-sm">
                    {"text" in p ? p.text : null}
                  </p>
                ))}
            </Card>
          </div>
        ))}

        {narration ? (
          <p className="animate-pulse text-sm text-muted-foreground" aria-live="polite">
            {narration}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive">
            {/* An aborted stream is the 15s budget expiring, which has its own
                actionable copy; anything else is a real failure. */}
            {error.name === "AbortError" ? t("timeout") : t("error")}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={warm}
          placeholder={t("placeholder")}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

```tsx
// app/(app)/ask/page.tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AskChat } from "@/components/ask/ask-chat";

export default async function AskPage() {
  const t = await getTranslations("Ask");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <AskChat />
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 6: Verify it in the browser**

Ask the user before starting the dev server — house rule.

Once running, drive it with `agent-browser` using a named session:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix tywin-ask)"
agent-browser --session "$SESSION" --restore open http://localhost:3000/ask
agent-browser --session "$SESSION" snapshot -i
```

Ask the real question — "how much did I spend on transportation last month?" — and confirm three things: narration text appears while it works and reads as a sentence about their money rather than a spinner, the answer names a figure with a currency, and the figure matches what the Budgets screen shows for that category and month. Then `agent-browser --session "$SESSION" close`.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/ask components/ask lib/nav.ts messages/en.json messages/es.json
git commit -m "feat(ask): add the /ask page with narrated loading"
```

---

### Task 8: The help guide

**Files:**
- Modify: `app/(app)/help/page.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Help` namespace)

**Interfaces:**
- Consumes: the shipped behaviour of Tasks 1–7.
- Produces: nothing other code reads.

- [ ] **Step 1: Read the existing help page**

Read `app/(app)/help/page.tsx` and the `Help` namespace in `messages/en.json`. The namespace is flat, keyed `<section>Title` / `<section>Intro` / detail keys, with `<section>Mock*` keys feeding a small rendered mock beside each section. The product is called **Cashly** in this copy, never "Tywin". Match that structure — do not invent a new pattern.

- [ ] **Step 2: Add the copy**

Insert into the `Help` namespace of `messages/en.json`, positioned after the `insights*` keys so it reads in nav order:

```json
"askTitle": "Ask",
"askIntro": "A text box that answers questions about your own numbers in plain words — English or Spanish, whichever you're using. Cashly reads your data to answer, and writes a short reply with the real figures in it.",
"askAnswers": "Good questions: spending by category over any date range, what went on one specific card between two dates, what a balance is now, what's due and when, how a month tracked against its budget.",
"askReadOnly": "It can only read. There is no question you can ask that changes a transaction, a budget, or an account — and it only ever sees your own data, never anyone else's.",
"askLimits": "It answers from what's recorded. If you haven't imported a statement or logged a transaction, it can't know about it — and it will say so rather than guess.",
"askMockQuestion": "How much did I spend on transportation last month?",
"askMockNarration": "Adding up transportation for July…",
"askMockAnswer": "RD$8,420 across 14 transactions — about 12% more than June."
```

Mirror all seven keys into `messages/es.json`:

```json
"askTitle": "Preguntar",
"askIntro": "Un cuadro de texto que responde preguntas sobre tus propios números en lenguaje natural — en inglés o español, el que estés usando. Cashly lee tus datos para responder y escribe una respuesta corta con las cifras reales.",
"askAnswers": "Buenas preguntas: gastos por categoría en cualquier rango de fechas, qué se cargó a una tarjeta específica entre dos fechas, cuál es un saldo ahora, qué vence y cuándo, cómo fue un mes frente a su presupuesto.",
"askReadOnly": "Solo puede leer. No hay pregunta que cambie una transacción, un presupuesto o una cuenta — y solo ve tus datos, nunca los de nadie más.",
"askLimits": "Responde con lo que está registrado. Si no has importado un estado de cuenta o registrado una transacción, no puede saberlo — y lo dirá en vez de adivinar.",
"askMockQuestion": "¿Cuánto gasté en transporte el mes pasado?",
"askMockNarration": "Sumando transporte de julio…",
"askMockAnswer": "RD$8,420 en 14 transacciones — cerca de 12% más que junio."
```

- [ ] **Step 3: Render the section**

Add the section to `app/(app)/help/page.tsx` in the same shape as the `insights*` section immediately above it: heading from `askTitle`, the four prose keys as paragraphs, and a mock beside them showing `askMockQuestion` as the asked question, `askMockNarration` in muted text, and `askMockAnswer` as the reply — which is what makes the narrated loading state legible before someone has used it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

Then confirm the help page renders the new section in both locales — next-intl throws on a missing key, so a Spanish key omitted in Step 2 surfaces here rather than in production.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/help/page.tsx messages/en.json messages/es.json
git commit -m "docs(help): describe the Ask surface"
```

---

## Done when

- `npm test`, `npm run lint`, and `npx tsc --noEmit` all pass.
- The `stable` write-refusal probe in Task 3 Step 4 errored as expected, and its output is recorded in the PR or commit message.
- Both view-parity queries in Task 2 Step 4 returned zero rows.
- Asking "how much did I spend on transportation last month?" in the browser returns a figure that matches the Budgets screen.
- Every new string exists in both `messages/en.json` and `messages/es.json`.
