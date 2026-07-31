# Welcome Bonus Spend Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user set a welcome-bonus spend goal (amount + currency + due date) on a
credit card, and show a progress bar on the card's detail page tracking spend toward it,
summed across every currency line sharing that card's `card_group_id`.

**Architecture:** Three new nullable columns on `accounts` (goal amount, goal currency,
due date). No group-level table changes — a small resolver (`resolveEffectiveBonus`)
computes the "effective" goal for an account by checking its own row, then falling back to
whichever card_group sibling was most recently updated. Spend is summed from
`transactions` across all lines in the group, converted line-by-line into the goal
currency via the existing `lib/fx.ts` helpers, using today's live rate (a known, accepted
approximation — see spec §3/§7).

**Tech Stack:** Next.js App Router, Supabase (Postgres + supabase-js), react-hook-form,
zod, next-intl, vitest, shadcn-style UI primitives (`components/ui/*`).

**Spec:** `docs/superpowers/specs/2026-07-31-welcome-bonus-progress-design.md`

## Global Constraints

- All-or-none validation: `welcome_bonus_goal_amount`, `welcome_bonus_goal_currency`,
  `welcome_bonus_due_date` must be either all set or all null — enforced in
  `accountInput`'s `superRefine`, not the DB.
- Applies only to `type === "credit_card"` accounts.
- No fan-out writes across `card_group_id` siblings — resolution happens at read time only
  (see spec §2).
- Spend sums `type = 'expense'` transactions with **no lower date bound** and **no**
  `budget_only`/`exclude_from_budget` filter — "all expenses count toward the goal" is a
  direct user requirement, not an oversight.
- The welcome-bonus form fields are hidden by default behind a "Track a welcome bonus goal"
  switch (`has_welcome_bonus_goal`, client-only state, not part of `AccountInput`).
- No live Supabase project is linked in this environment — migrations can't be pushed;
  `lib/supabase/types.ts` must be hand-edited to match the new migration (see Task 1).

---

### Task 1: Database migration + hand-edited types

**Files:**
- Create: `supabase/migrations/20260731120000_welcome_bonus.sql`
- Modify: `lib/supabase/types.ts:71` (Row), `:101` (Insert), `:131` (Update) — the
  `accounts` table's three type blocks, each currently ending with `user_id: string` /
  `user_id?: string`.

**Interfaces:**
- Produces: `accounts.welcome_bonus_goal_amount` (`number | null`),
  `accounts.welcome_bonus_goal_currency` (`string | null`),
  `accounts.welcome_bonus_due_date` (`string | null`) — consumed by every later task.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731120000_welcome_bonus.sql
alter table public.accounts
  add column welcome_bonus_goal_amount   numeric(18,4),
  add column welcome_bonus_goal_currency text check (char_length(welcome_bonus_goal_currency) = 3),
  add column welcome_bonus_due_date      date;
```

No RLS changes needed — these are plain columns on a table already covered by the
existing per-user `accounts` policies.

- [ ] **Step 2: Hand-edit `lib/supabase/types.ts`**

In the `accounts` table's `Row` block, add after `user_id: string` (currently line 71):

```ts
          user_id: string
          welcome_bonus_due_date: string | null
          welcome_bonus_goal_amount: number | null
          welcome_bonus_goal_currency: string | null
```

In the `Insert` block, add after `user_id: string` (currently line 101):

```ts
          user_id: string
          welcome_bonus_due_date?: string | null
          welcome_bonus_goal_amount?: number | null
          welcome_bonus_goal_currency?: string | null
```

In the `Update` block, add after `user_id?: string` (currently line 131):

```ts
          user_id?: string
          welcome_bonus_due_date?: string | null
          welcome_bonus_goal_amount?: number | null
          welcome_bonus_goal_currency?: string | null
```

(Alphabetical order, matching every other field in these three blocks — `w` sorts after
`user_id`, so these three are the new last entries in each block.)

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors (the columns aren't referenced anywhere yet, so this just confirms
the hand-edit didn't break the `Database` type's structure).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260731120000_welcome_bonus.sql lib/supabase/types.ts
git commit -m "feat(accounts): add welcome-bonus goal columns"
```

---

### Task 2: Bonus resolution + spend calculation helpers

**Files:**
- Create: `lib/accounts/welcome-bonus.ts`
- Test: `lib/accounts/welcome-bonus.test.ts`

**Interfaces:**
- Consumes: `CardGroupSibling` type from `lib/accounts/queries.ts` (produced in Task 3 —
  written first here as a local type, then re-pointed at the real export once Task 3
  lands; see Step 6).
- Produces:
  - `resolveEffectiveBonus(accountId: string, group: CardGroupSibling[]): CardGroupSibling | null`
  - `sumConvertedSpend(rows: {account_id: string; total_amount: number}[], currencyByAccount: Map<string, string>, goalCurrency: string, rates: Record<string, number>): number`
  - `getWelcomeBonusSpend(supabase, lines: CardGroupSibling[], goalCurrency: string, dueDate: string): Promise<number>`

  These are consumed by Task 3 (queries re-export) and Task 8 (detail page).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/accounts/welcome-bonus.test.ts
import { describe, expect, it } from "vitest";
import { resolveEffectiveBonus, sumConvertedSpend } from "./welcome-bonus";
import type { CardGroupSibling } from "./welcome-bonus";

function sibling(overrides: Partial<CardGroupSibling>): CardGroupSibling {
  return {
    id: "a",
    currency: "USD",
    welcome_bonus_goal_amount: null,
    welcome_bonus_goal_currency: null,
    welcome_bonus_due_date: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("resolveEffectiveBonus", () => {
  it("prefers the account's own goal when set", () => {
    const mine = sibling({
      id: "a",
      welcome_bonus_goal_amount: 500,
      welcome_bonus_due_date: "2026-09-01",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const sibling2 = sibling({
      id: "b",
      welcome_bonus_goal_amount: 999,
      welcome_bonus_due_date: "2026-12-01",
      updated_at: "2026-06-01T00:00:00Z",
    });
    expect(resolveEffectiveBonus("a", [mine, sibling2])).toBe(mine);
  });

  it("falls back to the most-recently-updated sibling with a goal", () => {
    const mine = sibling({ id: "a" });
    const older = sibling({
      id: "b",
      welcome_bonus_goal_amount: 500,
      welcome_bonus_due_date: "2026-09-01",
      updated_at: "2026-01-01T00:00:00Z",
    });
    const newer = sibling({
      id: "c",
      welcome_bonus_goal_amount: 800,
      welcome_bonus_due_date: "2026-10-01",
      updated_at: "2026-06-01T00:00:00Z",
    });
    expect(resolveEffectiveBonus("a", [mine, older, newer])).toBe(newer);
  });

  it("returns null when nobody in the group has a goal", () => {
    expect(resolveEffectiveBonus("a", [sibling({ id: "a" }), sibling({ id: "b" })])).toBeNull();
  });

  it("treats a partially-set row (amount without due date) as not having a goal", () => {
    const partial = sibling({ id: "a", welcome_bonus_goal_amount: 500, welcome_bonus_due_date: null });
    expect(resolveEffectiveBonus("a", [partial])).toBeNull();
  });
});

describe("sumConvertedSpend", () => {
  it("sums same-currency amounts with no conversion", () => {
    const rows = [
      { account_id: "a", total_amount: 100 },
      { account_id: "a", total_amount: 50 },
    ];
    const byAcct = new Map([["a", "USD"]]);
    expect(sumConvertedSpend(rows, byAcct, "USD", { USD: 1 })).toBeCloseTo(150, 4);
  });

  it("converts a differing-currency line into the goal currency", () => {
    const rows = [{ account_id: "a", total_amount: 100 }];
    const byAcct = new Map([["a", "EUR"]]);
    // 1 USD = 0.9 EUR  =>  crossRate(EUR, USD) = 1/0.9
    const rates = { USD: 1, EUR: 0.9 };
    expect(sumConvertedSpend(rows, byAcct, "USD", rates)).toBeCloseTo(100 / 0.9, 4);
  });

  it("falls back to 1:1 when a rate is missing rather than dropping the amount", () => {
    const rows = [{ account_id: "a", total_amount: 100 }];
    const byAcct = new Map([["a", "ZZZ"]]);
    expect(sumConvertedSpend(rows, byAcct, "USD", { USD: 1 })).toBeCloseTo(100, 4);
  });

  it("skips rows whose account isn't in the currency map", () => {
    const rows = [{ account_id: "unknown", total_amount: 100 }];
    expect(sumConvertedSpend(rows, new Map(), "USD", { USD: 1 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/accounts/welcome-bonus.test.ts`
Expected: FAIL — `./welcome-bonus` has no exports yet (module not found / import error).

- [ ] **Step 3: Write the local `CardGroupSibling` type (temporary, see Step 6)**

For now, define the type locally in `welcome-bonus.ts` so this task is runnable before
Task 3 exists. Task 3 will re-export the same shape from `queries.ts` and this file will
import it from there instead (Step 6).

- [ ] **Step 4: Implement `resolveEffectiveBonus` and `sumConvertedSpend`**

```ts
// lib/accounts/welcome-bonus.ts
import { crossRate, getExchangeRates } from "@/lib/fx";
import type { createClient } from "@/lib/supabase/server";

export type CardGroupSibling = {
  id: string;
  currency: string;
  welcome_bonus_goal_amount: number | null;
  welcome_bonus_goal_currency: string | null;
  welcome_bonus_due_date: string | null;
  updated_at: string;
};

/** The goal to show for `accountId`: its own value if fully set, otherwise the
 *  most-recently-updated fully-set value among its card_group siblings. */
export function resolveEffectiveBonus(
  accountId: string,
  group: CardGroupSibling[],
): CardGroupSibling | null {
  const mine = group.find((a) => a.id === accountId);
  if (mine?.welcome_bonus_goal_amount != null && mine.welcome_bonus_due_date != null) return mine;
  const withGoal = group
    .filter((a) => a.welcome_bonus_goal_amount != null && a.welcome_bonus_due_date != null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return withGoal[0] ?? null;
}

/** Sums `rows` (each in its own account's currency) into `goalCurrency`, using
 *  `rates` (as returned by getExchangeRates(goalCurrency)). A missing rate
 *  falls back to 1:1 rather than dropping the row — matches the fallback
 *  convention already used by convertToBase/baseRate in lib/fx.ts. Rows whose
 *  account isn't in `currencyByAccount` are skipped (shouldn't happen in
 *  practice — every queried account_id comes from the same sibling list that
 *  built the map). */
export function sumConvertedSpend(
  rows: { account_id: string; total_amount: number }[],
  currencyByAccount: Map<string, string>,
  goalCurrency: string,
  rates: Record<string, number>,
): number {
  let total = 0;
  for (const r of rows) {
    const currency = currencyByAccount.get(r.account_id);
    if (!currency) continue;
    const rate = crossRate(currency, goalCurrency, rates);
    total += r.total_amount * (rate ?? 1);
  }
  return total;
}

/** Total spend (type = 'expense') across every line in `lines`, from the
 *  start of each line's history through `dueDate` (inclusive), converted into
 *  `goalCurrency` using today's live rate. See spec §3/§7 for why a live
 *  rather than historical rate is used. */
export async function getWelcomeBonusSpend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lines: CardGroupSibling[],
  goalCurrency: string,
  dueDate: string,
): Promise<number> {
  const ids = lines.map((l) => l.id);
  if (ids.length === 0) return 0;

  const { data: rows } = await supabase
    .from("transactions")
    .select("account_id, total_amount")
    .eq("type", "expense")
    .in("account_id", ids)
    .lte("occurred_at", dueDate);

  const currencyByAccount = new Map(lines.map((l) => [l.id, l.currency]));
  const rates = await getExchangeRates(goalCurrency);
  return sumConvertedSpend(rows ?? [], currencyByAccount, goalCurrency, rates);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/accounts/welcome-bonus.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/accounts/welcome-bonus.ts lib/accounts/welcome-bonus.test.ts
git commit -m "feat(accounts): add welcome-bonus resolution and spend-conversion helpers"
```

---

### Task 3: `getCardGroupSiblings` query

**Files:**
- Modify: `lib/accounts/queries.ts` (add after `getCardStatements`, currently ending
  line 94)
- Modify: `lib/accounts/welcome-bonus.ts` (re-point the `CardGroupSibling` import at the
  new export instead of its local definition)

**Interfaces:**
- Consumes: none new (uses existing `createClient` from `lib/supabase/server`).
- Produces: `CardGroupSibling` type (now the canonical export), `getCardGroupSiblings(accountId: string): Promise<CardGroupSibling[]>` — consumed by Task 8 (detail page).

- [ ] **Step 1: Move `CardGroupSibling` into `queries.ts` and add the query**

In `lib/accounts/queries.ts`, add:

```ts
export type CardGroupSibling = {
  id: string;
  currency: string;
  welcome_bonus_goal_amount: number | null;
  welcome_bonus_goal_currency: string | null;
  welcome_bonus_due_date: string | null;
  updated_at: string;
};

const SIBLING_COLUMNS =
  "id, currency, welcome_bonus_goal_amount, welcome_bonus_goal_currency, welcome_bonus_due_date, updated_at";

/** `accountId` plus every other account sharing its card_group_id (or just
 *  itself, if it isn't in a group). Used to resolve the "effective" welcome
 *  bonus goal across a card's currency lines and to sum spend across all of
 *  them. */
export async function getCardGroupSiblings(accountId: string): Promise<CardGroupSibling[]> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select(`${SIBLING_COLUMNS}, card_group_id`)
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return [];
  if (!account.card_group_id) return [account];

  const { data: siblings } = await supabase
    .from("accounts")
    .select(SIBLING_COLUMNS)
    .eq("card_group_id", account.card_group_id)
    .eq("type", "credit_card");
  return siblings ?? [account];
}
```

- [ ] **Step 2: Update `welcome-bonus.ts` to re-export the type instead of defining it**

```ts
// lib/accounts/welcome-bonus.ts — replace the local `export type CardGroupSibling = {...}`
// block with:
export type { CardGroupSibling } from "./queries";
```

Using `export type {...} from` (not a plain `import type`) keeps `CardGroupSibling`
available as `welcome-bonus.ts`'s own export, so the test file's existing `import type {
CardGroupSibling } from "./welcome-bonus"` (Task 2) keeps resolving unchanged — only the
single source of truth for the type's definition moves to `queries.ts`.

- [ ] **Step 3: Verify types and tests still pass**

Run: `npx tsc --noEmit && npx vitest run lib/accounts/welcome-bonus.test.ts`
Expected: no errors, tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/accounts/queries.ts lib/accounts/welcome-bonus.ts
git commit -m "feat(accounts): add getCardGroupSiblings query"
```

---

### Task 4: Zod schema validation

**Files:**
- Modify: `lib/accounts/schema.ts`

**Interfaces:**
- Produces: `AccountInput` gains `welcome_bonus_goal_amount?: number`,
  `welcome_bonus_goal_currency?: string`, `welcome_bonus_due_date?: string` — consumed by
  Task 5 (`toColumns`) and Task 6 (form).

- [ ] **Step 1: Add the fields and the all-or-none rule**

In `lib/accounts/schema.ts`, add to the credit-card fields group (after `card_group_id`):

```ts
    welcome_bonus_goal_amount: z.coerce.number().min(0).optional(),
    welcome_bonus_goal_currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase().optional(),
    welcome_bonus_due_date: z.string().optional().or(z.literal("")),
```

In the `superRefine`, add a new block (alongside the existing `credit_card`/`loan`
blocks):

```ts
    if (v.type === "credit_card") {
      const bonusFields = [
        v.welcome_bonus_goal_amount,
        v.welcome_bonus_goal_currency,
        v.welcome_bonus_due_date,
      ];
      const anySet = bonusFields.some((f) => f !== undefined && f !== "");
      const allSet = bonusFields.every((f) => f !== undefined && f !== "");
      if (anySet && !allSet) {
        ctx.addIssue({
          code: "custom",
          path: ["welcome_bonus_goal_amount"],
          message: "Set the goal amount, currency, and due date together, or leave all blank",
        });
      }
    }
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors — `AccountInput` now includes the three optional fields.

- [ ] **Step 3: Commit**

```bash
git add lib/accounts/schema.ts
git commit -m "feat(accounts): validate welcome-bonus goal fields as all-or-none"
```

---

### Task 5: Server action column mapping

**Files:**
- Modify: `app/(app)/accounts/actions.ts:14-42` (`toColumns`)

**Interfaces:**
- Consumes: `AccountInput`'s three new optional fields (Task 4).
- Produces: `accounts` insert/update payloads now include the three columns — consumed
  transparently by `createAccount`/`updateAccount` (no other changes to those functions).

- [ ] **Step 1: Add the three columns to `toColumns`**

In `app/(app)/accounts/actions.ts`, inside `toColumns()`, add alongside the other
`nullIf(!card, ...)` credit-card-only lines:

```ts
    welcome_bonus_goal_amount: nullIf(!card, v.welcome_bonus_goal_amount ?? null),
    welcome_bonus_goal_currency: nullIf(!card, orNull(v.welcome_bonus_goal_currency)),
    welcome_bonus_due_date: nullIf(!card, orNull(v.welcome_bonus_due_date)),
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/accounts/actions.ts"
git commit -m "feat(accounts): persist welcome-bonus goal fields on save"
```

---

### Task 6: Form UI — switch-gated goal fields

**Files:**
- Modify: `components/accounts/account-form-dialog.tsx`

**Interfaces:**
- Consumes: `CardGroupSibling` type (Task 3), `AccountInput` fields (Task 4).
- Produces: `AccountFormDialog` gains an optional `effectiveBonus?: CardGroupSibling |
  null` prop — consumed by Task 7 (`AccountDetailActions`).

- [ ] **Step 1: Extend `FormValues` and add the local switch state**

Add to the `FormValues` type (after `card_group_id`):

```ts
  welcome_bonus_goal_amount: string;
  welcome_bonus_goal_currency: string;
  welcome_bonus_due_date: string;
  has_welcome_bonus_goal: boolean;
```

- [ ] **Step 2: Update `defaultsFor` to prefill from `effectiveBonus`**

```ts
function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
): FormValues {
  const bonus =
    effectiveBonus ??
    (account
      ? {
          welcome_bonus_goal_amount: account.welcome_bonus_goal_amount,
          welcome_bonus_goal_currency: account.welcome_bonus_goal_currency,
          welcome_bonus_due_date: account.welcome_bonus_due_date,
        }
      : null);
  return {
    // ...existing fields unchanged...
    welcome_bonus_goal_amount: str(bonus?.welcome_bonus_goal_amount),
    welcome_bonus_goal_currency: bonus?.welcome_bonus_goal_currency ?? baseCurrency,
    welcome_bonus_due_date: bonus?.welcome_bonus_due_date ?? "",
    has_welcome_bonus_goal: bonus?.welcome_bonus_goal_amount != null,
  };
}
```

Add the `import type { CardGroupSibling } from "@/lib/accounts/queries";` (alongside the
existing `AccountWithStatus, CurrencyRow, CardGroupRow, BankRow` import).

- [ ] **Step 3: Accept the new prop and update call sites of `defaultsFor`**

In `AccountFormDialog`'s destructured parameter list (`{ mode, account, currencies,
cardGroups, banks, baseCurrency = "USD", trigger }`) and its props type, add
`effectiveBonus` (type `CardGroupSibling | null`, no default — undefined is fine, handled
by `defaultsFor`'s fallback). Update both `useForm({ defaultValues: defaultsFor(account,
baseCurrency) })` and the `onOpenChange` handler's `reset(defaultsFor(account,
baseCurrency))` to pass the third argument: `defaultsFor(account, baseCurrency,
effectiveBonus)`.

Add `const hasBonusGoal = useWatch({ control, name: "has_welcome_bonus_goal" }) ?? false;`
alongside the existing `type`/`groupSel`/`bankSel` watches.

- [ ] **Step 4: Render the switch + fields**

In the `card ? (<>...</>) : null` block, add after the `card_group_id` field's closing
`</div>`:

```tsx
                <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                  <Controller
                    control={control}
                    name="has_welcome_bonus_goal"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="has_welcome_bonus_goal" className="font-normal">
                          {t("welcomeBonusToggleLabel")}
                        </Label>
                        <Switch
                          id="has_welcome_bonus_goal"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                  {hasBonusGoal ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="welcome_bonus_goal_amount">{t("welcomeBonusGoalAmountLabel")}</Label>
                        <Input
                          id="welcome_bonus_goal_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          {...register("welcome_bonus_goal_amount")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("welcomeBonusGoalCurrencyLabel")}</Label>
                        <Controller
                          control={control}
                          name="welcome_bonus_goal_currency"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.code} · {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="welcome_bonus_due_date">{t("welcomeBonusDueDateLabel")}</Label>
                        <Input id="welcome_bonus_due_date" type="date" {...register("welcome_bonus_due_date")} />
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs text-muted-foreground">{t("welcomeBonusHint")}</p>
                </div>
```

- [ ] **Step 5: Clear the fields on submit when the switch is off**

In `onSubmit`, before building `clean`, add:

```ts
      const bonusValues = values.has_welcome_bonus_goal
        ? values
        : { ...values, welcome_bonus_goal_amount: "", welcome_bonus_goal_currency: "", welcome_bonus_due_date: "" };
```

Then use `bonusValues` (not `values`) as the base object spread into `clean`:

```ts
      const clean = Object.fromEntries(
        Object.entries({ ...bonusValues, card_group_id: normalizedGroup, bank_id: normalizedBank }).map(
          ([k, v]) => [k, v === "" ? undefined : v],
        ),
      ) as Record<string, unknown>;
```

(`has_welcome_bonus_goal` itself passes through into `clean` as an extra key — harmless,
since `accountInput.safeParse` on the server simply ignores unknown keys via zod's default
strip behavior; no action needed there.)

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit && npx eslint components/accounts/account-form-dialog.tsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/accounts/account-form-dialog.tsx
git commit -m "feat(accounts): gate welcome-bonus fields behind a toggle in the account form"
```

---

### Task 7: Thread `effectiveBonus` through `AccountDetailActions`

**Files:**
- Modify: `components/accounts/account-detail-actions.tsx`

**Interfaces:**
- Consumes: `CardGroupSibling` type (Task 3).
- Produces: `AccountDetailActions` gains an `effectiveBonus?: CardGroupSibling | null`
  prop, forwarded straight to `AccountFormDialog` — consumed by Task 8 (detail page).

- [ ] **Step 1: Add the prop and forward it**

Add `effectiveBonus?: CardGroupSibling | null;` to the component's props type (import
`CardGroupSibling` from `@/lib/accounts/queries` alongside the existing type imports), and
pass `effectiveBonus={effectiveBonus}` to the `<AccountFormDialog mode="edit" .../>` call.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/accounts/account-detail-actions.tsx
git commit -m "feat(accounts): pass resolved welcome-bonus goal to the edit dialog"
```

---

### Task 8: Detail page — compute and render the progress bar

**Files:**
- Modify: `app/(app)/accounts/[id]/page.tsx`

**Interfaces:**
- Consumes: `getCardGroupSiblings` (Task 3), `resolveEffectiveBonus`,
  `getWelcomeBonusSpend` (Task 2), `AccountDetailActions`'s new `effectiveBonus` prop
  (Task 7).

- [ ] **Step 1: Fetch siblings and resolve the effective goal**

Add `getCardGroupSiblings` to the imports from `@/lib/accounts/queries`, and
`resolveEffectiveBonus, getWelcomeBonusSpend` from `@/lib/accounts/welcome-bonus`.
`createClient` is already imported.

Change:

```ts
  const [account, currencies, cardGroups, banks, activity, quickAddData, statements] =
    await Promise.all([
      getAccountById(id),
      getCurrencies(),
      getCardGroups(),
      getBanks(),
      getAccountTransactions(id),
      getQuickAddData(),
      getCardStatements(id),
    ]);
```

to:

```ts
  const [account, currencies, cardGroups, banks, activity, quickAddData, statements, siblings] =
    await Promise.all([
      getAccountById(id),
      getCurrencies(),
      getCardGroups(),
      getBanks(),
      getAccountTransactions(id),
      getQuickAddData(),
      getCardStatements(id),
      getCardGroupSiblings(id),
    ]);
```

After the existing `const supabase = await createClient();` / `profile` block, add:

```ts
  const effectiveBonus = isCardType ? resolveEffectiveBonus(id, siblings) : null;
  const dueDatePassed = effectiveBonus ? effectiveBonus.welcome_bonus_due_date! < todayISO() : true;
  const showBonus = !!effectiveBonus && !dueDatePassed;
  const bonusSpent = showBonus
    ? await getWelcomeBonusSpend(supabase, siblings, effectiveBonus!.welcome_bonus_goal_currency!, effectiveBonus!.welcome_bonus_due_date!)
    : 0;
  const bonusPct = showBonus ? (bonusSpent / effectiveBonus!.welcome_bonus_goal_amount!) * 100 : 0;
```

`isCardType` is already computed a few lines above (`const isCardType = type ===
"credit_card";`) — this block goes right after it, before the `owed`/`util` calculations.

Add a small local helper near the top of the file (or inline) — `todayISO`:

```ts
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
```

(A UTC-based "today" date string, comparable lexically against `welcome_bonus_due_date`'s
`YYYY-MM-DD` format — same comparison style `formatDate` already relies on elsewhere in
this file.)

- [ ] **Step 2: Render the bar**

In the hero `Card`'s `isCardType` branch, directly after the existing utilization `<div
className="mt-4 max-w-sm space-y-2">...</div>` block (closing around the `util !== null`
conditional), add:

```tsx
            {showBonus ? (
              <div className="mt-4 max-w-sm space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("welcomeBonusProgress")}</span>
                  <span>{formatPercent(bonusPct)}</span>
                </div>
                <Progress value={Math.min(Math.max(bonusPct, 0), 100)} />
                <p className="text-xs text-muted-foreground">
                  {t("welcomeBonusDetail", {
                    spent: formatMoney(bonusSpent, effectiveBonus!.welcome_bonus_goal_currency!),
                    goal: formatMoney(effectiveBonus!.welcome_bonus_goal_amount!, effectiveBonus!.welcome_bonus_goal_currency!),
                    date: formatDate(effectiveBonus!.welcome_bonus_due_date!, locale),
                  })}
                </p>
              </div>
            ) : null}
```

- [ ] **Step 3: Pass `effectiveBonus` to `AccountDetailActions`**

Update the `<AccountDetailActions .../>` call to add `effectiveBonus={effectiveBonus}`.

- [ ] **Step 4: Verify types and lint**

Run: `npx tsc --noEmit && npx eslint "app/(app)/accounts/[id]/page.tsx"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/accounts/[id]/page.tsx"
git commit -m "feat(accounts): show welcome-bonus spend progress on the card detail page"
```

---

### Task 9: i18n strings

**Files:**
- Modify: `messages/en.json` (`AccountForm`, `AccountDetail` sections)
- Modify: `messages/es.json` (same sections)

**Interfaces:** none — pure copy, consumed by Tasks 6 and 8 (`useTranslations`/`getTranslations` calls already reference these keys).

- [ ] **Step 1: Add English keys**

In `messages/en.json`'s `AccountForm` object, add (after `groupHint`):

```json
    "welcomeBonusToggleLabel": "Track a welcome bonus goal",
    "welcomeBonusGoalAmountLabel": "Spend goal",
    "welcomeBonusGoalCurrencyLabel": "Goal currency",
    "welcomeBonusDueDateLabel": "Welcome bonus due date",
    "welcomeBonusHint": "Set once on any line of this card — spend across every currency line counts toward the goal, and the goal shows the same everywhere.",
```

In `AccountDetail`, add (after `utilization`):

```json
    "welcomeBonusProgress": "Welcome bonus progress",
    "welcomeBonusDetail": "{spent} of {goal} spent, due {date}",
```

- [ ] **Step 2: Add Spanish keys**

In `messages/es.json`'s `AccountForm` object, add:

```json
    "welcomeBonusToggleLabel": "Seguir una meta de bono de bienvenida",
    "welcomeBonusGoalAmountLabel": "Meta de gasto",
    "welcomeBonusGoalCurrencyLabel": "Moneda de la meta",
    "welcomeBonusDueDateLabel": "Fecha límite del bono de bienvenida",
    "welcomeBonusHint": "Configúralo en cualquier línea de esta tarjeta: el gasto en todas las líneas de moneda cuenta para la meta, y la meta se muestra igual en todas partes.",
```

In `AccountDetail`, add:

```json
    "welcomeBonusProgress": "Progreso del bono de bienvenida",
    "welcomeBonusDetail": "{spent} de {goal} gastado, vence el {date}",
```

- [ ] **Step 3: Verify JSON is well-formed and keys are used**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/es.json'))"`
Expected: no output (no parse errors).

Run: `npx tsc --noEmit`
Expected: no errors (next-intl's typed messages, if configured, would otherwise flag
missing/extra keys).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(accounts): add welcome-bonus i18n strings"
```

---

### Task 10: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (ask before starting if one might already be running — see project
convention).

- [ ] **Step 2: Single-line card walkthrough**

Create or edit a credit card with no `card_group_id`. Toggle on "Track a welcome bonus
goal", set an amount, currency, and due date a few weeks out. Save. Confirm the detail
page shows the progress bar with the correct spent/goal/percentage. Log a new expense on
that card and confirm the bar updates after refresh.

- [ ] **Step 3: Grouped-card walkthrough**

Create two credit-card lines in different currencies sharing one `card_group_id`. Set the
welcome bonus goal on line A only. Open line B's edit form and confirm the goal fields are
prefilled from line A. Open line B's detail page and confirm its progress bar shows the
same goal and **spend summed across both lines**, with line B's own-currency expenses
converted into the goal currency. Log an expense on line B and confirm it moves both
lines' progress bars.

- [ ] **Step 4: Due-date-passed case**

Edit the goal's due date to yesterday. Confirm the progress bar disappears from the detail
page (both lines, if grouped) while the goal fields remain visible/editable in the form.

- [ ] **Step 5: Clearing the goal**

Edit a card with a goal set, toggle "Track a welcome bonus goal" off, save. Confirm the
progress bar disappears and re-opening the edit form shows the toggle off with blank
fields.

- [ ] **Step 6: Final check**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: no errors, all tests pass.
