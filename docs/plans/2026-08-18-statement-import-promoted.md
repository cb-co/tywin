# Statement Import, Promoted — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make statement import reachable from Overview, Wallet, Insights and onboarding instead of only from a credit card's own detail page.

**Architecture:** The import flow is split out of `StatementsPanel` into a self-contained dialog that resolves its own target account — picking among the user's cards, or creating a stub card when there are none. A stub carries null limit, closing day and due day; confirming a statement backfills those from what the issuer printed. Sections whose currency has no matching account can create a sibling line, promoting the card into a card group.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS), zod, react-hook-form, next-intl, Vitest, Tailwind, Base UI.

**Spec:** `docs/specs/2026-08-18-statement-import-promoted-design.md`
**Audit item:** UX-02 in `docs/product-audit-dominican-market.md`

## Global Constraints

- Every user-visible string is a message key present in **both** `messages/en.json` and `messages/es.json`. No literal copy in components.
- Spanish is the primary audience: write the `es` string first, then the `en` one.
- `accountInput` and its strict `refineAccount` rule are **not** modified. The stub path gets its own validator.
- Backfill **only ever fills a null column.** It never overwrites a value the user set.
- The statement history list stays on the card page. Only the import flow becomes portable.
- No changes to the extractor, PII scrubber, checksum guard, duplicate-section rejection, or the LLM pipeline.
- The `notACard` gate (`app/(app)/accounts/statement-actions.ts:74`) stays — this plan does not enable bank-account statements.
- Run `npm test` before every commit. Individual files: `npx vitest run <path>`.
- Per the standing repo rule, the in-app help guide (`app/(app)/help/page.tsx` + both catalogues) is updated in the same change as the feature — Task 10.

---

## File Structure

**Created:**
- `lib/statements/backfill.ts` — pure: what a section teaches an account about itself.
- `lib/statements/backfill.test.ts`
- `lib/overview/import-prompt.ts` — pure: which callout state Overview should show.
- `lib/overview/import-prompt.test.ts`
- `components/statements/statement-import-dialog.tsx` — the portable import flow.
- `components/statements/import-card-stub-step.tsx` — the three-field stub form, shared by the dialog and onboarding.
- `components/overview/import-callout.tsx` — the Overview callout.

**Modified:**
- `lib/accounts/schema.ts` — add `cardStubInput`.
- `lib/accounts/schema.test.ts` — cover it.
- `app/(app)/accounts/actions.ts` — add `createCardStub`, `addCardLine`.
- `app/(app)/accounts/statement-actions.ts` — add `listImportTargets`; backfill after the RPC.
- `app/(app)/accounts/statement-actions.test.ts` — cover the backfill.
- `components/accounts/statements-panel.tsx` — keep history, delegate import to the dialog.
- `lib/overview/queries.ts` — add `importPrompt` to `Overview`.
- `app/(app)/page.tsx` — render the callout.
- `app/(app)/accounts/page.tsx` — header action.
- `app/(app)/insights/page.tsx` — three empty states become entry points.
- `components/onboarding/welcome-flow.tsx` — step 4, and rewrite the comment at line 25.
- `app/(app)/help/page.tsx`, `messages/en.json`, `messages/es.json`.

---

## Task 1: The card stub validator

**Files:**
- Modify: `lib/accounts/schema.ts`
- Test: `lib/accounts/schema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `cardStubInput` (zod schema), `type CardStubInput = { name: string; currency: string; last4?: string }`.

- [ ] **Step 1: Write the failing test**

Append to `lib/accounts/schema.test.ts`:

```ts
describe("cardStubInput", () => {
  test("accepts a card with no limit, closing day or due day", () => {
    const r = cardStubInput.safeParse({ name: "Popular Visa", currency: "dop", last4: "4921" });
    expect(r.success).toBe(true);
    expect(r.data?.currency).toBe("DOP");
  });

  test("accepts a card with no last4 at all", () => {
    expect(cardStubInput.safeParse({ name: "Popular Visa", currency: "DOP" }).success).toBe(true);
  });

  test("rejects a malformed last4", () => {
    const r = cardStubInput.safeParse({ name: "Popular Visa", currency: "DOP", last4: "49" });
    expect(r.success).toBe(false);
  });

  test("accountInput still requires the three card fields", () => {
    const r = accountInput.safeParse({ name: "Popular Visa", type: "credit_card", currency: "DOP" });
    expect(r.success).toBe(false);
  });
});
```

Add `cardStubInput` to the existing `./schema` import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/accounts/schema.test.ts`
Expected: FAIL — `cardStubInput is not exported` / undefined.

- [ ] **Step 3: Write the implementation**

In `lib/accounts/schema.ts`, after the `accountInput` export:

```ts
/**
 * The narrow path used by statement import: a card the user has not described yet.
 *
 * `refineAccount` demands credit_limit, statement_closing_day and payment_due_day
 * for a credit card, which is right for the full form and wrong here — those are
 * exactly the three fields a statement backfills, so requiring them would put a
 * five-field form in front of the feature that exists to save typing. The columns
 * are nullable and `card_status` already returns a null utilization_pct rather than
 * dividing by a null limit.
 */
export const cardStubInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
  last4: z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Enter exactly four digits")
    .optional()
    .or(z.literal("")),
});

export type CardStubInput = z.infer<typeof cardStubInput>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/accounts/schema.test.ts`
Expected: PASS, including the existing tests in the file.

- [ ] **Step 5: Commit**

```bash
git add lib/accounts/schema.ts lib/accounts/schema.test.ts
git commit -m "feat(accounts): validate a credit card the statement will finish describing"
```

---

## Task 2: Backfill — the pure rule

**Files:**
- Create: `lib/statements/backfill.ts`
- Test: `lib/statements/backfill.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `cardBackfillFromSection(account, section): CardBackfill` where
  `CardBackfill = { statement_closing_day?: number; payment_due_day?: number; credit_limit?: number }`.

- [ ] **Step 1: Write the failing test**

Create `lib/statements/backfill.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { cardBackfillFromSection } from "./backfill";

const blank = { statement_closing_day: null, payment_due_day: null, credit_limit: null };
const section = { periodEnd: "2026-08-15", dueDate: "2026-09-05", creditLimitCents: 15000000 };

describe("cardBackfillFromSection", () => {
  test("fills every null column from the statement", () => {
    expect(cardBackfillFromSection(blank, section)).toEqual({
      statement_closing_day: 15,
      payment_due_day: 5,
      credit_limit: 150000,
    });
  });

  test("never overwrites a column the user already set", () => {
    const known = { statement_closing_day: 20, payment_due_day: 10, credit_limit: 100000 };
    expect(cardBackfillFromSection(known, section)).toEqual({});
  });

  test("fills only the columns that are null", () => {
    expect(cardBackfillFromSection({ ...blank, credit_limit: 100000 }, section)).toEqual({
      statement_closing_day: 15,
      payment_due_day: 5,
    });
  });

  test("leaves due day and limit alone when the statement did not report them", () => {
    const sparse = { periodEnd: "2026-08-15", dueDate: null, creditLimitCents: null };
    expect(cardBackfillFromSection(blank, sparse)).toEqual({ statement_closing_day: 15 });
  });

  test("reads the day off the ISO string, not a parsed Date", () => {
    // new Date("2026-08-01") is 31 Jul in any negative-offset timezone, which is
    // every timezone in this product's market.
    const first = { periodEnd: "2026-08-01", dueDate: "2026-09-01", creditLimitCents: null };
    expect(cardBackfillFromSection(blank, first)).toEqual({
      statement_closing_day: 1,
      payment_due_day: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/statements/backfill.test.ts`
Expected: FAIL — cannot resolve `./backfill`.

- [ ] **Step 3: Write the implementation**

Create `lib/statements/backfill.ts`:

```ts
export type CardBackfill = {
  statement_closing_day?: number;
  payment_due_day?: number;
  credit_limit?: number;
};

type BackfillAccount = {
  statement_closing_day: number | null;
  payment_due_day: number | null;
  credit_limit: number | null;
};

type BackfillSection = {
  periodEnd: string;
  dueDate: string | null;
  creditLimitCents: number | null;
};

/** Sliced, not parsed: `new Date("2026-08-01")` is 31 July at any negative UTC
 *  offset, which is every timezone this product ships to. */
function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/**
 * What a statement section can teach an account about itself.
 *
 * Fills nulls only. A limit the user typed outranks the statement's, because on a
 * multi-line card the printed figure is the limit of one line rather than the card,
 * and a user who corrected it once should not have to correct it every month.
 */
export function cardBackfillFromSection(
  account: BackfillAccount,
  section: BackfillSection,
): CardBackfill {
  const patch: CardBackfill = {};
  if (account.statement_closing_day === null)
    patch.statement_closing_day = dayOfMonth(section.periodEnd);
  if (account.payment_due_day === null && section.dueDate)
    patch.payment_due_day = dayOfMonth(section.dueDate);
  if (account.credit_limit === null && section.creditLimitCents !== null)
    patch.credit_limit = section.creditLimitCents / 100;
  return patch;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/statements/backfill.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/backfill.ts lib/statements/backfill.test.ts
git commit -m "feat(statements): decide what a statement teaches a card about itself"
```

---

## Task 3: Apply the backfill on confirm

**Files:**
- Modify: `app/(app)/accounts/statement-actions.ts` (inside `confirmStatementImport`, after the RPC succeeds at line ~386)
- Test: `app/(app)/accounts/statement-actions.test.ts`

**Interfaces:**
- Consumes: `cardBackfillFromSection` from Task 2.
- Produces: no new exports. `confirmStatementImport` now writes card columns after a successful import.

- [ ] **Step 1: Write the failing test**

The existing `makeSupabaseStub` in this file returns one account with `credit_limit: 10000` and no
`statement_closing_day` / `payment_due_day` key. Extend the stub so accounts rows carry the three
backfill columns and so `update` is observable, then assert.

In `makeSupabaseStub`, replace the `account` object and the `accounts` entry:

```ts
  const account = {
    id: "acc-1",
    name: "Test Card",
    currency: "DOP",
    credit_limit: null,
    statement_closing_day: null,
    payment_due_day: null,
    card_group_id: null,
    type: "credit_card",
  };
  const accountUpdate = vi.fn(() => chainable({ error: null }));
  const byTable: Record<string, () => unknown> = {
    accounts: () => chainable({ data: account }, { update: accountUpdate }),
    // ...unchanged entries...
  };
```

and return `accountUpdate` alongside the stub so tests can read it:

```ts
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn((table: string) => (byTable[table] ?? (() => chainable({ data: null })))()),
    rpc: vi.fn(async () => ({ error: null })),
    accountUpdate,
  };
```

Add to the `describe("confirmStatementImport")` block:

```ts
  it("backfills closing day, due day and limit from the statement", async () => {
    const stub = makeSupabaseStub();
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        statement_closing_day: expect.any(Number),
        payment_due_day: expect.any(Number),
      }),
    );
  });

  it("does not touch a card whose columns are already set", async () => {
    const stub = makeSupabaseStub();
    stub.from = vi.fn((table: string) =>
      table === "accounts"
        ? chainable(
            {
              data: {
                id: "acc-1",
                name: "Test Card",
                currency: "DOP",
                credit_limit: 100000,
                statement_closing_day: 20,
                payment_due_day: 10,
                card_group_id: null,
                type: "credit_card",
              },
            },
            { update: stub.accountUpdate },
          )
        : chainable({ data: [] }, { upsert: vi.fn(async () => ({ error: null })) }),
    ) as typeof stub.from;
    (createClient as Mock).mockResolvedValue(stub);

    await confirmStatementImport(buildConfirmFormData());

    expect(stub.accountUpdate).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`
Expected: FAIL — `accountUpdate` never called; nothing writes card columns yet.

- [ ] **Step 3: Write the implementation**

In `confirmStatementImport`, immediately after the RPC error check and **before** the
`statement_section_mappings` upsert block:

```ts
  /* What the issuer printed, written back onto the card. A stub created during
     import arrives with no closing day, due day or limit — this is where it stops
     being a stub. Each mapped account is filled from its own section: on a grouped
     card the DOP line may be a sibling, and each line carries its own limit.
     Fills nulls only; see lib/statements/backfill.ts. */
  for (const s of parsed.sections) {
    const target = optionById.get(mappings[s.sectionKey]);
    if (!target) continue;
    const patch = cardBackfillFromSection(
      {
        statement_closing_day: target.statement_closing_day ?? null,
        payment_due_day: target.payment_due_day ?? null,
        credit_limit: target.credit_limit,
      },
      { periodEnd: s.periodEnd, dueDate: s.dueDate, creditLimitCents: s.creditLimitCents },
    );
    if (Object.keys(patch).length === 0) continue;
    await supabase.from("accounts").update(patch).eq("id", target.id);
  }
```

`CardAccountOption` does not carry the two day columns yet. Widen it in
`lib/statements/mapping.ts`:

```ts
export interface CardAccountOption {
  id: string;
  name: string;
  currency: string;
  credit_limit: number | null;
  statement_closing_day?: number | null;
  payment_due_day?: number | null;
}
```

and widen both selects in `loadAccountContext` (`statement-actions.ts:69` and `:82`) to
`"id,name,currency,credit_limit,statement_closing_day,payment_due_day,card_group_id,type"` and
`"id,name,currency,credit_limit,statement_closing_day,payment_due_day"` respectively. The single-account
`options` literal just below gains the two fields from `account`.

Import `cardBackfillFromSection` at the top of `statement-actions.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(app)/accounts/statement-actions.test.ts"`
Expected: PASS, including the pre-existing tests in the file.

- [ ] **Step 5: Full suite and commit**

```bash
npm test
git add "app/(app)/accounts/statement-actions.ts" "app/(app)/accounts/statement-actions.test.ts" lib/statements/mapping.ts
git commit -m "feat(statements): let a confirmed statement finish describing its card"
```

---

## Task 4: Create a stub card, and a stub line

**Files:**
- Modify: `app/(app)/accounts/actions.ts`
- Test: `app/(app)/accounts/actions.test.ts` (create if absent)

**Interfaces:**
- Consumes: `cardStubInput`, `CardStubInput` from Task 1.
- Produces:
  - `createCardStub(input: CardStubInput): Promise<Result>` — one ungrouped credit card, three card columns null.
  - `addCardLine(siblingId: string, input: CardStubInput): Promise<Result>` — a sibling line on `siblingId`'s card group, creating and joining that group if the card is still ungrouped.

`Result` is the existing type in this file (`{ id?: string; error?: string }`).

- [ ] **Step 1: Write the failing test**

Create `app/(app)/accounts/actions.test.ts` following the mocking style of
`statement-actions.test.ts` (see that file's header for why `next/cache` must be mocked):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/accounts/card-art", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accounts/card-art")>()),
  inferCardArt: vi.fn(async () => null),
}));

import { createClient } from "@/lib/supabase/server";
import { createCardStub, addCardLine } from "./actions";

function chainable(result: unknown, extra: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = { ...extra };
  obj.select = vi.fn(() => obj);
  obj.eq = vi.fn(() => obj);
  obj.single = vi.fn(() => Promise.resolve(result));
  obj.maybeSingle = vi.fn(() => Promise.resolve(result));
  (obj as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

beforeEach(() => vi.clearAllMocks());

describe("createCardStub", () => {
  it("writes a credit card with the three describable columns left null", async () => {
    const insert = vi.fn(() => chainable({ data: { id: "acc-new" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn(() => chainable({ data: null }, { insert })),
    });

    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "4921" });

    expect(r.id).toBe("acc-new");
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.type).toBe("credit_card");
    expect(row.currency).toBe("DOP");
    expect(row.last4).toBe("4921");
    expect(row).not.toHaveProperty("credit_limit");
    expect(row).not.toHaveProperty("statement_closing_day");
  });

  it("rejects a bad last4 before touching the database", async () => {
    const createClientMock = createClient as Mock;
    const r = await createCardStub({ name: "Popular Visa", currency: "DOP", last4: "49" });
    expect(r.error).toBeTruthy();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe("addCardLine", () => {
  it("promotes an ungrouped card into a card group and joins both to it", async () => {
    const accountInsert = vi.fn(() => chainable({ data: { id: "acc-usd" }, error: null }));
    const accountUpdate = vi.fn(() => chainable({ error: null }));
    const groupInsert = vi.fn(() => chainable({ data: { id: "grp-1" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn((table: string) =>
        table === "card_groups"
          ? chainable({ data: null }, { insert: groupInsert })
          : chainable(
              {
                data: {
                  id: "acc-1",
                  name: "Popular Visa",
                  type: "credit_card",
                  card_group_id: null,
                  color: "#123456",
                  brand: "visa",
                },
              },
              { insert: accountInsert, update: accountUpdate },
            ),
      ),
    });

    const r = await addCardLine("acc-1", { name: "Popular Visa USD", currency: "USD" });

    expect(r.id).toBe("acc-usd");
    expect(groupInsert).toHaveBeenCalled();
    expect(accountUpdate).toHaveBeenCalledWith({ card_group_id: "grp-1" });
    expect((accountInsert.mock.calls[0][0] as Record<string, unknown>).card_group_id).toBe("grp-1");
  });

  it("reuses an existing group instead of creating a second one", async () => {
    const accountInsert = vi.fn(() => chainable({ data: { id: "acc-usd" }, error: null }));
    const groupInsert = vi.fn(() => chainable({ data: { id: "grp-new" }, error: null }));
    (createClient as Mock).mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
      from: vi.fn((table: string) =>
        table === "card_groups"
          ? chainable({ data: null }, { insert: groupInsert })
          : chainable(
              {
                data: {
                  id: "acc-1",
                  name: "Popular Visa",
                  type: "credit_card",
                  card_group_id: "grp-existing",
                  color: null,
                  brand: null,
                },
              },
              { insert: accountInsert },
            ),
      ),
    });

    await addCardLine("acc-1", { name: "Cuotas", currency: "DOP" });

    expect(groupInsert).not.toHaveBeenCalled();
    expect((accountInsert.mock.calls[0][0] as Record<string, unknown>).card_group_id).toBe("grp-existing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/(app)/accounts/actions.test.ts"`
Expected: FAIL — `createCardStub` / `addCardLine` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `app/(app)/accounts/actions.ts`, importing `cardStubInput` and `CardStubInput` from
`@/lib/accounts/schema`:

```ts
/**
 * A credit card the user has not described yet — the entry point statement import
 * uses when someone has no card at all.
 *
 * Deliberately ungrouped: most cards in this market are a single DOP line, and a
 * one-line group would be a container around nothing. `addCardLine` promotes the
 * card if a statement turns out to have sections this one account cannot receive.
 */
export async function createCardStub(input: CardStubInput): Promise<Result> {
  const parsed = cardStubInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const art = await inferCardArt(parsed.data.name);
  const res = await supabase
    .from("accounts")
    .insert({
      name: parsed.data.name,
      type: "credit_card",
      currency: parsed.data.currency,
      user_id: user.id,
      ...(parsed.data.last4 ? { last4: parsed.data.last4 } : {}),
      ...(art ? { color: art.accent } : {}),
      ...(art?.network ? { brand: art.network } : {}),
    })
    .select("id")
    .single();

  if (res.error) return { error: await dbError(res.error, "createCardStub") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id: res.data.id };
}

/**
 * A further line on a card that already exists — the USD or cuotas section of a
 * statement that the card's single account cannot receive, because
 * `suggestAccountId` matches sections to accounts by currency.
 *
 * Promotion is a plain card_group_id update: statement_section_mappings rows are
 * only ever written for cards that already have a group (see the guard in
 * confirmStatementImport), so an ungrouped card has none to re-key.
 */
export async function addCardLine(siblingId: string, input: CardStubInput): Promise<Result> {
  const parsed = cardStubInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "You're not signed in." };

  const { data: sibling } = await supabase
    .from("accounts")
    .select("id,name,type,card_group_id,color,brand")
    .eq("id", siblingId)
    .single();
  if (!sibling || sibling.type !== "credit_card") return { error: "Not a credit card." };

  // A group IS the physical card, so it inherits the face the sibling already wears.
  const face = {
    ...(sibling.color ? { color: sibling.color } : {}),
    ...(sibling.brand ? { brand: sibling.brand } : {}),
  };

  let groupId = sibling.card_group_id;
  if (!groupId) {
    const { data: group, error: groupError } = await supabase
      .from("card_groups")
      .insert({
        name: sibling.name,
        user_id: user.id,
        ...(sibling.color ? { art_color: sibling.color } : {}),
        ...(sibling.brand ? { brand: sibling.brand } : {}),
      })
      .select("id")
      .single();
    if (groupError) return { error: await dbError(groupError, "addCardLine") };
    groupId = group.id;

    const { error: linkError } = await supabase
      .from("accounts")
      .update({ card_group_id: groupId })
      .eq("id", sibling.id);
    if (linkError) return { error: await dbError(linkError, "addCardLine") };
  }

  const res = await supabase
    .from("accounts")
    .insert({
      name: parsed.data.name,
      type: "credit_card",
      currency: parsed.data.currency,
      card_group_id: groupId,
      user_id: user.id,
      ...(parsed.data.last4 ? { last4: parsed.data.last4 } : {}),
      ...face,
    })
    .select("id")
    .single();

  if (res.error) return { error: await dbError(res.error, "addCardLine") };
  revalidatePath("/accounts");
  revalidatePath("/");
  return { id: res.data.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/(app)/accounts/actions.test.ts"`
Expected: PASS, 4 tests.

- [ ] **Step 5: Full suite and commit**

```bash
npm test
git add "app/(app)/accounts/actions.ts" "app/(app)/accounts/actions.test.ts"
git commit -m "feat(accounts): create a card from a statement, and a line when one card is not enough"
```

---

## Task 5: Extract the import dialog

**Files:**
- Create: `components/statements/statement-import-dialog.tsx`
- Modify: `components/accounts/statements-panel.tsx`

**Interfaces:**
- Consumes: `parseStatement`, `confirmStatementImport` (existing, unchanged).
- Produces:
  ```ts
  export function StatementImportDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Pins the target. Omitted, the dialog resolves one itself (Task 6). */
    accountId?: string;
    /** Fired after a successful import so the host can refresh. */
    onImported?: () => void;
  }): React.JSX.Element;
  ```

This task is a **pure refactor** — no behaviour change from the card page's point of view. It ends with
the card page working exactly as before, with the import UI inside a dialog rather than inline in the
panel.

- [ ] **Step 1: Move the import flow**

Create `components/statements/statement-import-dialog.tsx` as a `"use client"` component. Move from
`statements-panel.tsx`, unchanged in behaviour:

- state: `file`, `password`, `needsPassword`, `passwordIncorrect`, `preview`, `mappings`,
  `excludeFromBudget`, `parsedStatement`, and the `pending` transition
- functions: `buildFormData`, `onParse`, `onConfirm`
- JSX: the hidden file input and its size guard, the password retry block, the section-mapping list
  with its `Select`, the exclude-from-budget switch, and the confirm/cancel buttons
- the `allMapped` derivation

Wrap that JSX in the existing `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` /
`DialogDescription` primitives already imported by the panel, driven by the `open` / `onOpenChange`
props. Title `t("title")`, description `t("description")`.

On a successful confirm, call `onImported?.()` in place of the panel's `router.refresh()`, then close
via `onOpenChange(false)`.

Open the file picker automatically when the dialog opens with no file chosen yet, so the first thing a
user sees is their own file browser rather than an empty panel.

- [ ] **Step 2: Reduce the panel to history plus a trigger**

In `statements-panel.tsx`, delete everything moved in Step 1. Keep: the statement history list,
`onToggleLines`, `onDelete`, `deleteTarget`, `expanded`, `lines`, `busyId`, and the delete-confirm
dialog. Replace the old inline import UI with local `const [importOpen, setImportOpen] = useState(false)`,
the existing header `Button` now calling `setImportOpen(true)`, and:

```tsx
<StatementImportDialog
  open={importOpen}
  onOpenChange={setImportOpen}
  accountId={accountId}
  onImported={() => router.refresh()}
/>
```

Remove imports that are now unused (`parseStatement`, `confirmStatementImport`, `Switch`, `Select*`,
`MAX_STATEMENT_BYTES`, `Upload` if no longer referenced) — `npm run lint` will name them.

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass, no unused-import errors.

Then ask the user to confirm the card page still imports a statement end to end, per the standing rule
about starting the dev server. Nothing in this task changes what the server does, so a clean type-check
plus the existing `statement-actions.test.ts` suite is most of the evidence; the manual pass is for the
dialog's open/close and file-picker wiring, which no test covers.

- [ ] **Step 4: Commit**

```bash
git add components/statements/statement-import-dialog.tsx components/accounts/statements-panel.tsx
git commit -m "refactor(statements): make the import flow portable, leave history on the card"
```

---

## Task 6: The dialog resolves its own target

**Files:**
- Create: `components/statements/import-card-stub-step.tsx`
- Modify: `components/statements/statement-import-dialog.tsx`
- Modify: `app/(app)/accounts/statement-actions.ts` (add `listImportTargets`)

**Interfaces:**
- Consumes: `createCardStub`, `addCardLine` (Task 4); `StatementImportDialog` (Task 5).
- Produces:
  - `listImportTargets(): Promise<ImportTarget[]>` where `ImportTarget = { id: string; name: string; currency: string; last4: string | null }`, exported from `statement-actions.ts`.
  - `ImportCardStubStep(props: { onCreated: (accountId: string) => void; submitLabel: string; defaultCurrency: string }): React.JSX.Element` — the three-field stub form.

A server action rather than props threaded through four pages: every entry point then mounts the dialog
with no data of its own.

- [ ] **Step 1: Add the targets action**

In `app/(app)/accounts/statement-actions.ts`:

```ts
export type ImportTarget = { id: string; name: string; currency: string; last4: string | null };

/** The cards a statement could be imported onto. Called by the dialog when it
 *  opens, so an entry point can mount it without fetching anything itself. */
export async function listImportTargets(): Promise<ImportTarget[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase
    .from("accounts")
    .select("id,name,currency,last4")
    .eq("type", "credit_card")
    .eq("is_archived", false)
    .order("sort_order");
  return data ?? [];
}
```

- [ ] **Step 2: Build the stub step**

Create `components/statements/import-card-stub-step.tsx` — a `"use client"` component with three
controlled fields (name, currency `Select` over the same currency list the account form uses, optional
last 4), a submit button labelled by the `submitLabel` prop, calling `createCardStub` and then
`onCreated(result.id)`. Errors surface with `toast.error` and `playError()`, matching the panel.

Copy keys: `Statements.stubHeading`, `Statements.stubNameLabel`, `Statements.stubNamePlaceholder`,
`Statements.stubCurrencyLabel`, `Statements.stubLast4Label`, `Statements.stubHint`.

- [ ] **Step 3: Resolve the target in the dialog**

In `StatementImportDialog`, add `const [targetId, setTargetId] = useState(accountId ?? null)` and a
`targets` state loaded from `listImportTargets()` on open when `accountId` is not given. Render, in
order of precedence:

| Condition | Render |
| --- | --- |
| `targetId` set | the existing file/parse/preview flow, against `targetId` |
| `targets.length === 0` | `<ImportCardStubStep onCreated={setTargetId} …/>` |
| `targets.length === 1` | nothing — `setTargetId(targets[0].id)` on load |
| `targets.length > 1` | a card list; picking one calls `setTargetId` |

Reset `targetId` back to `accountId ?? null` when the dialog closes, so a second open on a different
card does not reuse the first one's target.

Copy keys: `Statements.pickCardHeading`, `Statements.pickCardHint`.

- [ ] **Step 4: Offer the missing lines after a parse**

In the preview step, a section whose currency matches no entry in `preview.accountOptions` currently
renders a `Select` whose only option is "none", so `allMapped` can never become true and Confirm stays
disabled with no explanation. Under such a section, render a button:

```tsx
{unmatched ? (
  <Button
    variant="outline"
    disabled={pending}
    onClick={() =>
      startTransition(async () => {
        const r = await addCardLine(targetId!, {
          name: t("lineNameSuggestion", { card: cardName, currency: s.currency }),
          currency: s.currency,
        });
        if (r.error) {
          toast.error(r.error);
          playError();
          return;
        }
        setPreview((p) =>
          p
            ? { ...p, accountOptions: [...p.accountOptions, { id: r.id!, name: lineName, currency: s.currency }] }
            : p,
        );
        setMappings((m) => ({ ...m, [s.sectionKey]: r.id! }));
      })
    }
  >
    {t("addLineButton", { currency: s.currency })}
  </Button>
) : null}
```

where `lineName` is the same string passed to `addCardLine`.

**Do not re-parse to refresh the options.** There is no server-side parse cache: the comment at
`statement-actions.ts:48-50` says the *client* echoes `parsedStatement` back so that **confirm** skips
extraction, which says nothing about a second `parseStatement` call. Calling it again re-extracts the
PDF and re-calls the LLM — real money, real latency, and the `llmRateLimited` path exists for a reason.

Appending the option client-side is safe because the server does not trust it. `confirmStatementImport`
rebuilds its own `options` through `loadAccountContext`, which reads the card group fresh, and rejects
any section that maps to an account the user does not own or whose currency does not match
(`statement-actions.ts:304-311`). A bogus locally-added option fails at confirm rather than importing
anything wrong.

Copy keys: `Statements.addLineButton`, `Statements.lineNameSuggestion`, `Statements.unmatchedSection`.

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

Manual pass (ask before starting the dev server): open the dialog from a card page and confirm it goes
straight to the file picker; with the only card deleted, confirm the stub step appears and creating a
card lands on the file picker.

- [ ] **Step 6: Commit**

```bash
git add components/statements/ "app/(app)/accounts/statement-actions.ts"
git commit -m "feat(statements): let the import dialog find or create its own card"
```

---

## Task 7: The Overview callout

**Files:**
- Create: `lib/overview/import-prompt.ts`, `lib/overview/import-prompt.test.ts`
- Create: `components/overview/import-callout.tsx`
- Modify: `lib/overview/queries.ts`, `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `StatementImportDialog` (Task 5/6).
- Produces: `importPromptState(cards, now?): ImportPrompt` where `ImportPrompt = "never" | "overdue" | "none"`; `Overview.importPrompt: ImportPrompt`.

- [ ] **Step 1: Write the failing test**

Create `lib/overview/import-prompt.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { importPromptState } from "./import-prompt";

const now = new Date("2026-08-18T12:00:00Z");

describe("importPromptState", () => {
  test("prompts a user with no cards at all", () => {
    expect(importPromptState([], now)).toBe("never");
  });

  test("prompts a user whose cards have never been imported", () => {
    expect(importPromptState([{ latest_period_end: null }], now)).toBe("never");
  });

  test("nags when every card's newest statement is older than the window", () => {
    expect(importPromptState([{ latest_period_end: "2026-07-01" }], now)).toBe("overdue");
  });

  test("stays quiet when a statement is recent", () => {
    expect(importPromptState([{ latest_period_end: "2026-08-08" }], now)).toBe("none");
  });

  test("stays quiet when any one card is current", () => {
    const cards = [{ latest_period_end: "2026-05-01" }, { latest_period_end: "2026-08-08" }];
    expect(importPromptState(cards, now)).toBe("none");
  });

  test("treats the window edge as still current", () => {
    // 35 days before 18 Aug is 14 Jul.
    expect(importPromptState([{ latest_period_end: "2026-07-14" }], now)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/overview/import-prompt.test.ts`
Expected: FAIL — cannot resolve `./import-prompt`.

- [ ] **Step 3: Write the implementation**

Create `lib/overview/import-prompt.ts`:

```ts
export type ImportPrompt = "never" | "overdue" | "none";

/** The audit's north-star metric is "imported in the last 35 days", and a monthly
 *  statement needs a few days of slack around a 30-day cycle. */
export const IMPORT_STALE_DAYS = 35;

/**
 * Which import callout Overview should show.
 *
 * "none" is the goal state, not a failure: a user who imports every month should
 * pay no screen space for a feature they have already adopted. The callout exists
 * to convert the users who have not.
 */
export function importPromptState(
  cards: { latest_period_end: string | null }[],
  now = new Date(),
): ImportPrompt {
  const ends = cards.map((c) => c.latest_period_end).filter((d): d is string => !!d);
  if (ends.length === 0) return "never";

  // ISO dates sort lexically, so no parse is needed to find the newest.
  const newest = ends.reduce((a, b) => (a > b ? a : b));
  const ageDays = (now.getTime() - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000;
  return ageDays > IMPORT_STALE_DAYS ? "overdue" : "none";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/overview/import-prompt.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire it into the Overview query**

In `lib/overview/queries.ts`, add `importPrompt: ImportPrompt;` to the `Overview` type and compute it
in `getOverview` from the `cards` rows already fetched — the `card_status` select at line ~106 already
includes `latest_period_end`, and the view left-joins from `accounts where type = 'credit_card'`, so a
card with no statement is present with a null. **No query changes.**

```ts
importPrompt: importPromptState(cards ?? []),
```

- [ ] **Step 6: Render it**

Create `components/overview/import-callout.tsx` — a `"use client"` component taking
`{ state: "never" | "overdue" }`, rendering a `Card` with the `SpotIllustration` treatment used
elsewhere on Overview, a heading, a line of body copy and a primary button that opens
`StatementImportDialog`.

In `app/(app)/page.tsx`, render `{o.importPrompt !== "none" ? <ImportCallout state={o.importPrompt} /> : null}`
between the `HeroCard` and the three stat cards in the populated branch, and inside the existing empty
state above the quick-link grid.

Copy keys: `Overview.importCalloutNeverTitle`, `Overview.importCalloutNeverBody`,
`Overview.importCalloutOverdueTitle`, `Overview.importCalloutOverdueBody`, `Overview.importCalloutCta`.

- [ ] **Step 7: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint
git add lib/overview/ components/overview/import-callout.tsx "app/(app)/page.tsx"
git commit -m "feat(overview): ask for a statement when one is due, and never otherwise"
```

---

## Task 8: Wallet and Insights entry points

**Files:**
- Modify: `app/(app)/accounts/page.tsx`, `app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes: `StatementImportDialog` (Task 5/6).
- Produces: nothing new.

- [ ] **Step 1: Wallet header action**

`AccountsPage` is a server component and the dialog is a client one, so add a small client wrapper —
`components/statements/import-button.tsx` — holding the `open` state and rendering a `Button` plus the
dialog. Place it in the `PageHeader` on `app/(app)/accounts/page.tsx:45` using whatever action slot
`PageHeader` exposes; if it has none, render it beside the header in the same flex row.

Copy key: `Statements.importButton` (already exists).

- [ ] **Step 2: Insights empty states**

In `app/(app)/insights/page.tsx`, the three empty states rendering `costOfCarryEmpty`, `cashbackEmpty`
and `cardFeesEmpty` become the same sentence followed by the `ImportButton` from Step 1 in a
`variant="outline"` size-sm form. The strings themselves stay as they are — they already say the right
thing, they just could not be acted on.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint
git add components/statements/import-button.tsx "app/(app)/accounts/page.tsx" "app/(app)/insights/page.tsx"
git commit -m "feat(statements): reach import from the wallet and from every empty state that names it"
```

---

## Task 9: Onboarding step 4

**Files:**
- Modify: `components/onboarding/welcome-flow.tsx`

**Interfaces:**
- Consumes: `ImportCardStubStep` (Task 6), `StatementImportDialog` (Task 5/6).
- Produces: nothing new.

- [ ] **Step 1: Rewrite the comment that forbids this**

The comment at `components/onboarding/welcome-flow.tsx:25` argues cards cannot join onboarding because
they need limits, closing days, principals and terms. The stub retires half of that. Replace it:

```ts
/** Onboarding creates one plain balance account, and optionally one credit card.
 *  The card is a stub — name, currency, last 4 — because the three fields that made
 *  a card too heavy for this flow (limit, closing day, due day) are exactly the ones
 *  a statement backfills on first import. Loans still need principals and terms, so
 *  they stay one click away on the Accounts page. */
```

- [ ] **Step 2: Add the step**

Change `STEP_COUNT` from 3 to 4. Step 3 (0-indexed) renders a skippable card question:
`ImportCardStubStep` with `defaultCurrency={currency}`, plus a Skip control.

`canAdvance` gains a fourth arm returning `true` — the step is always passable, because skipping is a
valid answer.

`next()` currently calls `finishOnboarding()` at the end of the account step. Move that call to the end
of step 3, so the account step advances to `setStep(3)` instead of finishing.

On `onCreated(accountId)`, open `StatementImportDialog` with that `accountId`; whether the user imports
or dismisses, `finishOnboarding()` then `router.replace("/")` as today.

Copy keys: `Welcome.cardStepLabel`, `Welcome.cardStepTitle`, `Welcome.cardStepBody`, `Welcome.cardStepSkip`.
`stepLabels` is passed in from the page — add the fourth label at its source.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint
git add components/onboarding/
git commit -m "feat(onboarding): offer a card and its first statement before the dashboard"
```

Ask the user to walk a fresh signup through onboarding before moving on — this is the one flow with no
test coverage and the most ways to strand a new account halfway.

---

## Task 10: Copy parity and the help guide

**Files:**
- Modify: `messages/es.json`, `messages/en.json`, `app/(app)/help/page.tsx`

**Interfaces:** none.

- [ ] **Step 1: Write the Spanish copy first**

Every key introduced by Tasks 6–9, written as Spanish first and then translated:

`Statements.stubHeading`, `stubNameLabel`, `stubNamePlaceholder`, `stubCurrencyLabel`, `stubLast4Label`,
`stubHint`, `pickCardHeading`, `pickCardHint`, `addLineButton`, `lineNameSuggestion`,
`unmatchedSection`; `Overview.importCalloutNeverTitle`, `importCalloutNeverBody`,
`importCalloutOverdueTitle`, `importCalloutOverdueBody`, `importCalloutCta`; `Welcome.cardStepLabel`,
`cardStepTitle`, `cardStepBody`, `cardStepSkip`.

- [ ] **Step 2: Check parity mechanically**

```bash
node -e "const a=require('./messages/en.json'),b=require('./messages/es.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const A=f(a),B=f(b);console.log('en-only',A.filter(k=>!B.includes(k)));console.log('es-only',B.filter(k=>!A.includes(k)))"
```

Expected: both arrays empty.

- [ ] **Step 3: Update the help guide**

`Help.statementsBody` describes import as something reached from a card's page, which this change makes
false. Rewrite it to say import is reachable from Overview when a statement is due, from the Wallet
header, from the Insights cards that need one, and during onboarding — and that a card added this way
learns its closing day, due day and limit from the first statement.

Update `Help.statementsTitle` if it still scopes the feature to credit cards reached via an account.

- [ ] **Step 4: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint
git add messages/ "app/(app)/help/page.tsx"
git commit -m "docs(help): describe import as something you reach from anywhere"
```

---

## Task 11: Close out the audit item

**Files:**
- Modify: `docs/product-audit-dominican-market.md`

- [ ] **Step 1: Tick UX-02 and record what shipped**

Change UX-02's checkbox to `- [x] Done (DATE)` and add a `**Done**` paragraph in the style of UX-04's:
what was built, the stub-and-backfill rule, and the two things left — the activation metric (a SQL
query, not a build) and BUILD-02 bank statements.

Tick the Now-horizon line `- [ ] Import promoted to a primary action (UX-02)`.

- [ ] **Step 2: Commit**

```bash
git add docs/product-audit-dominican-market.md
git commit -m "docs(audit): mark UX-02 done"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §1 Split the panel | 5 |
| §2 Dialog resolves its target | 6 |
| §3 Card stub + backfill | 1, 2, 3 |
| §4 Group stub, lazy promotion | 4, 6 |
| §5 Overview callout | 7 |
| §6 Wallet and Insights | 8 |
| §7 Onboarding step 4 | 9 |
| §8 Copy and help | 10 |
| §10 Testing | tests live in 1, 2, 3, 4, 7 |

§9 (out of scope) and §11 (risks) need no task by construction.

**Two spec tests have no task, deliberately:** "`suggestAccountId` against a stub group" is unchanged
pure logic already covered by the existing mapping tests, and "the dialog resolves to the file picker
with one card, the picker with several, the stub with none" is component behaviour this repo has no
harness for — it is the manual pass in Task 6 Step 5 instead.

**Type consistency:** `CardStubInput` (Task 1) is the input to both `createCardStub` and `addCardLine`
(Task 4) and to `ImportCardStubStep` (Task 6). `ImportPrompt` (Task 7) is the type of
`Overview.importPrompt` and the `state` prop of `ImportCallout`. `CardAccountOption` gains two optional
fields in Task 3 and is read in that same task.

**Ordering:** Tasks 1–4 are server-side and independently testable. Task 5 is a pure refactor that must
land before 6. Tasks 7, 8 and 9 all depend on 5/6 but not on each other.
