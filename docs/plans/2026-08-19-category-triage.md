# Categorisation Triage & Merchant Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After importing a statement, categorise a hundred lines in a dozen taps — grouped by merchant, each tap also teaching a rule — and give every rule a screen where it can be corrected.

**Architecture:** The importer stops inventing a category when it cannot tell, and writes null instead. A per-import triage page reads that import's statement lines, groups the null-category ones by merchant description, and assigns a category to a whole group in one action that also upserts a merchant rule. A rules screen under Settings lists every rule with a usage count. Uncategorised money becomes visible on Insights and Budgets rather than being filtered out of both.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase/Postgres with RLS, next-intl (en/es), Vitest, Tailwind + shadcn/ui, Recharts.

**Spec:** `docs/specs/2026-08-18-category-triage-design.md` — read it before Task 1. This plan implements it and does not restate its reasoning.

## Global Constraints

- **Locale parity is mandatory.** Every user-facing string gets a key in BOTH `messages/en.json` and `messages/es.json`. Spanish is the primary audience: write the Spanish first, then the English.
- **Money is `numeric` in Postgres and arrives as a string.** Always `Number(x ?? 0)` before arithmetic.
- **Server actions return `{ error?: string }`**, never throw, and route DB failures through `dbError(error, "actionName")` from `@/lib/errors`.
- **Never trust a client-supplied row id.** Actions derive the rows they write from the scope they were given (here: the import id).
- **Tests:** `npm test` (Vitest, globals enabled, `@` aliased to the repo root). Unit tests sit beside the file under test as `<name>.test.ts`.
- **This repo is linked to a live Supabase project. The agent cannot push migrations — the human must.** Task 2 ends in a hard stop.
- **Task order is not negotiable across the Task 2 checkpoint.** Task 3 breaks every import until the migration is live (see spec §11).
- **The help guide is updated in the same change as any feature** (Task 10) — page, mocks, en + es.

---

### Task 1: `merchantPattern`

The one normalisation rules are built from. Deliberately does almost nothing — see spec §4 for why stripping the `SANTO DOMINGO-DO` tail is rejected.

**Files:**
- Create: `lib/statements/merchant.ts`
- Test: `lib/statements/merchant.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `merchantPattern(description: string): string`

- [ ] **Step 1: Write the failing test**

Create `lib/statements/merchant.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { merchantPattern } from "./merchant";

describe("merchantPattern", () => {
  it("uppercases, collapses whitespace and trims", () => {
    expect(merchantPattern("  Sm  Nacional   Metro Plza  ")).toBe("SM NACIONAL METRO PLZA");
  });

  it("is idempotent", () => {
    const once = merchantPattern("helados bon metro pza santo domingo-do");
    expect(merchantPattern(once)).toBe(once);
  });

  it("keeps the location tail — an over-broad rule mis-files money silently", () => {
    expect(merchantPattern("IN&OUT CHARLES SUMMER SANTO DOMINGO-DO")).toBe(
      "IN&OUT CHARLES SUMMER SANTO DOMINGO-DO",
    );
  });

  it("produces a pattern that matches its own description under includes()", () => {
    const desc = "PRICESMART SAN ISIDRO SANTO DOMINGO-DO";
    expect(desc.toUpperCase().includes(merchantPattern(desc))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/statements/merchant.test.ts`
Expected: FAIL — `Failed to resolve import "./merchant"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/statements/merchant.ts`:

```ts
/**
 * The pattern a merchant rule is stored under.
 *
 * Uppercase, single-spaced, trimmed — and nothing else. The temptation is to
 * strip the location tail Dominican issuers append (`SANTO DOMINGO-DO`,
 * `DISTRITO NACI-DO`) so a rule survives the same merchant at another branch.
 * Every regex that does it is greedy in the wrong place: `\s+[A-Z][A-Z ]*-[A-Z]{2}$`
 * reduces `IN&OUT CHARLES SUMMER SANTO DOMINGO-DO` to `IN&OUT`, which then matches
 * by substring against anything starting with those six characters.
 *
 * Rules are matched with `includes` (lib/statements/categorize.ts), so a full
 * description matches every repeat of that merchant — which, on real statements,
 * is all of them: descriptions arrive byte-identical. Someone who wants a broader
 * rule shortens the pattern by hand on the rules screen. An under-matching rule
 * costs one tap next month; an over-matching one mis-files money invisibly.
 */
export function merchantPattern(description: string): string {
  return description.replace(/\s+/g, " ").trim().toUpperCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/statements/merchant.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/merchant.ts lib/statements/merchant.test.ts
git commit -m "feat(statements): add merchantPattern, the one rule normalisation"
```

---

### Task 2: The migration — and a hard stop

Four SQL changes in one file. **Nothing in this task is applied by the agent.** The app-side change in Task 3 breaks every import until this is live, so this task ends by handing the file over and waiting.

**Files:**
- Create: `supabase/migrations/<generated>_null_category_triage.sql`

**Interfaces:**
- Produces: `import_card_statement(jsonb)` accepting `category_id: ""` → null; `spend_distribution(p_month date)` including null-category rows; `uncategorized_spend(p_month date) returns numeric`; `category_rule_usage() returns table (rule_id uuid, matches bigint)`.

- [ ] **Step 1: Generate the migration file**

```bash
npm run db:new null_category_triage
```

This creates `supabase/migrations/<timestamp>_null_category_triage.sql`. Note the exact path it prints.

- [ ] **Step 2: Copy the current `import_card_statement` body forward**

The function is redefined by several migrations; the newest wins. Find it and copy the whole `create or replace function` block into the new file as the starting point:

```bash
grep -ln "create or replace function public.import_card_statement" supabase/migrations/*.sql | tail -1
```

Expected: `supabase/migrations/20260806120000_statement_cashback.sql`. Copy lines 27–174 of that file (the `create or replace function` through `revoke execute ... from anon;`) verbatim into the new migration, then apply Step 3's two edits to the copy. Do not hand-write the function from memory — it carries the checksum guard, duplicate-section rejection, FX fallback and cashback handling, and losing any of those is a silent regression.

- [ ] **Step 3: Edit the copied function so a null category is legal**

Find this block in your copy (it is inside the per-line loop, guarded by `if (ln->>'kind') <> 'payment' then`):

```sql
        if not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;
```

Replace it with:

```sql
        -- An empty category id means the importer could not tell what this is:
        -- the line lands with a null category and shows up in triage. Anything
        -- non-empty is still checked as strictly as before — this widens the
        -- accepted set by exactly one member, null.
        if nullif(ln->>'category_id','') is not null and not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;
```

Then, in the `insert into public.transactions (...) values (...)` immediately below it, change:

```sql
          v_user, 'expense', v_account, (ln->>'category_id')::uuid,
```

to:

```sql
          v_user, 'expense', v_account, nullif(ln->>'category_id','')::uuid,
```

- [ ] **Step 4: Append the other three changes to the same file**

```sql
-- spend_distribution: stop dropping uncategorised spend.
--
-- Every line the importer could not identify now carries a null category
-- instead of being filed under "Other", and this function filtered nulls out —
-- so that money would have vanished from the Insights donut without the donut
-- saying so. It comes back as its own slice; lib/insights/queries.ts already
-- tolerates a null key and names it. Otherwise identical to the definition in
-- 20260731150000_spend_distribution_payments.sql.
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
    and t.type in ('expense','payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date
  group by t.category_id
  order by total desc;
$$;

-- uncategorized_spend: the figure above the budget bars.
--
-- category_usage joins FROM categories, so a null-category row cannot appear in
-- it however the filters are written — hence a separate function rather than an
-- extra row. The inclusion rule is copied from category_usage exactly (see
-- 20260731130000_card_payment_default_and_cashflow.sql) so the two cannot
-- disagree about what counts as spending.
create or replace function public.uncategorized_spend(p_month date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(t.base_total_amount), 0)
  from public.transactions t
  where t.user_id = (select auth.uid())
    and t.category_id is null
    and t.type in ('expense','payment')
    and not t.exclude_from_budget
    and date_trunc('month', t.occurred_at)::date = date_trunc('month', p_month)::date;
$$;

-- category_rule_usage: how many statement lines each rule has matched.
--
-- What turns an abstract list of rules into something a person can judge: a rule
-- matching 40 lines is load-bearing, one matching 0 is a typo. `position(... in ...)`
-- rather than LIKE because patterns are user text — a pattern containing % or _
-- would silently become a wildcard under LIKE. This mirrors the JS `includes`
-- the importer matches with (lib/statements/categorize.ts).
--
-- security invoker + RLS on both tables scopes the join to the caller's own rows.
create or replace function public.category_rule_usage()
returns table (rule_id uuid, matches bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id as rule_id, count(l.id) as matches
  from public.category_rules r
  left join public.card_statement_lines l
    on (r.rule_type = 'merchant'
        and position(upper(r.pattern) in upper(l.description)) > 0)
    or (r.rule_type = 'mcc' and l.mcc = r.pattern)
  where r.user_id = (select auth.uid())
  group by r.id;
$$;
```

- [ ] **Step 5: Verify the file parses before handing it over**

Run: `npx supabase db lint --linked --level warning` if available; otherwise re-read the file and check that every `create or replace function` block is closed with `$$;` and the copied `import_card_statement` still ends with its `revoke execute on function public.import_card_statement(jsonb) from anon;`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): let an imported line carry no category

Adds a null-category path through import_card_statement, stops
spend_distribution dropping such rows, and adds uncategorized_spend and
category_rule_usage for the surfaces that report on them."
```

- [ ] **Step 7: STOP — hand the migration to the human**

Tell them, in these terms:

> The migration is committed and ready to push. It must land **before** the next task's app-side change: once `resolveCategoryId` can return null, `confirmStatementImport` sends `category_id: ""`, and the current RPC dies on `''::uuid` before its ownership guard runs — every import containing one unrecognised merchant fails. After `npm run db:push`, run `npm run db:types` so `uncategorized_spend` and `category_rule_usage` exist in `lib/supabase/types.ts`; Tasks 8, 9 and 11 will not typecheck without it.

Do not start Task 3 until they confirm both commands ran.

---

### Task 3: The importer writes null

**Files:**
- Modify: `lib/statements/categorize.ts:26-58`
- Modify: `lib/statements/categorize.test.ts`
- Modify: `app/(app)/accounts/statement-actions.ts:391-399,453`
- Test: `app/(app)/accounts/statement-actions.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `resolveCategoryId(line, rules, categoryIdByName): string | null` — the fourth parameter `otherId` is **removed**.

- [ ] **Step 1: Update the existing tests to expect null**

In `lib/statements/categorize.test.ts`, drop the `"cat-other"` argument from every `resolveCategoryId(...)` call, remove `["Other", "cat-other"]` from the `names` map, and replace the fallback test wholesale:

```ts
  it("returns null when nothing matches — the importer says so rather than guessing", () => {
    expect(resolveCategoryId({ mcc: null, description: "MYSTERY" }, [], names)).toBeNull();
    expect(resolveCategoryId({ mcc: "9999", description: "X" }, [], names)).toBeNull();
    const empty = new Map<string, string>();
    expect(resolveCategoryId({ mcc: "5411", description: "X" }, [], empty)).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: FAIL — the assertions get `"cat-other"` where they now want `null`, and TypeScript complains about the missing argument.

- [ ] **Step 3: Change the signature**

In `lib/statements/categorize.ts`, remove the `otherId: string` parameter, change the return type to `string | null`, and change the final `return otherId;` to `return null;`. Replace the doc comment above the function with:

```ts
/**
 * The category an imported line belongs to, or null when the app cannot tell.
 *
 * Null is a real answer, not a failure: it is what puts the line in front of the
 * user on the triage screen. The predecessor of this function fell back to the
 * category named "Other", which conflated "the app could not tell" with "the user
 * means miscellaneous" — and assumed a category not every user owns, since
 * categories are per-user editable rows.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the caller**

In `app/(app)/accounts/statement-actions.ts`, in `confirmStatementImport`:

Delete these two lines (the `Other` lookup and the guard that blocked an import when it failed):

```ts
  const otherId = categoryIdByName.get("Other") ?? cats?.[0]?.id;
  if (!otherId) return { error: t("noCategories") };
```

and change the line-level call from:

```ts
          category_id:
            l.kind === "payment" ? "" : resolveCategoryId(l, rules, categoryIdByName, otherId),
```

to:

```ts
          // "" travels to the RPC as a null category — the line could not be
          // identified and goes to triage. Payment lines never become
          // transactions at all, so they take the same empty value.
          category_id:
            l.kind === "payment" ? "" : resolveCategoryId(l, rules, categoryIdByName) ?? "",
```

Leave the `noCategories` key in `messages/*.json`; nothing else references it, and removing copy is a separate concern from this change.

- [ ] **Step 6: Add a test that an unrecognised line goes in as null**

In `app/(app)/accounts/statement-actions.test.ts`, add inside the `confirmStatementImport` describe block:

```ts
  it("sends an empty category for a line no rule or MCC recognises", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(confirmFormData());

    const payload = stub.rpc.mock.calls[0][1].p as {
      sections: { lines: { description: string; category_id: string }[] }[];
    };
    const lines = payload.sections.flatMap((s) => s.lines);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.category_id).toBe("");
  });
```

The shared stub returns `category_rules: []` and one category named `Other`, so with the `Other` fallback gone every line in `PARSED` resolves to null. If `confirmFormData()` does not already exist in the file, reuse whatever helper the neighbouring `confirmStatementImport` tests build their `FormData` with.

- [ ] **Step 7: Tell the extractor that null is a right answer**

`lib/statements/llm/schema.ts:46` already types `suggestedCategory` as nullable, so the contract does
not change — but the prompt currently frames guessing as free, which is an instruction to guess.

In `lib/statements/llm/system-prompt.ts:50`, replace:

```
CATEGORIZATION (suggestion only — a downstream rules system has final say, don't worry about being wrong): for each line, set suggestedCategory to your best guess from exactly this list, based on the merchant name and MCC if present, or null if genuinely unclear:
```

with:

```
CATEGORIZATION: for each line, set suggestedCategory from exactly this list, based on the merchant name and MCC if present — or null when you are not confident. null is a correct answer, not a failure: an unrecognised line is put in front of the user, who answers it in one tap and the app remembers the answer. A wrong guess is worse than null, because nobody is asked and the money sits under the wrong heading. Do not guess from a merchant name you do not recognise:
```

- [ ] **Step 8: Pin the entry points that still require a category**

Null must stay reachable only through the importer. Add to `lib/transactions/schema.test.ts` (create the
file if it does not exist, importing `transactionInput` from `./schema`):

```ts
import { describe, expect, it } from "vitest";
import { transactionInput } from "./schema";

describe("transactionInput", () => {
  it("still refuses a manual expense with no category", () => {
    const parsed = transactionInput.safeParse({
      type: "expense",
      account_id: "11111111-1111-1111-1111-111111111111",
      amount: 100,
      occurred_at: "2026-08-19T10:00:00.000Z",
      category_id: "",
    });
    expect(parsed.success).toBe(false);
  });
});
```

If `safeParse` fails for a different reason (a required field this snippet omits), read
`lib/transactions/schema.ts` and add whatever else `transactionInput` requires — the test is only
meaningful if the *category* is the thing that fails it. Assert the issue path:

```ts
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.some((i) => i.path.includes("category_id"))).toBe(true);
```

Subscriptions are deliberately **not** changed (spec §1c) — `lib/subscriptions/schema.ts:12` keeps its
optional category, and a subscription charge with none is a null-category transaction that triage will
never show. That is intended; do not "fix" it.

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS. If `statement-actions.test.ts` fails on `rpc` returning no data, update the stub's `rpc` to `vi.fn(async () => ({ data: "import-1", error: null }))` — Task 7 needs that shape anyway.

- [ ] **Step 10: Commit**

```bash
git add lib/statements/categorize.ts lib/statements/categorize.test.ts lib/statements/llm/system-prompt.ts lib/transactions/schema.test.ts "app/(app)/accounts/statement-actions.ts" "app/(app)/accounts/statement-actions.test.ts"
git commit -m "feat(statements): import a line with no category when nothing matches"
```

---

### Task 4: Reading an import for triage

**Files:**
- Create: `lib/statements/triage.ts`
- Test: `lib/statements/triage.test.ts`

**Interfaces:**
- Consumes: `merchantPattern` (Task 1).
- Produces:
  - `interface TriageLine { transactionId: string; description: string; currency: string; amount: number; madeOn: string; categoryId: string | null }`
  - `interface TriageGroup { key: string; pattern: string; description: string; currency: string; count: number; total: number; transactionIds: string[]; firstDate: string; lastDate: string }`
  - `groupForTriage(lines: TriageLine[]): TriageGroup[]`
  - `getImportTriage(importId: string): Promise<ImportTriage | null>` where `interface ImportTriage { importId: string; fileName: string; accountName: string; totalLines: number; categorizedLines: number; groups: TriageGroup[] }`

- [ ] **Step 1: Write the failing test for the pure grouper**

Create `lib/statements/triage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupForTriage, type TriageLine } from "./triage";

function line(over: Partial<TriageLine> = {}): TriageLine {
  return {
    transactionId: "t-1",
    description: "SM NACIONAL METRO PLZA SANTO DOMINGO-DO",
    currency: "DOP",
    amount: 1000,
    madeOn: "2026-07-10",
    categoryId: null,
    ...over,
  };
}

describe("groupForTriage", () => {
  it("groups identical descriptions and sums them", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", amount: 1000, madeOn: "2026-07-10" }),
      line({ transactionId: "b", amount: 500, madeOn: "2026-07-02" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].total).toBe(1500);
    expect(groups[0].transactionIds).toEqual(["a", "b"]);
    expect(groups[0].firstDate).toBe("2026-07-02");
    expect(groups[0].lastDate).toBe("2026-07-10");
  });

  it("excludes lines that already have a category", () => {
    expect(groupForTriage([line({ categoryId: "cat-1" })])).toHaveLength(0);
  });

  it("never merges two currencies — an import can carry a DOP and a USD section", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", currency: "DOP" }),
      line({ transactionId: "b", currency: "USD" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.currency))).toEqual(new Set(["DOP", "USD"]));
  });

  it("sorts by count, then total, then description — the biggest win first", () => {
    const groups = groupForTriage([
      line({ transactionId: "a", description: "ONE OFF", amount: 9000 }),
      line({ transactionId: "b", description: "TWICE", amount: 100 }),
      line({ transactionId: "c", description: "TWICE", amount: 100 }),
    ]);
    expect(groups.map((g) => g.description)).toEqual(["TWICE", "ONE OFF"]);
  });

  it("carries the rule pattern, normalised", () => {
    const groups = groupForTriage([line({ description: "  helados bon  metro " })]);
    expect(groups[0].pattern).toBe("HELADOS BON METRO");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/statements/triage.test.ts`
Expected: FAIL — `Failed to resolve import "./triage"`.

- [ ] **Step 3: Write the grouper and the query**

Create `lib/statements/triage.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { merchantPattern } from "@/lib/statements/merchant";

export interface TriageLine {
  transactionId: string;
  description: string;
  currency: string;
  amount: number;
  madeOn: string;
  categoryId: string | null;
}

export interface TriageGroup {
  /** `${currency}|${pattern}` — what the client sends back to categorise. */
  key: string;
  pattern: string;
  description: string;
  currency: string;
  count: number;
  total: number;
  transactionIds: string[];
  firstDate: string;
  lastDate: string;
}

export interface ImportTriage {
  importId: string;
  fileName: string;
  accountName: string;
  /** Every non-payment line in the import — the denominator of "68 de 80". */
  totalLines: number;
  categorizedLines: number;
  groups: TriageGroup[];
}

/**
 * The merchant groups still waiting for a category.
 *
 * Pure, so the sort order and the currency split are testable without a database.
 * Currency is part of the key because one import can carry a DOP section and a
 * USD section of the same card, and a merchant appearing in both is two different
 * amounts of money — summing them would print a number that means nothing.
 */
export function groupForTriage(lines: TriageLine[]): TriageGroup[] {
  const byKey = new Map<string, TriageGroup>();
  for (const l of lines) {
    if (l.categoryId !== null) continue;
    const pattern = merchantPattern(l.description);
    const key = `${l.currency}|${pattern}`;
    const found = byKey.get(key);
    if (!found) {
      byKey.set(key, {
        key,
        pattern,
        description: l.description.trim(),
        currency: l.currency,
        count: 1,
        total: l.amount,
        transactionIds: [l.transactionId],
        firstDate: l.madeOn,
        lastDate: l.madeOn,
      });
      continue;
    }
    found.count += 1;
    found.total += l.amount;
    found.transactionIds.push(l.transactionId);
    if (l.madeOn < found.firstDate) found.firstDate = l.madeOn;
    if (l.madeOn > found.lastDate) found.lastDate = l.madeOn;
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || b.total - a.total || a.description.localeCompare(b.description),
  );
}

/**
 * Everything the triage screen shows, for one import.
 *
 * Scoped by `import_id` rather than by "every transaction with no category":
 * a subscription charge can also have none (see the spec, §1c), and it has
 * nothing to do with this statement. RLS confines every table here to the caller.
 */
export async function getImportTriage(importId: string): Promise<ImportTriage | null> {
  const supabase = await createClient();

  const { data: imp } = await supabase
    .from("statement_imports")
    .select("id,file_name")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) return null;

  const { data: statements } = await supabase
    .from("card_statements")
    .select("id,account:accounts!card_statements_account_id_fkey(name,currency)")
    .eq("import_id", importId);
  if (!statements || statements.length === 0)
    return {
      importId,
      fileName: imp.file_name,
      accountName: "",
      totalLines: 0,
      categorizedLines: 0,
      groups: [],
    };

  const currencyByStatement = new Map(
    statements.map((s) => [s.id, s.account?.currency ?? ""]),
  );

  const { data: rows } = await supabase
    .from("card_statement_lines")
    .select(
      "statement_id,description,amount,made_on,kind,transaction:transactions!card_statement_lines_transaction_id_fkey(id,category_id)",
    )
    .in(
      "statement_id",
      statements.map((s) => s.id),
    );

  // Payment lines never become transactions (the import RPC skips them), so they
  // are neither triaged nor counted — the denominator is what a person could
  // categorise, not every printed row.
  const lines: TriageLine[] = (rows ?? [])
    .filter((r) => r.kind !== "payment" && r.transaction)
    .map((r) => ({
      transactionId: r.transaction!.id,
      description: r.description,
      currency: currencyByStatement.get(r.statement_id) ?? "",
      amount: Number(r.amount ?? 0),
      madeOn: r.made_on,
      categoryId: r.transaction!.category_id,
    }));

  return {
    importId,
    fileName: imp.file_name,
    accountName: statements[0].account?.name ?? "",
    totalLines: lines.length,
    categorizedLines: lines.filter((l) => l.categoryId !== null).length,
    groups: groupForTriage(lines),
  };
}
```

If the embedded-join alias names above are rejected by PostgREST, get the real constraint names with:

```bash
grep -n "transaction_id\|account_id" supabase/migrations/20260722120000_statement_import.sql | head -20
```

and use `transactions!card_statement_lines_transaction_id_fkey` / `accounts!card_statements_account_id_fkey` as they are actually generated. `lib/transactions/queries.ts:11` shows the same embedding pattern already working in this codebase.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/statements/triage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/triage.ts lib/statements/triage.test.ts
git commit -m "feat(statements): read an import's uncategorised lines, grouped by merchant"
```

---

### Task 5: Categorising a whole group

**Files:**
- Create: `app/(app)/imports/actions.ts`
- Test: `app/(app)/imports/actions.test.ts`

**Interfaces:**
- Consumes: `merchantPattern` (Task 1), `getImportTriage` (Task 4).
- Produces: `categorizeTriageGroup(importId: string, groupKey: string, categoryId: string): Promise<{ error?: string; updated?: number }>`

- [ ] **Step 1: Write the failing test**

Create `app/(app)/imports/actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("@/lib/statements/triage", () => ({ getImportTriage: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getImportTriage } from "@/lib/statements/triage";
import { categorizeTriageGroup } from "./actions";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.is = vi.fn(() => obj);
  obj.in = vi.fn(() => obj);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

const TRIAGE = {
  importId: "imp-1",
  fileName: "popular.pdf",
  accountName: "Popular Visa",
  totalLines: 3,
  categorizedLines: 0,
  groups: [
    {
      key: "DOP|SM NACIONAL",
      pattern: "SM NACIONAL",
      description: "SM Nacional",
      currency: "DOP",
      count: 2,
      total: 1500,
      transactionIds: ["txn-a", "txn-b"],
      firstDate: "2026-07-02",
      lastDate: "2026-07-10",
    },
  ],
};

function stubWith(category: unknown) {
  const update = vi.fn(() => chainable({ error: null }));
  const upsert = vi.fn(() => Promise.resolve({ error: null }));
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => {
      if (table === "transactions") return chainable({ error: null }, { update });
      if (table === "categories") return chainable({ data: category });
      if (table === "category_rules") return chainable({ data: [] }, { upsert });
      return chainable({ data: null });
    }),
    update,
    upsert,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getImportTriage as Mock).mockResolvedValue(TRIAGE);
});

describe("categorizeTriageGroup", () => {
  it("writes the category onto the group's transactions and saves one rule", async () => {
    const stub = stubWith({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SM NACIONAL", "cat-1");

    expect(result.error).toBeUndefined();
    expect(result.updated).toBe(2);
    expect(stub.update).toHaveBeenCalledWith({ category_id: "cat-1" });
    expect(stub.upsert).toHaveBeenCalledTimes(1);
    expect(stub.upsert.mock.calls[0][0]).toMatchObject({
      rule_type: "merchant",
      pattern: "SM NACIONAL",
      category_id: "cat-1",
    });
  });

  it("refuses a category that is not the caller's", async () => {
    const stub = stubWith(null);
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SM NACIONAL", "cat-someone-else");

    expect(result.error).toBeTruthy();
    expect(stub.update).not.toHaveBeenCalled();
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("refuses a group that is not in this import", async () => {
    const stub = stubWith({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(stub);

    const result = await categorizeTriageGroup("imp-1", "DOP|SOMETHING ELSE", "cat-1");

    expect(result.error).toBeTruthy();
    expect(stub.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(app)/imports/actions.test.ts"`
Expected: FAIL — `Failed to resolve import "./actions"`.

- [ ] **Step 3: Write the action**

Create `app/(app)/imports/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getImportTriage } from "@/lib/statements/triage";
import { dbError } from "@/lib/errors";

/**
 * Give every line of one merchant group a category, and remember the merchant.
 *
 * The client sends a group key, never a list of transaction ids: the rows are
 * re-derived from the import here. A client-supplied id list would let this
 * screen write a category onto any transaction the caller owns, which is not
 * what a per-import screen is allowed to do.
 *
 * The rule is saved silently and always. One tap has to do both jobs or the
 * rules table stays empty — which is exactly what the opt-in checkbox on the
 * transaction form produced. The rules screen is where a bad one is corrected.
 */
export async function categorizeTriageGroup(
  importId: string,
  groupKey: string,
  categoryId: string,
): Promise<{ error?: string; updated?: number }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // RLS stops a caller writing another user's transactions, but it does not
  // police WHICH category id lands in the column — that check is ours.
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category) return { error: t("invalidInput") };

  const triage = await getImportTriage(importId);
  const group = triage?.groups.find((g) => g.key === groupKey);
  if (!group) return { error: t("invalidInput") };

  // `.is("category_id", null)` so a category set from the ledger while this
  // screen was open wins rather than being overwritten by a stale group.
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .in("id", group.transactionIds)
    .is("category_id", null);
  if (error) return { error: await dbError(error, "categorizeTriageGroup") };

  const { error: ruleError } = await supabase.from("category_rules").upsert(
    {
      user_id: user.id,
      rule_type: "merchant",
      pattern: group.pattern,
      category_id: categoryId,
      priority: 10,
    },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (ruleError) return { error: await dbError(ruleError, "categorizeTriageGroup") };

  // The same set the import path revalidates, for the same reason: this moves
  // budget bars, the Insights donut and every ledger row it touched.
  revalidatePath(`/imports/${importId}`);
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/insights");
  revalidatePath("/");
  return { updated: group.transactionIds.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(app)/imports/actions.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/imports/actions.ts" "app/(app)/imports/actions.test.ts"
git commit -m "feat(imports): categorise a merchant group and remember the rule"
```

---

### Task 6: The triage screen

**Files:**
- Create: `app/(app)/imports/[id]/page.tsx`
- Create: `components/imports/triage-list.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `getImportTriage`, `TriageGroup` (Task 4), `categorizeTriageGroup` (Task 5), `CategoryRail` and `getQuickAddData` (existing).
- Produces: the route `/imports/[id]`, and `/imports/[id]?fresh=1` for the post-import arrival.

- [ ] **Step 1: Add the copy**

In `messages/es.json`, add an `Imports` namespace (Spanish first — it is the primary audience):

```json
  "Imports": {
    "pageTitle": "Categorizar",
    "pageDescription": "{fileName} · {account}",
    "autoSummary": "{done} de {total} categorizadas automáticamente",
    "remaining": "faltan {count} por categorizar",
    "allDone": "Todo categorizado",
    "allDoneBody": "Cada línea de este estado de cuenta tiene categoría. La próxima vez serán menos preguntas.",
    "groupLines": "{count, plural, one {# consumo} other {# consumos}}",
    "groupDates": "{from} – {to}",
    "assigned": "{merchant} → {category}",
    "backToAccount": "Volver a la cuenta",
    "notFound": "Esa importación ya no existe."
  },
```

In `messages/en.json`, the same keys:

```json
  "Imports": {
    "pageTitle": "Categorise",
    "pageDescription": "{fileName} · {account}",
    "autoSummary": "{done} of {total} categorised automatically",
    "remaining": "{count} left to categorise",
    "allDone": "All categorised",
    "allDoneBody": "Every line on this statement has a category. Next time there will be fewer questions.",
    "groupLines": "{count, plural, one {# transaction} other {# transactions}}",
    "groupDates": "{from} – {to}",
    "assigned": "{merchant} → {category}",
    "backToAccount": "Back to the account",
    "notFound": "That import no longer exists."
  },
```

- [ ] **Step 2: Write the page**

Create `app/(app)/imports/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { TriageList } from "@/components/imports/triage-list";
import { getImportTriage } from "@/lib/statements/triage";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function ImportTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { id } = await params;
  const { fresh } = await searchParams;
  const [triage, quickAdd] = await Promise.all([getImportTriage(id), getQuickAddData()]);
  if (!triage) notFound();
  const t = await getTranslations("Imports");

  const remaining = triage.totalLines - triage.categorizedLines;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription", {
          fileName: triage.fileName,
          account: triage.accountName,
        })}
      />

      {/* "automáticamente" is only true on arrival from the import, before the
          user has assigned anything: nothing records whether a category came
          from a rule or from a person, so on a later visit that figure would be
          crediting the rules engine with the user's own taps. */}
      <p className="text-sm text-muted-foreground">
        {fresh === "1"
          ? t("autoSummary", { done: triage.categorizedLines, total: triage.totalLines })
          : t("remaining", { count: remaining })}
      </p>

      <TriageList
        importId={triage.importId}
        groups={triage.groups}
        categories={quickAdd.categories}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write the list**

Create `components/imports/triage-list.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { categorizeTriageGroup } from "@/app/(app)/imports/actions";
import { CategoryRail } from "@/components/transactions/category-rail";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { useUiSound } from "@/components/sound/sound-provider";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TriageGroup } from "@/lib/statements/triage";
import type { QuickAddCategory } from "@/lib/transactions/queries";

export function TriageList({
  importId,
  groups,
  categories,
}: {
  importId: string;
  groups: TriageGroup[];
  categories: QuickAddCategory[];
}) {
  const t = useTranslations("Imports");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [focused, setFocused] = useState(0);
  const { playSuccess, playError } = useUiSound();

  /* Keyboard, on the screen whose entire point is speed. ↑/↓ move between
     groups and a digit assigns from the same ranked list the rail is built from
     — so 1–5 are exactly the five chips visible on the focused card, and 6–9
     reach four more that would otherwise cost a trip through "more".
     Touch and mouse are unaffected; this is additive. */
  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (pending || groups.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return Math.min(groups.length - 1, Math.max(0, next));
      });
      return;
    }
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      const category = categories[digit - 1];
      const group = groups[focused];
      if (category && group) {
        e.preventDefault();
        assign(group, category.id);
      }
    }
  }

  function assign(group: TriageGroup, categoryId: string) {
    setBusyKey(group.key);
    startTransition(async () => {
      const result = await categorizeTriageGroup(importId, group.key, categoryId);
      setBusyKey(null);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      const category = categories.find((c) => c.id === categoryId);
      toast.success(
        t("assigned", { merchant: group.description, category: category?.name ?? "" }),
      );
      playSuccess();
      router.refresh();
    });
  }

  if (groups.length === 0) {
    return <EmptyState title={t("allDone")} description={t("allDoneBody")} />;
  }

  return (
    // tabIndex so the list itself can hold focus and receive the keys; the rail
    // buttons inside stay individually tabbable, which is what a screen reader
    // and a Tab-only user need.
    <ul className="space-y-3 focus-visible:outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      {groups.map((group, i) => (
        <li key={group.key}>
          <Card
            className={cn(
              "p-4",
              busyKey === group.key && "opacity-60",
              i === focused && "ring-2 ring-ring/50",
            )}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{group.description}</p>
                <p className="text-xs text-muted-foreground">
                  {t("groupLines", { count: group.count })} ·{" "}
                  {t("groupDates", {
                    from: formatDate(group.firstDate, locale),
                    to: formatDate(group.lastDate, locale),
                  })}
                </p>
              </div>
              <MoneyDisplay amount={group.total} currency={group.currency} />
            </div>
            <CategoryRail
              categories={categories}
              value=""
              onChange={(id) => !pending && assign(group, id)}
              onMore={() => router.push(`/transactions?search=${encodeURIComponent(group.description)}`)}
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}
```

Check the real props of `EmptyState`, `MoneyDisplay` and `useUiSound` before writing — `components/budgets/budget-grid.tsx` uses all three and is the reference. If `MoneyDisplay` needs a formatter from `useMaskedFormatMoney`, follow that file exactly; figures in this app respect the mask.

- [ ] **Step 4: Verify by hand**

Run `npm run lint` and `npx tsc --noEmit`. Both must be clean.

Then ask the human before starting the dev server (they want to be asked). With their go-ahead: `npm run dev`, import a statement, land on `/imports/<id>?fresh=1`, assign a group, confirm it disappears and the header count drops.

Keyboard pass, on the same screen: click the list once, then ↓ ↓ to move the ring, then `2` — the second
chip's category lands on the focused group and the card leaves the list. Tab must still reach the rail
buttons individually.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/imports/[id]/page.tsx" components/imports/triage-list.tsx messages/en.json messages/es.json
git commit -m "feat(imports): a triage screen that categorises a merchant at a time"
```

---

### Task 7: Getting there — after an import, and later

**Files:**
- Modify: `app/(app)/accounts/statement-actions.ts:459` (return the import id)
- Modify: `components/statements/statement-import-dialog.tsx:186-207` (route on success)
- Modify: `lib/accounts/queries.ts` (add `getPendingTriageCounts`)
- Modify: `components/accounts/statements-panel.tsx:122-165` (the per-statement action)
- Modify: `app/(app)/accounts/[id]/page.tsx` (pass the counts down)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: the `/imports/[id]` route (Task 6).
- Produces: `confirmStatementImport(...): Promise<{ error?: string; importId?: string; uncategorized?: number }>`; `getPendingTriageCounts(accountId: string): Promise<Record<string, { importId: string; count: number }>>` keyed by statement id.

- [ ] **Step 1: Return the import id from the action**

In `app/(app)/accounts/statement-actions.ts`, change the RPC call from:

```ts
  const { error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };
```

to:

```ts
  // The RPC has always returned the import id (`returns uuid`); it used to be
  // thrown away. It is the handle the triage screen is keyed on.
  const { data: importId, error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };
```

and change the final `return {};` of that function to:

```ts
  // Counted from the payload rather than re-read from the database: this is the
  // number of lines the importer could not identify, which is exactly what
  // triage will offer to fix.
  const uncategorized = payload.sections.reduce(
    (n, s) => n + s.lines.filter((l) => l.kind !== "payment" && l.category_id === "").length,
    0,
  );
  return { importId: importId ?? undefined, uncategorized };
```

Update the function's declared return type to `Promise<{ error?: string; importId?: string; uncategorized?: number }>`.

- [ ] **Step 2: Route to triage when there is something to triage**

In `components/statements/statement-import-dialog.tsx`, add `import { useRouter } from "next/navigation";` and `const router = useRouter();`, then in `onConfirm`'s success branch replace:

```ts
      toast.success(t("imported"));
      playSuccess();
      resetForm();
      onImported?.();
      onOpenChange(false);
```

with:

```ts
      toast.success(t("imported"));
      playSuccess();
      resetForm();
      onImported?.();
      onOpenChange(false);
      // Landing someone on an empty triage screen to congratulate them is worse
      // than saying nothing, so a fully-recognised statement keeps today's
      // behaviour: a toast, and the page they were already on.
      if (result.importId && (result.uncategorized ?? 0) > 0) {
        router.push(`/imports/${result.importId}?fresh=1`);
      }
```

- [ ] **Step 3: Count the leftovers per statement**

In `lib/accounts/queries.ts`, add:

```ts
/**
 * How many lines of each statement still have no category, and which import to
 * send someone to. Keyed by statement id so the panel can render a count per row.
 *
 * Statements with no import (added by hand) are absent from the result: there is
 * no import to triage.
 */
export async function getPendingTriageCounts(
  accountId: string,
): Promise<Record<string, { importId: string; count: number }>> {
  const supabase = await createClient();
  const { data: statements } = await supabase
    .from("card_statements")
    .select("id,import_id")
    .eq("account_id", accountId)
    .not("import_id", "is", null);
  if (!statements || statements.length === 0) return {};

  const { data: lines } = await supabase
    .from("card_statement_lines")
    .select("statement_id,transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)")
    .in("statement_id", statements.map((s) => s.id));

  const counts: Record<string, { importId: string; count: number }> = {};
  for (const s of statements) {
    const n = (lines ?? []).filter(
      (l) => l.statement_id === s.id && l.transaction && l.transaction.category_id === null,
    ).length;
    if (n > 0) counts[s.id] = { importId: s.import_id!, count: n };
  }
  return counts;
}
```

- [ ] **Step 4: Add the action to the panel**

In `app/(app)/accounts/[id]/page.tsx`, add `getPendingTriageCounts` to the imports and to the `Promise.all` that already loads `getCardStatements`, then pass `triageCounts={...}` into `<StatementsPanel ... />`.

In `components/accounts/statements-panel.tsx`, accept the prop:

```tsx
  triageCounts,
}: {
  // ...existing props
  triageCounts: Record<string, { importId: string; count: number }>;
```

and inside the statement row's right-hand `<div className="flex items-center gap-3">`, before the expand button:

```tsx
                  {triageCounts[s.id] ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<a href={`/imports/${triageCounts[s.id].importId}`} />}
                      nativeButton={false}
                    >
                      {t("categorizeCount", { count: triageCounts[s.id].count })}
                    </Button>
                  ) : null}
```

Copy the `render` / `nativeButton` idiom exactly from `components/settings/settings-panel.tsx:223` — that is how this codebase renders a Button as a link.

Add to both message files, under `Statements`:

```json
    "categorizeCount": "Categorizar ({count})",
```

```json
    "categorizeCount": "Categorise ({count})",
```

- [ ] **Step 5: Test the count**

Add to `app/(app)/accounts/statement-actions.test.ts`:

```ts
  it("reports how many lines the importer could not identify", async () => {
    const stub = makeSupabaseStub();
    stub.rpc = vi.fn(async () => ({ data: "imp-1", error: null }));
    (createClient as Mock).mockResolvedValue(stub);

    const result = await confirmStatementImport(confirmFormData());

    expect(result.importId).toBe("imp-1");
    expect(result.uncategorized).toBeGreaterThan(0);
  });
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Test that the panel only offers triage where there is triage to do**

`getPendingTriageCounts` decides whether the button renders at all, so its filtering is the part worth
pinning. Create `lib/accounts/triage-counts.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getPendingTriageCounts } from "./queries";

function chainable(result: unknown) {
  const obj: Record<string, unknown> = {};
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.in = vi.fn(() => obj);
  obj.not = vi.fn(() => obj);
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

describe("getPendingTriageCounts", () => {
  it("counts only null-category lines, and omits statements with none", async () => {
    (createClient as Mock).mockResolvedValue({
      from: vi.fn((table: string) =>
        table === "card_statements"
          ? chainable({
              data: [
                { id: "st-1", import_id: "imp-1" },
                { id: "st-2", import_id: "imp-2" },
              ],
            })
          : chainable({
              data: [
                { statement_id: "st-1", transaction: { category_id: null } },
                { statement_id: "st-1", transaction: { category_id: null } },
                { statement_id: "st-1", transaction: { category_id: "cat-1" } },
                { statement_id: "st-2", transaction: { category_id: "cat-1" } },
              ],
            }),
      ),
    });

    const counts = await getPendingTriageCounts("acc-1");

    expect(counts["st-1"]).toEqual({ importId: "imp-1", count: 2 });
    expect(counts["st-2"]).toBeUndefined();
  });
});
```

Run: `npx vitest run lib/accounts/triage-counts.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/accounts/statement-actions.ts" "app/(app)/accounts/statement-actions.test.ts" components/statements/statement-import-dialog.tsx lib/accounts/queries.ts lib/accounts/triage-counts.test.ts components/accounts/statements-panel.tsx "app/(app)/accounts/[id]/page.tsx" messages/en.json messages/es.json
git commit -m "feat(imports): reach triage from the import and from the statement"
```

---

### Task 8: The rules screen

Requires `category_rule_usage` in `lib/supabase/types.ts` — the human must have run `npm run db:types` after Task 2.

**Files:**
- Create: `app/(app)/settings/rules/page.tsx`
- Create: `app/(app)/settings/rules/actions.ts`
- Create: `components/settings/rules-list.tsx`
- Create: `lib/rules/queries.ts`
- Test: `app/(app)/settings/rules/actions.test.ts`
- Modify: `components/settings/settings-panel.tsx`, `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `getMerchantRules(): Promise<RuleRow[]>` where `interface RuleRow { id: string; ruleType: "merchant" | "mcc"; pattern: string; categoryId: string; matches: number }`; `updateRule(id, { pattern, categoryId }): Promise<{ error?: string }>`; `deleteRule(id): Promise<{ error?: string }>`.

- [ ] **Step 1: Write the query**

Create `lib/rules/queries.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export interface RuleRow {
  id: string;
  ruleType: "merchant" | "mcc";
  pattern: string;
  categoryId: string;
  /** Statement lines this rule matches — what makes a rule judgeable. */
  matches: number;
}

export async function getMerchantRules(): Promise<RuleRow[]> {
  const supabase = await createClient();
  const [{ data: rules }, { data: usage }] = await Promise.all([
    supabase.from("category_rules").select("id,rule_type,pattern,category_id").order("pattern"),
    supabase.rpc("category_rule_usage"),
  ]);
  const matchesById = new Map((usage ?? []).map((u) => [u.rule_id, Number(u.matches ?? 0)]));
  return (rules ?? []).map((r) => ({
    id: r.id,
    ruleType: r.rule_type as "merchant" | "mcc",
    pattern: r.pattern,
    categoryId: r.category_id,
    matches: matchesById.get(r.id) ?? 0,
  }));
}
```

- [ ] **Step 2: Write the failing action test**

Create `app/(app)/settings/rules/actions.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { createClient } from "@/lib/supabase/server";
import { updateRule, deleteRule } from "./actions";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

function stub(category: unknown) {
  const update = vi.fn(() => chainable({ error: null }));
  const del = vi.fn(() => chainable({ error: null }));
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => {
      if (table === "categories") return chainable({ data: category });
      return chainable({ error: null }, { update, delete: del });
    }),
    update,
    del,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("updateRule", () => {
  it("normalises the pattern before saving", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "  sm nacional ", categoryId: "cat-1" });
    expect(result.error).toBeUndefined();
    expect(s.update).toHaveBeenCalledWith({ pattern: "SM NACIONAL", category_id: "cat-1" });
  });

  it("rejects an empty pattern", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "   ", categoryId: "cat-1" });
    expect(result.error).toBeTruthy();
    expect(s.update).not.toHaveBeenCalled();
  });

  it("rejects a category that is not the caller's", async () => {
    const s = stub(null);
    (createClient as Mock).mockResolvedValue(s);
    const result = await updateRule("rule-1", { pattern: "SM NACIONAL", categoryId: "nope" });
    expect(result.error).toBeTruthy();
    expect(s.update).not.toHaveBeenCalled();
  });
});

describe("deleteRule", () => {
  it("deletes by id", async () => {
    const s = stub({ id: "cat-1" });
    (createClient as Mock).mockResolvedValue(s);
    const result = await deleteRule("rule-1");
    expect(result.error).toBeUndefined();
    expect(s.del).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run "app/(app)/settings/rules/actions.test.ts"`
Expected: FAIL — `Failed to resolve import "./actions"`.

- [ ] **Step 4: Write the actions**

Create `app/(app)/settings/rules/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { merchantPattern } from "@/lib/statements/merchant";
import { dbError } from "@/lib/errors";

/**
 * Edit a rule.
 *
 * Changes what future imports and future triage do. It does NOT rewrite
 * transactions already categorised: that would silently rework months of
 * history, including rows the user hand-corrected afterwards. The screen says so.
 */
export async function updateRule(
  id: string,
  input: { pattern: string; categoryId: string },
): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const pattern = merchantPattern(input.pattern);
  if (!pattern) return { error: t("invalidInput") };

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("id", input.categoryId)
    .maybeSingle();
  if (!category) return { error: t("invalidInput") };

  const { error } = await supabase
    .from("category_rules")
    .update({ pattern, category_id: input.categoryId })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateRule") };

  revalidatePath("/settings/rules");
  return {};
}

export async function deleteRule(id: string): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteRule") };

  revalidatePath("/settings/rules");
  return {};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "app/(app)/settings/rules/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the page, the list and the copy**

Create `app/(app)/settings/rules/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RulesList } from "@/components/settings/rules-list";
import { getMerchantRules } from "@/lib/rules/queries";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function RulesPage() {
  const [rules, quickAdd] = await Promise.all([getMerchantRules(), getQuickAddData()]);
  const t = await getTranslations("Rules");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <p className="text-sm text-muted-foreground">{t("retroNote")}</p>
      <RulesList rules={rules} categories={quickAdd.categories} />
    </div>
  );
}
```

Create `components/settings/rules-list.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { updateRule, deleteRule } from "@/app/(app)/settings/rules/actions";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RuleRow } from "@/lib/rules/queries";
import type { QuickAddCategory } from "@/lib/transactions/queries";

export function RulesList({
  rules,
  categories,
}: {
  rules: RuleRow[];
  categories: QuickAddCategory[];
}) {
  const t = useTranslations("Rules");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, { pattern: string; categoryId: string }>>({});

  function draftFor(rule: RuleRow) {
    return drafts[rule.id] ?? { pattern: rule.pattern, categoryId: rule.categoryId };
  }

  function setDraft(rule: RuleRow, patch: Partial<{ pattern: string; categoryId: string }>) {
    setDrafts((d) => ({ ...d, [rule.id]: { ...draftFor(rule), ...patch } }));
  }

  function save(rule: RuleRow) {
    const draft = draftFor(rule);
    startTransition(async () => {
      const result = await updateRule(rule.id, draft);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  function remove(rule: RuleRow) {
    startTransition(async () => {
      const result = await deleteRule(rule.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  if (rules.length === 0) {
    return <EmptyState title={t("empty")} description={t("emptyBody")} />;
  }

  return (
    <ul className="space-y-3">
      {rules.map((rule) => {
        const draft = draftFor(rule);
        const dirty = draft.pattern !== rule.pattern || draft.categoryId !== rule.categoryId;
        return (
          <li key={rule.id}>
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                {/* The pattern is editable because merchantPattern deliberately
                    keeps the issuer's location tail: shortening it by hand here
                    is how a rule is made to cover every branch. */}
                <Input
                  value={draft.pattern}
                  onChange={(e) => setDraft(rule, { pattern: e.target.value })}
                  disabled={pending || rule.ruleType === "mcc"}
                  aria-label={t("pageTitle")}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={t("deleteAria")}
                  onClick={() => remove(rule)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={draft.categoryId}
                  onChange={(e) => setDraft(rule, { categoryId: e.target.value })}
                  disabled={pending}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3">
                  {/* A rule matching 40 lines is load-bearing; one matching 0 is a typo. */}
                  <span className="text-xs text-muted-foreground">
                    {t("matchCount", { count: rule.matches })}
                  </span>
                  <Button size="sm" disabled={pending || !dirty} onClick={() => save(rule)}>
                    {t("save")}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
```

If this codebase has a shadcn `Select` wrapper in `components/ui/`, use it in place of the bare
`<select>` above — check `components/transactions/transaction-form.tsx` for how a category select is
built there, and match it. The bare element is the fallback, not the preference.

Add to `messages/es.json`:

```json
  "Rules": {
    "pageTitle": "Reglas de categorías",
    "pageDescription": "Lo que la app aprendió de tus estados de cuenta.",
    "retroNote": "Editar una regla cambia las próximas importaciones. No recategoriza lo que ya guardaste.",
    "matchCount": "{count, plural, one {# línea} other {# líneas}}",
    "save": "Guardar",
    "deleteAria": "Eliminar regla",
    "empty": "Todavía no hay reglas",
    "emptyBody": "Cada vez que categorizas un comercio después de importar, se guarda una regla aquí.",
    "saved": "Regla guardada",
    "deleted": "Regla eliminada"
  },
```

and the English equivalents to `messages/en.json`:

```json
  "Rules": {
    "pageTitle": "Category rules",
    "pageDescription": "What the app learned from your statements.",
    "retroNote": "Editing a rule changes future imports. It does not recategorise what you already saved.",
    "matchCount": "{count, plural, one {# line} other {# lines}}",
    "save": "Save",
    "deleteAria": "Delete rule",
    "empty": "No rules yet",
    "emptyBody": "Every time you categorise a merchant after an import, a rule is saved here.",
    "saved": "Rule saved",
    "deleted": "Rule deleted"
  },
```

- [ ] **Step 7: Link it from Settings**

In `components/settings/settings-panel.tsx`, next to the existing help link (line ~223), add a row linking to `/settings/rules` with `t("rulesLink")`, using the same `render={<a href=... />} nativeButton={false}` idiom. Add `"rulesLink": "Reglas de categorías"` / `"rulesLink": "Category rules"` under the `Settings` namespace in both message files.

- [ ] **Step 8: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all clean.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/settings/rules" components/settings/rules-list.tsx components/settings/settings-panel.tsx lib/rules/queries.ts messages/en.json messages/es.json
git commit -m "feat(settings): a screen for every merchant rule, with its usage"
```

---

### Task 9: Uncategorised money, said out loud

Requires `uncategorized_spend` in `lib/supabase/types.ts` (Task 2 checkpoint).

**Files:**
- Modify: `lib/insights/queries.ts:103-106`
- Modify: `lib/budgets/queries.ts`
- Modify: `components/budgets/budget-grid.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `uncategorized_spend` (Task 2).
- Produces: `BudgetOverview` gains `uncategorized: number` and `pendingTriageImportId: string | null`.

- [ ] **Step 1: Name and colour the donut's uncategorised slice**

In `lib/insights/queries.ts`, replace the `distribution` mapper:

```ts
  const distribution = (dist ?? []).map((d, i) => ({
    name: catById.get(d.category_id ?? "")?.name ?? "Uncategorized",
    value: Number(d.total ?? 0),
    color: catById.get(d.category_id ?? "")?.color ?? CHART_FALLBACK[i % CHART_FALLBACK.length],
  }));
```

with:

```ts
  /* A null category is money the importer could not identify, not a category
     whose row went missing — so it gets a deliberate muted grey rather than the
     next colour off the fallback rotation, and reads as absence. `spend_distribution`
     stopped filtering these out so the donut would stop quietly under-reporting
     the month; see the null_category_triage migration. */
  const distribution = (dist ?? []).map((d, i) => {
    const cat = d.category_id ? catById.get(d.category_id) : undefined;
    return {
      name: cat?.name ?? UNCATEGORIZED_NAME,
      value: Number(d.total ?? 0),
      color: d.category_id
        ? cat?.color ?? CHART_FALLBACK[i % CHART_FALLBACK.length]
        : "var(--muted-foreground)",
      uncategorized: !d.category_id,
    };
  });
```

`UNCATEGORIZED_NAME` cannot come from `useTranslations` in a query module, and the existing code already hardcodes `"Uncategorized"` here. Resolve it properly: this function has `getTranslations` available on the server — add `const tCommon = await getTranslations("Common");` alongside the other awaits and use `tCommon("uncategorized")`, adding `"uncategorized": "Sin categoría"` / `"uncategorized": "Uncategorized"` to the `Common` namespace in both message files. Check whether `lib/insights/queries.ts` already imports `getTranslations`; if not, add `import { getTranslations } from "next-intl/server";`.

- [ ] **Step 2: Add the figure to the budget overview**

In `lib/budgets/queries.ts`, add `uncategorized: number` and `pendingTriageImportId: string | null` to `BudgetOverview`, then extend `getBudgetOverview`:

```ts
  const [{ data: usage }, { data: categories }, { data: profile }, { data: uncategorized }, { data: pending }] =
    await Promise.all([
      supabase.rpc("category_usage", { p_month: month }),
      supabase.from("categories").select("id,name,emoji,color").order("sort_order"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase.rpc("uncategorized_spend", { p_month: month }),
      /* The newest import that still has something to triage, so the figure can
         be a link. When every leftover is a subscription charge instead (which
         triage cannot help with), this is null and the figure is just a figure. */
      supabase
        .from("statement_imports")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
```

and add to the returned object:

```ts
    uncategorized: Number(uncategorized ?? 0),
    pendingTriageImportId: pending?.[0]?.id ?? null,
```

- [ ] **Step 3: Render the line above the bars**

In `components/budgets/budget-grid.tsx`, immediately above the list of budget rows, add:

```tsx
      {overview.uncategorized > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("uncategorizedLine", {
            amount: maskedFormat(overview.uncategorized, overview.baseCurrency),
          })}{" "}
          {overview.pendingTriageImportId ? (
            <a className="underline" href={`/imports/${overview.pendingTriageImportId}`}>
              {t("uncategorizedAction")}
            </a>
          ) : null}
        </p>
      ) : null}
```

Add under `Budgets` in `messages/es.json`:

```json
    "uncategorizedLine": "{amount} sin categorizar este mes.",
    "uncategorizedAction": "Categorizar",
```

and in `messages/en.json`:

```json
    "uncategorizedLine": "{amount} uncategorised this month.",
    "uncategorizedAction": "Categorise",
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: clean. `npx tsc --noEmit` is the real check here — it fails if `npm run db:types` was not run after Task 2.

- [ ] **Step 5: Commit**

```bash
git add lib/insights/queries.ts lib/budgets/queries.ts components/budgets/budget-grid.tsx messages/en.json messages/es.json
git commit -m "feat(insights): show uncategorised spend instead of dropping it"
```

---

### Task 10: The help guide

The standing rule: no feature change ships without the guide moving with it.

**Files:**
- Modify: `app/(app)/help/page.tsx`
- Modify: `components/help/mocks.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Read what the guide currently says about importing**

```bash
grep -n "statementsBody\|statementsTitle" messages/es.json
```

- [ ] **Step 2: Extend the accounts/statements chapter**

Add to the `Help` namespace in `messages/es.json`:

```json
    "triageBody": "Al terminar una importación, la app categoriza sola lo que reconoce y te pregunta por el resto — un comercio a la vez, no una transacción a la vez. Cada respuesta se guarda como una regla, así que el próximo estado de cuenta pregunta menos. Si dejas algo sin categorizar, cualquier estado de cuenta te devuelve a esa pantalla desde la página de la tarjeta.",
```

and in `messages/en.json`:

```json
    "triageBody": "When an import finishes, the app categorises what it recognises and asks you about the rest — one merchant at a time, not one transaction at a time. Every answer is saved as a rule, so the next statement asks less. If you leave some of it, any statement takes you back to that screen from the card's page.",
```

Render it in the statements chapter, beside the mock from Step 4.

- [ ] **Step 3: Extend the settings chapter**

`messages/es.json`:

```json
    "rulesBody": "En Ajustes → Reglas de categorías está todo lo que la app aprendió: el texto que busca en cada consumo y la categoría que le pone. El número dice cuántas líneas de tus estados de cuenta coinciden con esa regla — una regla con 40 líneas está trabajando, una con 0 probablemente tiene un error de tipeo. Puedes acortar el texto para que cubra todas las sucursales de un comercio. Editar una regla cambia las próximas importaciones; no recategoriza lo que ya guardaste.",
```

`messages/en.json`:

```json
    "rulesBody": "Settings → Category rules holds everything the app has learned: the text it looks for in a transaction, and the category it assigns. The number says how many lines of your statements match that rule — one matching 40 lines is working, one matching 0 probably has a typo. You can shorten the text so it covers every branch of a merchant. Editing a rule changes future imports; it does not recategorise what you already saved.",
```

- [ ] **Step 4: Add a mock**

In `components/help/mocks.tsx`, add `TriageMock` following the shape of the existing mocks: two merchant rows with a count, an amount and a category rail, plus the "68 de 80" line. Render it in the statements chapter beside the new copy.

- [ ] **Step 5: Verify**

Run: `npm run lint && npx tsc --noEmit`, then check `/help` renders both new sections in both locales.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/help/page.tsx" components/help/mocks.tsx messages/en.json messages/es.json
git commit -m "docs(help): describe triage and the rules screen"
```

---

### Task 11: Close the audit items

**Files:**
- Modify: `docs/product-audit-dominican-market.md`

- [ ] **Step 1: Mark UX-03 and BUILD-13 done**

Change `### UX-03 · Fix · High` from `- [ ] Done` to `- [x] Done (<date>)` and add a **Done** paragraph in the house style: what shipped, the file names, and what remains. Do the same for `#### BUILD-13 · Medium`. In §07's *Now* horizon, tick `Categorisation triage + rules screen (UX-03, BUILD-13)`.

State the honest remainder under UX-03: statements imported before this change keep the `Other` category they were given and never appear in triage.

- [ ] **Step 2: Commit**

```bash
git add docs/product-audit-dominican-market.md
git commit -m "docs(audit): mark UX-03 and BUILD-13 done"
```

---

## Verification

Before calling the whole plan done:

```bash
npm test && npm run lint && npx tsc --noEmit
```

Then, with the human's go-ahead to start the dev server, one end-to-end pass: import a real statement → land on triage → assign two merchants → confirm the count drops, the ledger rows carry the category, the donut's grey slice shrinks, and `/settings/rules` lists both new rules with their line counts.
