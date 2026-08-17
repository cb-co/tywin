# Quick Add Compact Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user log a typical expense in three taps, without making any field that exists today unreachable.

**Architecture:** `TransactionForm` gains a `compact` prop instead of being forked. Compact starts collapsed and a `Más detalles` disclosure expands the exact field set that renders today, in place. Every decidable rule — which account to default to, how to rank categories, when tax and fee apply — moves into a new pure module `lib/transactions/defaults.ts` and is unit-tested there, because this repo has no component tests.

**Tech Stack:** Next.js App Router (server components + server actions), react-hook-form + zod, Base UI primitives, Tailwind v4, next-intl, Supabase/Postgres, vitest.

**Spec:** `docs/specs/2026-08-17-quick-add-compact-design.md` — read §1 (tax rules) and §7 (known Select bug) before starting.

## Global Constraints

- **Never edit an applied migration.** `supabase/migrations/*` are immutable once run. Tax and fee arithmetic lives in a Postgres trigger and stays there; TypeScript only ever *previews* it.
- **No new migration in this plan.** Every change is app-side. If you think you need a schema change, stop and ask.
- **`compact` is opt-in.** With the prop absent, `TransactionForm` must behave byte-identically to today on `/transactions` and in the edit dialog. This is the guarantee that nothing is lost.
- **All user-facing copy goes through next-intl.** Every new string needs a key in **both** `messages/en.json` and `messages/es.json`. Never hardcode a string in JSX.
- **Spanish is the product's primary language.** Write the Spanish copy as native Dominican Spanish, not as a translation of the English.
- **Comment the *why*, not the *what*.** This codebase explains non-obvious decisions in comments (see `transaction-form.tsx:47-51`). Match that density; do not add narration of obvious code.
- **Money:** amounts are `numeric(18,4)` in Postgres. Never use `toFixed` for a stored value. Preview rounding is 4dp.
- **Verification per task:** `npm test` and `npx tsc --noEmit` must pass. Run `npm run lint` before each commit.
- **Commit at the end of every task**, with the trailers this repo uses.

---

### Task 1: Selection helpers in `lib/transactions/defaults.ts`

Pure functions that decide *which* account and *which* categories to put in front of the user. No React, no Supabase.

**Files:**
- Create: `lib/transactions/defaults.ts`
- Create: `lib/transactions/defaults.test.ts`

**Interfaces:**
- Consumes: `QuickAddAccount`, `QuickAddCategory` from `lib/transactions/queries.ts`; `TransactionType` from `lib/transactions/schema.ts`; `isBankAccount`, `AccountType` from `lib/accounts/meta.ts`.
- Produces:
  - `type RecentRow = { account_id: string | null; category_id: string | null; type: TransactionType }`
  - `rankCategoryIds(recent: RecentRow[]): string[]`
  - `recentSourceAccountId(recent: RecentRow[]): string | null`
  - `defaultAccount(accounts: QuickAddAccount[], opts: { preferredId?: string; recentAccountId?: string | null }): QuickAddAccount | undefined`
  - `orderCategories(categories: QuickAddCategory[], order: string[]): QuickAddCategory[]`

- [ ] **Step 1: Write the failing test**

Create `lib/transactions/defaults.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultAccount,
  orderCategories,
  rankCategoryIds,
  recentSourceAccountId,
  type RecentRow,
} from "./defaults";
import type { QuickAddAccount, QuickAddCategory } from "./queries";

function row(over: Partial<RecentRow> = {}): RecentRow {
  return { account_id: "a-checking", category_id: null, type: "expense", ...over };
}

function account(over: Partial<QuickAddAccount> = {}): QuickAddAccount {
  return {
    id: "a-checking",
    name: "Popular",
    currency: "DOP",
    type: "checking",
    network_fee_optional: true,
    bank_id: "bank-popular",
    ...over,
  };
}

function category(id: string): QuickAddCategory {
  return { id, name: id, emoji: null, color: null };
}

describe("rankCategoryIds", () => {
  it("orders by how often a category appears", () => {
    const recent = [
      row({ category_id: "food" }),
      row({ category_id: "transport" }),
      row({ category_id: "food" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["food", "transport"]);
  });

  it("counts expenses only — income has no category and payments default to none", () => {
    const recent = [
      row({ category_id: "transport" }),
      row({ category_id: "food", type: "payment" }),
      row({ category_id: "food", type: "payment" }),
    ];
    expect(rankCategoryIds(recent)).toEqual(["transport"]);
  });

  it("ignores uncategorised rows rather than ranking a null", () => {
    expect(rankCategoryIds([row(), row({ category_id: "food" })])).toEqual(["food"]);
  });

  it("returns nothing for an empty history", () => {
    expect(rankCategoryIds([])).toEqual([]);
  });
});

describe("recentSourceAccountId", () => {
  it("takes the source account of the most recent row", () => {
    // The query hands rows back newest-first; this trusts that order rather
    // than re-sorting, so it must not scan for anything but the first hit.
    const recent = [row({ account_id: "a-visa" }), row({ account_id: "a-checking" })];
    expect(recentSourceAccountId(recent)).toBe("a-visa");
  });

  it("skips rows with no source account", () => {
    expect(recentSourceAccountId([row({ account_id: null }), row({ account_id: "a-cash" })])).toBe(
      "a-cash",
    );
  });

  it("returns null for an empty history", () => {
    expect(recentSourceAccountId([])).toBe(null);
  });
});

describe("defaultAccount", () => {
  const accounts = [
    account({ id: "a-visa", type: "credit_card" }),
    account({ id: "a-checking", type: "checking" }),
    account({ id: "a-savings", type: "savings" }),
  ];

  it("prefers an explicitly requested account", () => {
    // The account detail page opens the form scoped to one account.
    expect(defaultAccount(accounts, { preferredId: "a-savings", recentAccountId: "a-visa" })?.id)
      .toBe("a-savings");
  });

  it("falls back to the most recently used account", () => {
    expect(defaultAccount(accounts, { recentAccountId: "a-visa" })?.id).toBe("a-visa");
  });

  it("ignores a remembered account that no longer exists", () => {
    // Archived or deleted since the row was written: the list excludes it.
    expect(defaultAccount(accounts, { recentAccountId: "a-gone" })?.id).toBe("a-checking");
  });

  it("falls back to the first bank account, never to whatever came first", () => {
    // A card or loan is a bad default source for a new expense.
    expect(defaultAccount(accounts, {})?.id).toBe("a-checking");
  });

  it("falls back to the first account when none is a bank account", () => {
    const cards = [account({ id: "a-visa", type: "credit_card" })];
    expect(defaultAccount(cards, {})?.id).toBe("a-visa");
  });

  it("returns undefined when there are no accounts at all", () => {
    expect(defaultAccount([], {})).toBeUndefined();
  });
});

describe("orderCategories", () => {
  const categories = [category("food"), category("transport"), category("home")];

  it("puts ranked categories first, in rank order", () => {
    expect(orderCategories(categories, ["home", "transport"]).map((c) => c.id)).toEqual([
      "home",
      "transport",
      "food",
    ]);
  });

  it("keeps unranked categories in their existing sort_order", () => {
    expect(orderCategories(categories, []).map((c) => c.id)).toEqual([
      "food",
      "transport",
      "home",
    ]);
  });

  it("drops ranked ids that no longer match a category", () => {
    expect(orderCategories(categories, ["deleted", "home"]).map((c) => c.id)).toEqual([
      "home",
      "food",
      "transport",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/transactions/defaults.test.ts`
Expected: FAIL — `Failed to resolve import "./defaults"`.

- [ ] **Step 3: Write the implementation**

Create `lib/transactions/defaults.ts`:

```ts
import { isBankAccount, type AccountType } from "@/lib/accounts/meta";
import type { QuickAddAccount, QuickAddCategory } from "./queries";
import type { TransactionType } from "./schema";

/** A recent transaction, narrowed to the columns the defaults actually read. */
export type RecentRow = {
  account_id: string | null;
  category_id: string | null;
  type: TransactionType;
};

/** Category ids, most-used first.
 *
 *  Expenses only: income carries no category at all, and a payment defaults to
 *  the "none" sentinel, so counting either would rank noise above the
 *  categories a person actually picks. */
export function rankCategoryIds(recent: RecentRow[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recent) {
    if (r.type !== "expense" || !r.category_id) continue;
    counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The source account of the newest row that has one.
 *
 *  Relies on the caller passing rows newest-first — re-sorting here would mean
 *  duplicating the query's `occurred_at, id` ordering in two places. */
export function recentSourceAccountId(recent: RecentRow[]): string | null {
  return recent.find((r) => r.account_id)?.account_id ?? null;
}

/** Which account a new transaction should start on.
 *
 *  Falling back to `accounts[0]` alone would pick whatever the query happened
 *  to return first — a card or loan is a bad default source for an expense — so
 *  a bank account is preferred before that last resort. */
export function defaultAccount(
  accounts: QuickAddAccount[],
  { preferredId, recentAccountId }: { preferredId?: string; recentAccountId?: string | null },
): QuickAddAccount | undefined {
  const find = (id: string | null | undefined) =>
    id ? accounts.find((a) => a.id === id) : undefined;
  return (
    find(preferredId) ??
    find(recentAccountId) ??
    accounts.find((a) => isBankAccount(a.type as AccountType)) ??
    accounts[0]
  );
}

/** Categories with the most-used ones hoisted to the front.
 *
 *  Applied to the chip rail only. The full `Select` keeps the catalogue in
 *  `sort_order`, because a picker whose options move around between opens is
 *  harder to use than one that is merely long. */
export function orderCategories(
  categories: QuickAddCategory[],
  order: string[],
): QuickAddCategory[] {
  const ranked = order
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is QuickAddCategory => c !== undefined);
  const rankedIds = new Set(ranked.map((c) => c.id));
  return [...ranked, ...categories.filter((c) => !rankedIds.has(c.id))];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/transactions/defaults.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/transactions/defaults.ts lib/transactions/defaults.test.ts
git commit -m "$(cat <<'EOF'
feat(transactions): choose the account and categories a person actually uses

Quick Add defaulted to the first bank account by sort_order and the first
category in the catalogue, neither of which reflects what anyone does. These
helpers rank categories by how often they are picked and remember the last
account used, with the old behaviour kept as the fallback.

Pure and unit-tested: this repo has no component tests, so every rule the
form needs has to be decidable outside React.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fee rules in `lib/transactions/defaults.ts`

The tax/fee defaults from spec §1, plus the preview arithmetic for the compact form's quiet line.

**Files:**
- Modify: `lib/transactions/defaults.ts`
- Modify: `lib/transactions/defaults.test.ts`

**Interfaces:**
- Consumes: `RecentRow` and the imports from Task 1.
- Produces:
  - `type FeeFlags = { include_tax: boolean; include_commission: boolean }`
  - `resolveFeeDefaults(args: { type: TransactionType; src?: { type: string } | null; dst?: { type: string } | null }): FeeFlags`
  - `feeParts(args: { amount: number; src?: FeeAccount | null; dst?: { bank_id: string | null } | null } & FeeFlags): { tax: number; fee: number }`
  - `type FeeAccount = { bank_id: string | null; transfer_tax_rate: number; network_fee_amount: number }`

**Background — read before implementing.** `tax_amount` and `fee_amount` are computed by a Postgres `BEFORE INSERT` trigger, not by the app (`supabase/migrations/20260719031353_banks_normalize.sql:64`):

```sql
new.tax_amount := case when new.include_tax
  then round(new.amount * coalesce(src.transfer_tax_rate, 0), 4) else 0 end;
new.fee_amount := case when new.include_commission and not same_bank
  then coalesce(src.network_fee_amount, 0) else 0 end;
```

`feeParts` mirrors this so the form can show a figure *before* the row exists. The trigger stays authoritative for anything stored. A sub-cent divergence is an accepted risk — see spec §2. **Do not write a test that claims to compare TypeScript against SQL**; there is no local Postgres in this repo and such a test would only assert the TypeScript against itself.

- [ ] **Step 1: Write the failing test**

Append to `lib/transactions/defaults.test.ts`. **Add `feeParts` and `resolveFeeDefaults` to the existing `./defaults` import at the top of the file** — do not write a second import statement, `eslint` rejects it:

```ts
const bank = { type: "checking" };
const savings = { type: "savings" };
const cash = { type: "cash" };
const card = { type: "credit_card" };
const loan = { type: "loan" };

describe("resolveFeeDefaults", () => {
  // The transfer tax is an "impuesto por débito a cuenta" — it follows the
  // bank debit, so what the money came OUT of decides it.
  it("taxes an expense paid from a bank account", () => {
    expect(resolveFeeDefaults({ type: "expense", src: bank })).toEqual({
      include_tax: true,
      include_commission: false,
    });
  });

  it("does not tax an expense paid in cash or on a card — no account was debited", () => {
    expect(resolveFeeDefaults({ type: "expense", src: cash }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "expense", src: card }).include_tax).toBe(false);
  });

  it("taxes a payment into a card or a loan", () => {
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: card }).include_tax).toBe(true);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: loan }).include_tax).toBe(true);
  });

  it("does not tax money moved between the user's own accounts", () => {
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: cash }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: bank }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: savings }).include_tax).toBe(false);
  });

  it("does not tax a payment that did not come from a bank account", () => {
    expect(resolveFeeDefaults({ type: "payment", src: cash, dst: card }).include_tax).toBe(false);
    expect(resolveFeeDefaults({ type: "payment", src: card, dst: loan }).include_tax).toBe(false);
  });

  it("never taxes income", () => {
    expect(resolveFeeDefaults({ type: "income", src: bank }).include_tax).toBe(false);
  });

  it("holds off until a destination is chosen", () => {
    // Showing a tax line for a payment with no destination would announce a
    // charge the user has not yet described.
    expect(resolveFeeDefaults({ type: "payment", src: bank, dst: null }).include_tax).toBe(false);
  });

  it("never turns the network fee on by default", () => {
    // A flat per-transfer commission is charged by some transfers and not
    // others; it is added deliberately, not assumed.
    for (const args of [
      { type: "expense", src: bank },
      { type: "payment", src: bank, dst: card },
      { type: "payment", src: bank, dst: loan },
    ] as const) {
      expect(resolveFeeDefaults(args).include_commission).toBe(false);
    }
  });

  it("handles a missing source without throwing", () => {
    expect(resolveFeeDefaults({ type: "expense", src: null })).toEqual({
      include_tax: false,
      include_commission: false,
    });
  });
});

describe("feeParts", () => {
  const src = { bank_id: "bank-popular", transfer_tax_rate: 0.002, network_fee_amount: 25 };

  it("previews the tax as a share of the amount", () => {
    expect(feeParts({ amount: 250, src, include_tax: true, include_commission: false })).toEqual({
      tax: 0.5,
      fee: 0,
    });
  });

  it("previews nothing when the flag is off", () => {
    expect(feeParts({ amount: 250, src, include_tax: false, include_commission: false })).toEqual({
      tax: 0,
      fee: 0,
    });
  });

  it("rounds the tax to the 4dp the column stores", () => {
    expect(feeParts({ amount: 333.33, src, include_tax: true, include_commission: false }).tax)
      .toBe(0.6667);
  });

  it("previews the network fee as a flat amount, not a rate", () => {
    expect(
      feeParts({
        amount: 1000,
        src,
        dst: { bank_id: "bank-bhd" },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(25);
  });

  it("waives the fee within the same bank", () => {
    expect(
      feeParts({
        amount: 1000,
        src,
        dst: { bank_id: "bank-popular" },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(0);
  });

  it("does not treat two unknown banks as the same bank", () => {
    // Two nulls are not a match — that would waive a fee that was charged.
    expect(
      feeParts({
        amount: 1000,
        src: { ...src, bank_id: null },
        dst: { bank_id: null },
        include_tax: false,
        include_commission: true,
      }).fee,
    ).toBe(25);
  });

  it("treats a missing source as costing nothing", () => {
    expect(feeParts({ amount: 250, src: null, include_tax: true, include_commission: true }))
      .toEqual({ tax: 0, fee: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/transactions/defaults.test.ts`
Expected: FAIL — `resolveFeeDefaults is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `lib/transactions/defaults.ts`:

```ts
export type FeeFlags = { include_tax: boolean; include_commission: boolean };

/** What `feeParts` needs off the source account to price a row. */
export type FeeAccount = {
  bank_id: string | null;
  transfer_tax_rate: number;
  network_fee_amount: number;
};

const NO_FEES: FeeFlags = { include_tax: false, include_commission: false };

/** Destinations that are the user's own money moving rather than a debt being
 *  settled. Paying a card or a loan is money leaving; moving it to your own
 *  cash or bank account is not. */
const OWN_MONEY: AccountType[] = ["cash", "checking", "savings"];

/** Which fees a new transaction should start with.
 *
 *  The transfer tax is an "impuesto por débito a cuenta": it follows the debit,
 *  so the SOURCE decides whether it applies at all, and a cash purchase or a
 *  card swipe is never taxed. The network fee is a flat per-transfer
 *  commission that some transfers carry and others do not, so it is never
 *  assumed — the user adds it when their bank actually charged one.
 *
 *  Both remain overridable; this is only where the form starts. */
export function resolveFeeDefaults({
  type,
  src,
  dst,
}: {
  type: TransactionType;
  src?: { type: string } | null;
  dst?: { type: string } | null;
}): FeeFlags {
  if (type === "income") return NO_FEES;
  if (!src || !isBankAccount(src.type as AccountType)) return NO_FEES;
  if (type === "payment" && (!dst || OWN_MONEY.includes(dst.type as AccountType))) return NO_FEES;
  return { include_tax: true, include_commission: false };
}

/** 4dp, matching numeric(18,4). Not `toFixed`: this is arithmetic, not display. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** A PREVIEW of what the row will cost, for display before it is saved.
 *
 *  Mirrors the BEFORE INSERT trigger in
 *  supabase/migrations/20260719031353_banks_normalize.sql — the trigger is
 *  authoritative and is what `tax_amount`/`fee_amount` actually end up as.
 *  Sub-cent divergence between Postgres numeric rounding and JavaScript floats
 *  is accepted here because nothing stored reads this. If the trigger's
 *  arithmetic ever changes, in a NEW migration, change this with it.
 *  See docs/specs/2026-08-17-quick-add-compact-design.md §2. */
export function feeParts({
  amount,
  src,
  dst,
  include_tax,
  include_commission,
}: {
  amount: number;
  src?: FeeAccount | null;
  dst?: { bank_id: string | null } | null;
} & FeeFlags): { tax: number; fee: number } {
  if (!src) return { tax: 0, fee: 0 };
  // Two unknown banks are not the same bank — matching on null would waive a
  // commission that was charged.
  const sameBank = !!src.bank_id && !!dst?.bank_id && src.bank_id === dst.bank_id;
  return {
    tax: include_tax ? round4(amount * (src.transfer_tax_rate ?? 0)) : 0,
    fee: include_commission && !sameBank ? (src.network_fee_amount ?? 0) : 0,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/transactions/defaults.test.ts`
Expected: PASS, 32 tests total.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add lib/transactions/defaults.ts lib/transactions/defaults.test.ts
git commit -m "$(cat <<'EOF'
feat(transactions): default fees to how the money actually moves

The transfer tax is an impuesto por debito a cuenta, so it follows the bank
debit: on when a checking or savings account is the source, off for cash and
card sources, and off when a payment lands in an account the user already
owns. The network fee is never assumed -- it is a flat commission some
transfers carry and others do not.

feeParts previews the trigger's arithmetic so the compact form can show what
a row will cost before it exists. The trigger stays authoritative; the
divergence is accepted and documented rather than guarded against.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Serve the new defaults from `getQuickAddData`

**Files:**
- Modify: `lib/transactions/queries.ts:115-169`

**Interfaces:**
- Consumes: `rankCategoryIds`, `recentSourceAccountId`, `RecentRow` from Task 1.
- Produces: `QuickAddAccount` gains `transfer_tax_rate: number` and `network_fee_amount: number`; `QuickAddData` gains `recentAccountId: string | null` and `categoryOrder: string[]`.

**Why the two new columns:** `QuickAddAccount` currently selects `id,name,currency,type,network_fee_optional,bank_id`. `feeParts` cannot price anything without the rate and the flat fee, so both must come down with the account list.

- [ ] **Step 1: Add the two columns to the account type and its select**

In `lib/transactions/queries.ts`, extend `QuickAddAccount`:

```ts
export type QuickAddAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  network_fee_optional: boolean;
  bank_id: string | null;
  /* Both are needed client-side to preview what a row will cost before it is
     saved; the stored figures still come from the insert trigger. */
  transfer_tax_rate: number;
  network_fee_amount: number;
};
```

and its query:

```ts
      supabase
        .from("accounts")
        .select(
          "id,name,currency,type,network_fee_optional,bank_id,transfer_tax_rate,network_fee_amount",
        )
        .eq("is_archived", false)
        .order("sort_order")
        .order("created_at"),
```

- [ ] **Step 2: Add the recent-history query**

Add a fifth entry to the existing `Promise.all` destructure in `getQuickAddData`:

```ts
  const [
    { data: accounts },
    { data: categories },
    { data: currencies },
    { data: profile },
    { data: recent },
  ] = await Promise.all([
    // ...the four existing queries, unchanged...
    /* Enough history to rank categories meaningfully without paying for a full
       scan. Ordered by id as a tiebreak because occurred_at is date-only, so
       several rows a day share a timestamp and the "most recent account" would
       otherwise be arbitrary among them. */
    supabase
      .from("transactions")
      .select("account_id,category_id,type")
      .in("type", ["expense", "payment"])
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(60),
  ]);
```

- [ ] **Step 3: Return the derived defaults**

```ts
  const recentRows = (recent ?? []) as RecentRow[];

  return {
    accounts: accounts ?? [],
    categories: categories ?? [],
    currencies: currencies ?? [],
    baseCurrency,
    recentAccountId: recentSourceAccountId(recentRows),
    categoryOrder: rankCategoryIds(recentRows),
    rates: await getExchangeRates(baseCurrency),
  };
```

Extend the `QuickAddData` type with the two new fields, and import `rankCategoryIds`, `recentSourceAccountId`, and `type RecentRow` from `./defaults`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. If `TransactionForm` errors on a missing property, you have found a call site constructing `QuickAddData` by hand — fix it there rather than making the new fields optional.

- [ ] **Step 5: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all pass, nothing newly broken.

- [ ] **Step 6: Commit**

```bash
git add lib/transactions/queries.ts
git commit -m "$(cat <<'EOF'
feat(transactions): serve last-used account and category ranking

One more query on the Promise.all that getQuickAddData already runs, reading
sixty recent rows to derive the account someone last spent from and the
categories they pick most. No new column and no migration.

Also brings down transfer_tax_rate and network_fee_amount, which the account
list omitted -- without them the form cannot preview what a row will cost.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Apply the new defaults in `TransactionForm`

Behaviour only. No layout change yet, so this task is reviewable on its own: `/transactions` looks identical and starts with different toggle states and a different account.

**Files:**
- Modify: `components/transactions/transaction-form.tsx:127-133` (default account), `:172-185` (default values), `:237-245` (the defaults effect)

**Interfaces:**
- Consumes: `defaultAccount`, `resolveFeeDefaults` from Task 1/2; `recentAccountId` from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Replace the default-account computation**

Delete the `firstAccount` block at `:127-133` and its comment, replacing it with:

```ts
  const firstAccount = defaultAccount(accounts, {
    preferredId: defaultAccountId,
    recentAccountId: data.recentAccountId,
  });
```

The reasoning that comment carried now lives on `defaultAccount` in `lib/transactions/defaults.ts`.

- [ ] **Step 2: Seed the fee flags from the shared rule**

Above `useForm`, add:

```ts
  /* Seeded here as well as in the effect below so a freshly opened form paints
     with the right toggles rather than flipping them a frame later. */
  const initialFees = resolveFeeDefaults({ type: "expense", src: firstAccount });
```

and in `defaultValues`, replace the two fee lines:

```ts
          include_tax: initialFees.include_tax,
          include_commission: initialFees.include_commission,
```

- [ ] **Step 3: Replace the defaults effect**

At `:239-245`, replace the body:

```ts
  // Smart defaults, re-derived whenever the accounts or the type change.
  // exclude_from_budget is unrelated to fees: a card expense is excluded
  // because the budget counts the statement payment instead.
  useEffect(() => {
    if (isEdit || !src) return;
    const fees = resolveFeeDefaults({ type, src, dst });
    setValue("include_tax", fees.include_tax);
    setValue("include_commission", fees.include_commission);
    setValue("exclude_from_budget", type === "expense" && src.type === "credit_card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);
```

- [ ] **Step 4: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all pass. `sameBankPayment` is still used by the fee toggle's "exento, mismo banco" hint at `:529-532`, so it must remain — if lint reports it unused, you have deleted too much.

- [ ] **Step 5: Verify in the app**

**Ask the user before starting the dev server.** Then, on `/transactions`, open Add transaction and confirm:
- an expense from a checking account starts with *Apply transfer tax* **on** and *Apply network fee* **off**;
- switching the source to a cash or credit-card account turns tax **off**;
- a payment from checking into a credit card has tax **on**; into another checking account, **off**;
- the source account defaults to whatever you last spent from.

- [ ] **Step 6: Commit**

```bash
git add components/transactions/transaction-form.tsx
git commit -m "$(cat <<'EOF'
feat(transactions): start new rows on the shared defaults

Swaps the inline useEffect rules for resolveFeeDefaults and the sort_order
guess for defaultAccount, so both modes of the form agree with the tested
module rather than restating the reasoning in JSX.

Applies to /transactions too, not only Quick Add: the values are visible
before saving, and two forms disagreeing about what a transaction costs
would be worse than a wider change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `compact` prop, the disclosure, and the account/date line

The structural half of the feature. After this task Quick Add is already usable and short; the rail and the fee line refine it.

**Files:**
- Modify: `components/transactions/transaction-form.tsx`
- Create: `components/transactions/account-date-line.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: `TransactionForm` accepts `compact?: boolean`; `<AccountDateLine>` with props `{ accountLabel: string; destinationLabel?: string; dateLabel: string; onEdit: () => void }`.

- [ ] **Step 1: Add the i18n keys**

In `messages/en.json` under `TransactionForm`:

```json
    "moreDetails": "More details",
    "lessDetails": "Fewer details",
    "today": "today",
    "noDestination": "choose destination",
    "summaryAria": "Account, destination and date — opens the full fields",
```

In `messages/es.json` under `TransactionForm`:

```json
    "moreDetails": "Más detalles",
    "lessDetails": "Menos detalles",
    "today": "hoy",
    "noDestination": "elegir destino",
    "summaryAria": "Cuenta, destino y fecha — abre los campos completos",
```

- [ ] **Step 2: Build the summary line**

Create `components/transactions/account-date-line.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

/** The one-line stand-in for the account, destination and date fields.
 *
 *  One button rather than three: all three land in the same place — the
 *  expanded field set — so splitting them would promise a precision the
 *  disclosure does not have. The line's job is to state what the form already
 *  decided, so the common case is reading it and moving on. */
export function AccountDateLine({
  accountLabel,
  destinationLabel,
  dateLabel,
  onEdit,
}: {
  accountLabel: string;
  destinationLabel?: string;
  dateLabel: string;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("summaryAria")}
      className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span>{accountLabel}</span>
      {destinationLabel ? (
        <>
          <span aria-hidden>→</span>
          <span>{destinationLabel}</span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>{dateLabel}</span>
    </button>
  );
}
```

- [ ] **Step 3: Add the prop and the disclosure state**

In `transaction-form.tsx`, add `compact = false` to the props and destructure it. Then:

```ts
  /* Compact is a starting state, not a reduced feature set: expanding reveals
     the very same fields /transactions renders, so nothing is unreachable from
     Quick Add. Statement-imported rows never start collapsed — their whole
     point is reviewing what the issuer sent. */
  const [expanded, setExpanded] = useState(!compact || fromStatement);
```

Place this after the `fromStatement` declaration at `:105`.

- [ ] **Step 4: Gate the full field set behind `expanded`**

Wrap these existing blocks in `{expanded ? ( ... ) : null}`, leaving their contents untouched:
- the source account field (`:433-449`)
- the destination field (`:451-471`) — its own `type === "payment"` condition stays; the `expanded` gate goes outside it
- the category `Select` block (`:473-502`)
- the fee toggles block (`:504-554`)
- the date + description grid (`:556-578`)
- the notes block (`:580-593`)

Then add the disclosure and, when collapsed, the summary line, immediately before the submit button:

```tsx
      {compact ? (
        <>
          {expanded ? null : (
            <AccountDateLine
              accountLabel={src ? accountOptionLabel(src) : ""}
              destinationLabel={
                type === "payment" ? (dst ? accountOptionLabel(dst) : t("noDestination")) : undefined
              }
              dateLabel={
                getValues("occurred_at") === todayLocal()
                  ? t("today")
                  : getValues("occurred_at")
              }
              onEdit={() => setExpanded(true)}
            />
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 self-start text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ChevronDownIcon
              className={cn("size-4 transition-transform", expanded && "rotate-180")}
            />
            {expanded ? t("lessDetails") : t("moreDetails")}
          </button>
        </>
      ) : null}
```

Import `ChevronDownIcon` from `lucide-react` and `AccountDateLine`.

**Do not reset `expanded` when the type changes.** Flipping Gasto→Pago after opening the details must not collapse them.

- [ ] **Step 5: Never fail validation on a field the user cannot see**

A payment with no destination fails zod on `to_account_id`, which is collapsed — the user would get a rejected submit with no visible cause. `handleSubmit` takes a second callback for exactly this:

```tsx
    <form
      onSubmit={handleSubmit(onSubmit, () => setExpanded(true))}
      className="space-y-4"
    >
```

This is general rather than specific to the destination: any field that fails while collapsed becomes visible, with its `FieldError` already rendered by the existing markup.

Verify it: in compact mode switch to Pago without choosing a destination and submit. The form must expand and show the error on *To*, not fail silently.

- [ ] **Step 6: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

- [ ] **Step 8: Verify in the app**

Temporarily pass `compact` in `components/quick-add/quick-add-dialog.tsx:18` to see it (Task 8 makes this permanent). Confirm: the sheet is short, `Más detalles` reveals every field, typed values survive expanding and collapsing, and `/transactions` is unchanged.

- [ ] **Step 9: Commit**

```bash
git add components/transactions/transaction-form.tsx components/transactions/account-date-line.tsx messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
feat(transactions): give the transaction form a compact mode

Adds a compact prop that starts the form collapsed behind a Mas detalles
disclosure, with the account and date folded into a one-line summary. The
expanded state is the existing form, unchanged -- which is what makes the
short version safe: nothing it hides is unreachable.

Without the prop the form renders exactly as before, so /transactions and
the edit dialog are untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The category chip rail

**Files:**
- Create: `components/transactions/category-rail.tsx`
- Modify: `components/transactions/transaction-form.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `orderCategories` (Task 1), `categoryOrder` (Task 3).
- Produces: `<CategoryRail>` with props `{ categories: QuickAddCategory[]; value: string; onChange: (id: string) => void; onMore: () => void }`.

- [ ] **Step 1: Add the i18n keys**

`messages/en.json` under `TransactionForm`: `"moreCategories": "All categories"`
`messages/es.json` under `TransactionForm`: `"moreCategories": "Todas las categorías"`

- [ ] **Step 2: Build the rail**

Create `components/transactions/category-rail.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { QuickAddCategory } from "@/lib/transactions/queries";

/** How many chips before the overflow. Five is what fits on the narrowest
 *  phone this app targets without the rail needing a scroll to reveal that it
 *  scrolls. */
const VISIBLE = 5;

/** The category picker for compact mode.
 *
 *  A rail rather than a Select because category is the field most often
 *  changed in the app's most repeated action, and a dropdown costs an open, a
 *  scroll and a tap where a chip costs one. The full catalogue stays one tap
 *  away, so nothing is lost for the long tail. */
export function CategoryRail({
  categories,
  value,
  onChange,
  onMore,
}: {
  categories: QuickAddCategory[];
  value: string;
  onChange: (id: string) => void;
  onMore: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const shown = categories.slice(0, VISIBLE);
  /* A category picked from the full list is kept on the rail even when it does
     not rank, or the chosen chip would vanish the moment it was chosen. */
  const selectedOffRail =
    value && !shown.some((c) => c.id === value)
      ? categories.find((c) => c.id === value)
      : undefined;

  return (
    <div
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      role="radiogroup"
      aria-label={t("categoryLabel")}
    >
      {[...(selectedOffRail ? [selectedOffRail] : []), ...shown].map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === c.id
              ? "border-primary bg-primary/10 text-foreground"
              : "border-input text-muted-foreground hover:text-foreground",
          )}
        >
          {c.emoji ? <span aria-hidden>{c.emoji}</span> : null}
          {c.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onMore}
        className="shrink-0 rounded-full border border-dashed border-input px-3 py-1.5 text-sm text-muted-foreground whitespace-nowrap hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {t("moreCategories")}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Render it in compact mode**

In `transaction-form.tsx`, compute the ranked list once:

```ts
  const railCategories = orderCategories(categories, data.categoryOrder);
```

Then, inside the category block, render the rail when `compact && !expanded && type === "expense"`, and the existing `Select` otherwise. The rail's `onMore` sets `expanded` to `true`, which reveals the full `Select` immediately below it:

```tsx
          {compact && !expanded && type === "expense" ? (
            <Controller
              control={control}
              name="category_id"
              render={({ field }) => (
                <CategoryRail
                  categories={railCategories}
                  value={field.value}
                  onChange={field.onChange}
                  onMore={() => setExpanded(true)}
                />
              )}
            />
          ) : null}
```

Note this sits *outside* the `expanded` gate added in Task 5 — the rail is what replaces the field while collapsed.

- [ ] **Step 4: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

- [ ] **Step 5: Verify in the app**

The rail shows most-used categories first; tapping one selects it; *Todas las categorías* expands to the full picker; a category chosen from the full list still shows as selected if you collapse again.

- [ ] **Step 6: Commit**

```bash
git add components/transactions/category-rail.tsx components/transactions/transaction-form.tsx messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
feat(transactions): pick a category from a rail instead of a dropdown

Category is the field changed most often in the action performed most often,
and a Select cost an open, a scroll and a tap for something the ranking can
usually put under the thumb. The full catalogue stays one tap away.

Keeps a category chosen from the full list pinned to the rail, or the chip
would disappear at the moment it was picked.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: The quiet fee line

**Files:**
- Create: `components/transactions/fee-summary-line.tsx`
- Modify: `components/transactions/transaction-form.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `feeParts` (Task 2), `formatMoney` from `lib/format`.
- Produces: `<FeeSummaryLine>` with props `{ tax: number; fee: number; currency: string; sameBank: boolean; onEdit: () => void }`.

**Why it exists:** Task 4 turned tax on by default for bank-sourced spending. Without this line a RD$250 lunch quietly becomes RD$250.50 with nothing on screen saying why.

- [ ] **Step 1: Add the i18n keys**

`messages/en.json` under `TransactionForm`:

```json
    "feeLineTax": "+{amount} tax",
    "feeLineFee": "+{amount} fee",
    "feeLineNoFeeSameBank": "no fee, same bank",
    "feeLineEdit": "edit",
```

`messages/es.json` under `TransactionForm`:

```json
    "feeLineTax": "+{amount} impuesto",
    "feeLineFee": "+{amount} comisión",
    "feeLineNoFeeSameBank": "sin comisión, mismo banco",
    "feeLineEdit": "editar",
```

- [ ] **Step 2: Build the line**

Create `components/transactions/fee-summary-line.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";

/** What the row will actually cost, stated rather than asked.
 *
 *  The full form asks "apply transfer tax?" as a peer field; compact computes
 *  it and says so. The figure is a preview -- the stored one comes from the
 *  insert trigger -- so this must never be the only place a charge appears. */
export function FeeSummaryLine({
  tax,
  fee,
  currency,
  sameBank,
  onEdit,
}: {
  tax: number;
  fee: number;
  currency: string;
  sameBank: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const parts = [
    tax > 0 ? t("feeLineTax", { amount: formatMoney(tax, currency) }) : null,
    fee > 0 ? t("feeLineFee", { amount: formatMoney(fee, currency) }) : null,
    fee === 0 && sameBank ? t("feeLineNoFeeSameBank") : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{parts.join(" · ")}</span>
      <button
        type="button"
        onClick={onEdit}
        className="text-primary underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {t("feeLineEdit")}
      </button>
    </p>
  );
}
```

- [ ] **Step 3: Render it under the amount in compact mode**

In `transaction-form.tsx`, watch the two flags and compute the preview:

```ts
  const includeTax = useWatch({ control, name: "include_tax" }) ?? false;
  const includeCommission = useWatch({ control, name: "include_commission" }) ?? false;
  const preview = feeParts({
    amount: Number(amountRaw) || 0,
    src,
    dst,
    include_tax: includeTax,
    include_commission: includeCommission,
  });
```

Render inside the amount block, after `<FieldError message={errors.amount?.message} />`:

```tsx
        {compact && !expanded ? (
          <FeeSummaryLine
            tax={preview.tax}
            fee={preview.fee}
            currency={displayCurrency}
            sameBank={sameBankPayment}
            onEdit={() => setExpanded(true)}
          />
        ) : null}
```

- [ ] **Step 4: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

- [ ] **Step 5: Verify in the app**

A RD$250 expense from a checking account shows `+RD$0.50 impuesto · editar`. The same expense from cash shows no line at all. *editar* expands to the real toggles, and turning tax off makes the line disappear.

- [ ] **Step 6: Commit**

```bash
git add components/transactions/fee-summary-line.tsx components/transactions/transaction-form.tsx messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
feat(transactions): say what a row will cost instead of asking

Tax now defaults on for bank-sourced spending, so a RD$250 lunch quietly
becomes RD$250.50. This states the charge under the amount, with the real
toggles one tap away, rather than leaving it to be discovered after saving.

The figure is a preview of the insert trigger's arithmetic, never a stored
value.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire up the Quick Add dialog

**Files:**
- Modify: `components/quick-add/quick-add-dialog.tsx`
- Modify: `components/transactions/transaction-form.tsx` (the amount input)

**Interfaces:**
- Consumes: `compact` (Task 5).
- Produces: nothing new.

- [ ] **Step 1: Pass `compact` and drop the tall scroll container**

```tsx
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title")}</DialogTitle>
        </DialogHeader>
        <TransactionForm data={data} compact onSuccess={() => setOpen(false)} />
      </DialogContent>
```

Keep `max-h-[90dvh] overflow-y-auto` — it is now a ceiling for the *expanded* state rather than the normal case.

- [ ] **Step 2: Make the amount input the focused, numeric starting point**

In `transaction-form.tsx`, on the amount `<Input>`:

```tsx
            inputMode="decimal"
            autoFocus={compact && !isEdit}
            className={cn("pr-16", compact && "h-12 text-2xl font-semibold tabular-nums")}
```

`type="number"` alone does not reliably raise a numeric keypad on mobile; `inputMode="decimal"` does. `autoFocus` is scoped to compact-create so opening the edit dialog does not steal focus from a form the user is reading.

- [ ] **Step 3: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

- [ ] **Step 4: Verify the three-tap target**

On a phone or a mobile viewport: open Quick Add → the keypad is up and the amount is focused → type an amount → tap a category chip → tap Guardar. Confirm the transaction lands correctly on `/transactions`.

Also confirm Income shows no category rail, and Pago shows its destination without expanding.

- [ ] **Step 5: Commit**

```bash
git add components/quick-add/quick-add-dialog.tsx components/transactions/transaction-form.tsx
git commit -m "$(cat <<'EOF'
feat(quick-add): open on the amount, in compact mode

Quick Add rendered the full transaction form for the app's most repeated
action. It now opens compact with the amount focused and a numeric keypad,
which is the three-tap path the audit asked for: amount, category, save.

inputMode=decimal rather than relying on type=number, which does not reliably
raise a numeric keypad. autoFocus is scoped to creating, so the edit dialog
does not pull focus from a form being read.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Update the in-app help guide

The guide documents the toggles and how entries are added. Both statements are now wrong.

**Files:**
- Modify: `messages/en.json:821-825`, `messages/es.json:821-825`
- Modify: `app/(app)/help/page.tsx:233-240`

**Interfaces:**
- Consumes: the finished behaviour from Tasks 4-8.
- Produces: nothing.

- [ ] **Step 1: Rewrite the toggle and adding copy**

`messages/en.json`:

```json
    "togglesTitle": "Tax and fees",
    "toggleTax": "Transfer tax — applied automatically when money leaves a checking or savings account, since that is what the tax charges. Not applied to cash or card spending, or to money you move between your own accounts.",
    "toggleFee": "Network fee — off unless you add it, because only some transfers carry one. Always waived within the same bank.",
    "addingTitle": "Adding entries",
    "addingBody": "Quick Add opens on the amount with a numeric keypad: type it, tap a category, save. Categories are ordered by the ones you use most, and the account is the one you last spent from. More details opens every remaining field — destination, rate, date, notes, budget exclusion and the tax and fee switches — in the same panel, and the Ledger's own form shows them all from the start. Every entry takes a free-text Note, the one field that stays editable on statement-imported rows, where the description belongs to your bank."
```

`messages/es.json`:

```json
    "togglesTitle": "Impuestos y comisiones",
    "toggleTax": "Impuesto por débito a cuenta — se aplica automáticamente cuando el dinero sale de una cuenta corriente o de ahorros, que es lo que grava el impuesto. No se aplica a gastos en efectivo o con tarjeta, ni al dinero que mueves entre tus propias cuentas.",
    "toggleFee": "Comisión de red — apagada salvo que la agregues, porque solo algunas transferencias la cobran. Siempre exenta dentro del mismo banco.",
    "addingTitle": "Registrar movimientos",
    "addingBody": "Añadir rápido abre directo en el monto con teclado numérico: escríbelo, toca una categoría y guarda. Las categorías salen ordenadas por las que más usas, y la cuenta es la última de la que gastaste. Más detalles abre el resto de los campos — destino, tasa, fecha, notas, exclusión del presupuesto y los interruptores de impuesto y comisión — en el mismo panel, y el formulario del Libro mayor los muestra todos desde el principio. Cada movimiento admite una Nota libre, el único campo que sigue editable en las filas importadas de un estado de cuenta, donde la descripción le pertenece a tu banco."
```

- [ ] **Step 2: Verify the page still renders**

The keys are the same, so `app/(app)/help/page.tsx:233-240` needs no structural change. Load `/help` and read the Transactions chapter in both languages, checking that nothing overflows its panel.

- [ ] **Step 3: Check for other stale references**

Run: `rtk proxy grep -rn "Quick Add\|Añadir rápido" messages/en.json messages/es.json`
Any other copy describing the old heavy dialog needs the same treatment.

- [ ] **Step 4: Typecheck, test, lint**

Run: `npx tsc --noEmit && npm test && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
docs(help): describe the compact Quick Add and the new fee rules

The guide still said tax was on by default for loan payments and that Quick
Add was the same dialog as the Ledger's. Both are now wrong: tax follows the
bank debit, the fee is off unless added, and Quick Add opens on the amount.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## After the plan

Run the full suite one more time (`npm test && npx tsc --noEmit && npm run lint`), then use `superpowers:finishing-a-development-branch` to merge `quick-add-compact` into `main` and delete the branch.

**Do not fix the mobile Select bug in this branch.** It is recorded in spec §7 with a reproduction and a leading hypothesis, and it predates this work. `CategoryRail` reduces exposure to it by removing the most frequently opened Select in the app, which is a side benefit, not a fix.
