# Recurring Income Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user save a recurring income template (e.g. "Paycheck") with a weekly, semimonthly ("quincena"), or monthly cycle, and record it in one tap each time it lands — the income mirror of the existing recurring-expense/payment feature.

**Architecture:** Add `"income"` as a third `kind` on the existing `subscriptions` table/`/recurring` page, alongside `expense` and `payment`. Add a `semimonthly` billing cycle (15th & end of month) distinct from the existing `biweekly` (every 14 days from a start date). When an income template is the user's sole active one, mirror its cycle onto `profiles.pay_cycle`/`pay_anchor_day` (the setting that drives budget period boundaries) by calling the existing `setPayCycle` action.

**Tech Stack:** Next.js App Router server actions, Supabase (Postgres + supabase-js, RLS-scoped), Zod, react-hook-form, next-intl, Vitest.

**Spec:** `docs/specs/2026-09-15-recurring-income-design.md`

## Global Constraints

- "Quincena" means `semimonthly` (15th & end of month) — never the existing `biweekly` cycle (every 14 days from a start date).
- Recurring income lives in the existing `subscriptions` table and `/recurring` page as a third `kind`, not a new table or page.
- An income template carries no category, no destination account, and no fees — matching manual income transactions today (`lib/transactions/schema.ts`, `lib/transactions/defaults.ts`).
- The pay-cycle sync (mirroring an income template's cycle onto `profiles.pay_cycle`) fires only when the template being saved is the user's **sole active** income template. A second active one skips the sync silently. Deactivating or deleting an income template never reverts a previous sync.
- This Supabase project is linked to a live remote database. The agent cannot push migrations or run `supabase db push` / `npm run db:types` (both hit the remote) — only the human can. Task 1 ends with a manual checkpoint for exactly this.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260915090000_recurring_income.sql`

**Interfaces:**
- Produces: `public.billing_cycle` enum gains `'semimonthly'`; `public.subscriptions` no longer rejects `kind = 'income'`. Nothing in this repo consumes these until Task 5 (which needs the regenerated `lib/supabase/types.ts` — see the checkpoint after Task 4).

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260915090000_recurring_income.sql
--
-- Recurring income ("paycheck"): the third `kind` on `subscriptions`, sitting
-- beside `expense` and `payment` (20260914150000_recurring_payments.sql).
-- Spec: docs/specs/2026-09-15-recurring-income-design.md
--
-- That migration's check constraint blocked `kind = 'income'` on the theory
-- that `profiles.pay_cycle` already covered it. It does not: pay_cycle only
-- decides budget period boundaries and records nothing. Two users have since
-- asked for exactly what a recorded income template gives — a one-tap way to
-- log a recurring paycheck, the same way subscriptions already do for bills.
--
-- `semimonthly` is a new billing_cycle, distinct from the existing
-- `biweekly`: "the 15th and the end of the month" (what most of the DR calls
-- quincenal, and what profiles.pay_cycle already means by the same name),
-- not biweekly's every-14-days-from-a-start-date. A semimonthly template
-- needs no anchor at all, the same way pay_cycle's semimonthly needs none.

alter type public.billing_cycle add value if not exists 'semimonthly' after 'biweekly';

alter table public.subscriptions
  drop constraint subscriptions_kind_not_income;
```

- [ ] **Step 2: Review the file**

Read it back and confirm: the enum value name is `'semimonthly'` (matches `public.pay_cycle`'s existing value exactly, so the two concepts share vocabulary), and the constraint name matches the one created in `supabase/migrations/20260914150000_recurring_payments.sql` (`subscriptions_kind_not_income`) exactly — a typo here would make the `drop constraint` fail loudly when pushed, which is preferable to it silently no-op'ing, but confirm it anyway:

```bash
grep -n "subscriptions_kind_not_income" supabase/migrations/20260914150000_recurring_payments.sql
```

Expected: one match, the `add constraint subscriptions_kind_not_income check (kind <> 'income')` line.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260915090000_recurring_income.sql
git commit -m "$(cat <<'EOF'
feat(db): add semimonthly billing cycle, allow income templates

Lifts yesterday's check constraint that blocked kind='income' on
subscriptions, and adds semimonthly (15th & end of month) as a
billing_cycle distinct from the existing biweekly, matching how
profiles.pay_cycle already uses the term. See
docs/specs/2026-09-15-recurring-income-design.md.
EOF
)"
```

This migration is **not applied yet** — do not run `npm run db:push` or `npm run db:types` here. Tasks 2-4 don't need it (pure TypeScript, no generated-type dependency). Proceed to Task 2.

---

## Task 2: Semimonthly cycle math

**Files:**
- Modify: `lib/subscriptions/cycle.ts`
- Test: `lib/subscriptions/cycle.test.ts`

**Interfaces:**
- Consumes: `nextPayday(date: string, cycle: PayCycle, anchor: number | null): string` from `lib/period/cycle.ts` (existing, unchanged).
- Produces: `BILLING_CYCLE_VALUES` includes `"semimonthly"`; `CYCLE_LABEL["semimonthly"]`; `hasAnchorField(cycle: BillingCycle): boolean`; `nextChargeDate`/`monthlyEquivalent` handle `"semimonthly"`. Task 5 (`toRow`) and the form dialog (Task 7) both call `hasAnchorField`.

- [ ] **Step 1: Write the failing tests**

Add to `lib/subscriptions/cycle.test.ts` (inside the existing `describe("nextChargeDate", ...)` block, after the last `biweekly` test, and inside `describe("monthlyEquivalent", ...)`; also add a new top-level `describe`):

```ts
  test("semimonthly lands on the 16th when today is on or before the 15th", () => {
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 14, 10)))).toBe("2026-09-16");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 1, 10)))).toBe("2026-09-16");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 15, 10)))).toBe("2026-09-16");
  });

  test("semimonthly lands on the 1st of next month after the 15th", () => {
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 16, 10)))).toBe("2026-10-01");
    expect(ymd(nextChargeDate({ cycle: "semimonthly" }, new Date(2026, 8, 30, 10)))).toBe("2026-10-01");
  });

  test("semimonthly needs no anchor at all", () => {
    expect(
      ymd(nextChargeDate({ cycle: "semimonthly", anchorDay: 99, anchorDate: "bogus" }, new Date(2026, 8, 14))),
    ).toBe("2026-09-16");
  });
```

Add this to `describe("monthlyEquivalent", ...)`:

```ts
  test("semimonthly is twice a month", () => {
    expect(monthlyEquivalent(1000, "semimonthly")).toBe(2000);
  });
```

Add this new top-level describe at the end of the file:

```ts
describe("hasAnchorField", () => {
  test("every cycle but semimonthly has an anchor field", () => {
    expect(hasAnchorField("weekly")).toBe(true);
    expect(hasAnchorField("biweekly")).toBe(true);
    expect(hasAnchorField("monthly")).toBe(true);
    expect(hasAnchorField("yearly")).toBe(true);
    expect(hasAnchorField("custom")).toBe(true);
    expect(hasAnchorField("semimonthly")).toBe(false);
  });
});
```

Update the top import line to also pull in `hasAnchorField`:

```ts
import { hasAnchorField, monthlyEquivalent, nextChargeDate } from "./cycle";
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- lib/subscriptions/cycle.test.ts
```

Expected: FAIL — `semimonthly` is not a valid `BillingCycle` yet (TS error) and `hasAnchorField` is not exported.

- [ ] **Step 3: Implement**

In `lib/subscriptions/cycle.ts`:

Change:
```ts
export const BILLING_CYCLE_VALUES = ["weekly", "biweekly", "monthly", "yearly", "custom"] as const;
```
to:
```ts
export const BILLING_CYCLE_VALUES = ["weekly", "biweekly", "semimonthly", "monthly", "yearly", "custom"] as const;
```

Change:
```ts
export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom",
};
```
to:
```ts
export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Semimonthly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom",
};
```

Add this import at the top of the file:
```ts
import { nextPayday } from "@/lib/period/cycle";
```

Add this export near `usesAnchorDate`:
```ts
/** Whether this cycle has an anchor field at all. Semimonthly needs neither a
 *  day number nor a start date — its two periods are fixed at the 15th and
 *  the end of the month, the same way profiles.pay_cycle's semimonthly needs
 *  no anchor. */
export function hasAnchorField(cycle: BillingCycle): boolean {
  return cycle !== "semimonthly";
}
```

In `nextChargeDate`, add a branch before the existing `usesAnchorDate(cycle)` check:

```ts
export function nextChargeDate(
  { cycle, anchorDay = null, anchorDate = null }: ChargeSchedule,
  from = new Date(),
): Date | null {
  if (cycle === "semimonthly") {
    // No anchor: the next payday is always "the day after the period
    // containing `from` ends" — the 16th, or the 1st of next month. Reuses
    // profiles.pay_cycle's own period math rather than re-deriving it.
    const today = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    return parseLocalDate(nextPayday(today, "semimonthly", null));
  }

  if (usesAnchorDate(cycle)) {
```

(The rest of the function body is unchanged — the existing `if (usesAnchorDate(cycle)) { ... }` block and everything after it stays exactly as it is today.)

In `monthlyEquivalent`, add a case:

```ts
export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "semimonthly":
      return amount * 2;
    case "yearly":
      return amount / 12;
    default:
      return amount; // monthly / custom treated as monthly
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- lib/subscriptions/cycle.test.ts
```

Expected: PASS, all tests including the new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions/cycle.ts lib/subscriptions/cycle.test.ts
git commit -m "$(cat <<'EOF'
feat: add semimonthly recurring cycle

15th & end of month, no anchor — delegates to lib/period/cycle's
nextPayday rather than re-deriving the same date math. hasAnchorField
lets callers hide the anchor input entirely for this cycle.
EOF
)"
```

---

## Task 3: Pay-cycle mapping

**Files:**
- Create: `lib/subscriptions/pay-cycle-sync.ts`
- Test: `lib/subscriptions/pay-cycle-sync.test.ts`

**Interfaces:**
- Consumes: `type BillingCycle` from `./cycle` (Task 2); `type PayCycle` from `@/lib/period/cycle` (existing).
- Produces: `mapIncomeCycleToPayCycle(cycle: BillingCycle, anchorDay: number | null): { payCycle: PayCycle; anchorDay: number | null } | null` and `weeklyAnchorToIso(anchorDay: number): number`. Task 5 calls `mapIncomeCycleToPayCycle`.

- [ ] **Step 1: Write the failing test**

Create `lib/subscriptions/pay-cycle-sync.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { mapIncomeCycleToPayCycle, weeklyAnchorToIso } from "./pay-cycle-sync";

describe("weeklyAnchorToIso", () => {
  test("converts this table's Sunday=1..Saturday=7 to ISO Monday=1..Sunday=7", () => {
    expect(weeklyAnchorToIso(1)).toBe(7); // Sunday
    expect(weeklyAnchorToIso(2)).toBe(1); // Monday
    expect(weeklyAnchorToIso(3)).toBe(2); // Tuesday
    expect(weeklyAnchorToIso(6)).toBe(5); // Friday
    expect(weeklyAnchorToIso(7)).toBe(6); // Saturday
  });
});

describe("mapIncomeCycleToPayCycle", () => {
  test("monthly carries its anchor day across unchanged", () => {
    expect(mapIncomeCycleToPayCycle("monthly", 15)).toEqual({ payCycle: "monthly", anchorDay: 15 });
    expect(mapIncomeCycleToPayCycle("monthly", null)).toEqual({ payCycle: "monthly", anchorDay: null });
  });

  test("weekly remaps its anchor day to ISO", () => {
    expect(mapIncomeCycleToPayCycle("weekly", 6)).toEqual({ payCycle: "weekly", anchorDay: 5 });
    expect(mapIncomeCycleToPayCycle("weekly", null)).toEqual({ payCycle: "weekly", anchorDay: null });
  });

  test("semimonthly has no anchor", () => {
    expect(mapIncomeCycleToPayCycle("semimonthly", null)).toEqual({ payCycle: "semimonthly", anchorDay: null });
  });

  test("biweekly, yearly, and custom have no pay_cycle equivalent", () => {
    expect(mapIncomeCycleToPayCycle("biweekly", null)).toBeNull();
    expect(mapIncomeCycleToPayCycle("yearly", null)).toBeNull();
    expect(mapIncomeCycleToPayCycle("custom", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- lib/subscriptions/pay-cycle-sync.test.ts
```

Expected: FAIL with "Cannot find module './pay-cycle-sync'".

- [ ] **Step 3: Implement**

Create `lib/subscriptions/pay-cycle-sync.ts`:

```ts
import type { BillingCycle } from "./cycle";
import type { PayCycle } from "@/lib/period/cycle";

export type PayCycleMapping = { payCycle: PayCycle; anchorDay: number | null };

/**
 * Converts a recurring-income template's weekly anchor day — this table's
 * Sunday=1..Saturday=7 scheme, the same one `nextChargeDate` reads — to
 * `profiles.pay_cycle`'s ISO scheme (Monday=1..Sunday=7). The two disagree on
 * numbering even though both call the value "weekly", so syncing one into the
 * other without this conversion would silently shift a user's budget period
 * onto the wrong weekday.
 */
export function weeklyAnchorToIso(anchorDay: number): number {
  const jsDow = (((anchorDay - 1) % 7) + 7) % 7; // 0 = Sunday, matching Date#getDay()
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Maps a recurring-income template's cycle onto the `profiles.pay_cycle` it
 * should drive, or null when the cycle has no `pay_cycle` equivalent
 * (biweekly, yearly, custom) — those templates simply don't sync. See
 * docs/specs/2026-09-15-recurring-income-design.md.
 */
export function mapIncomeCycleToPayCycle(
  cycle: BillingCycle,
  anchorDay: number | null,
): PayCycleMapping | null {
  switch (cycle) {
    case "monthly":
      return { payCycle: "monthly", anchorDay };
    case "weekly":
      return { payCycle: "weekly", anchorDay: anchorDay != null ? weeklyAnchorToIso(anchorDay) : null };
    case "semimonthly":
      return { payCycle: "semimonthly", anchorDay: null };
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- lib/subscriptions/pay-cycle-sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/subscriptions/pay-cycle-sync.ts lib/subscriptions/pay-cycle-sync.test.ts
git commit -m "$(cat <<'EOF'
feat: map recurring-income cycles onto profile pay_cycle

Pure mapping used by the sync in the recurring actions (next task).
Handles the weekly anchor's differing numbering between the two
systems and returns null for cycles with no pay_cycle equivalent.
EOF
)"
```

---

## Task 4: Template layer — third kind, fee rule

**Files:**
- Modify: `lib/subscriptions/template.ts`
- Test: `lib/subscriptions/template.test.ts`

**Interfaces:**
- Produces: `RECURRING_KINDS = ["expense", "payment", "income"]`; `templateAllowsFees(kind: RecurringKind, srcType: string | null | undefined): boolean` (signature changed — now takes `kind` first). Task 5 and Task 7 (form dialog) both call the new signature.
- Breaking change: every existing call site of `templateAllowsFees` must be updated in this same task (there are two: `recordedFlags` in this file, and the form dialog in Task 7 — but Task 7 hasn't happened yet, so **also** update that call site now to keep the build green in between tasks).

- [ ] **Step 1: Write the failing tests**

Replace the `describe("templateAllowsFees", ...)` block in `lib/subscriptions/template.test.ts` with:

```ts
describe("templateAllowsFees", () => {
  test("checking and savings carry fees on an expense or payment", () => {
    expect(templateAllowsFees("expense", "checking")).toBe(true);
    expect(templateAllowsFees("payment", "savings")).toBe(true);
  });

  test("a card, cash, or no account does not", () => {
    expect(templateAllowsFees("expense", "credit_card")).toBe(false);
    expect(templateAllowsFees("expense", "cash")).toBe(false);
    expect(templateAllowsFees("expense", null)).toBe(false);
  });

  test("income never carries fees, even from a bank account", () => {
    expect(templateAllowsFees("income", "checking")).toBe(false);
    expect(templateAllowsFees("income", "savings")).toBe(false);
  });
});
```

Add this test to the end of `describe("recordedFlags", ...)`:

```ts
  test("income carries no fees and never sets the budget flag", () => {
    expect(recordedFlags({ kind: "income", srcType: "checking", ...flags })).toEqual({
      include_tax: false,
      include_commission: false,
      exclude_from_budget: false,
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- lib/subscriptions/template.test.ts
```

Expected: FAIL — `templateAllowsFees("expense", "checking")` doesn't match the current one-argument signature (TS error), and `"income"` isn't a valid `kind` yet.

- [ ] **Step 3: Implement**

In `lib/subscriptions/template.ts`, change:

```ts
export const RECURRING_KINDS = ["expense", "payment"] as const;
```
to:
```ts
export const RECURRING_KINDS = ["expense", "payment", "income"] as const;
```

Change:
```ts
/**
 * Whether a template charged to this account may carry the transfer tax and
 * commission at all.
 *
 * Those are bank debit charges, so they follow the SOURCE, the same rule
 * quick-add's resolveFeeDefaults applies: a card swipe or a cash payment is
 * never taxed. The form hides the toggles for anything else, and
 * {@link recordedFlags} drops them even if a stale template still has them set
 * — say, one whose account was switched from checking to a card.
 */
export function templateAllowsFees(srcType: string | null | undefined): boolean {
  return !!srcType && isBankAccount(srcType as AccountType);
}
```
to:
```ts
/**
 * Whether a template charged to this account may carry the transfer tax and
 * commission at all.
 *
 * Those are bank debit charges, so they follow the SOURCE, the same rule
 * quick-add's resolveFeeDefaults applies: a card swipe or a cash payment is
 * never taxed. Income is a flat no regardless of account — the same rule
 * manual income transactions already follow (lib/transactions/defaults.ts).
 * The form hides the toggles for anything else, and {@link recordedFlags}
 * drops them even if a stale template still has them set — say, one whose
 * account was switched from checking to a card.
 */
export function templateAllowsFees(
  kind: RecurringKind,
  srcType: string | null | undefined,
): boolean {
  return kind !== "income" && !!srcType && isBankAccount(srcType as AccountType);
}
```

Change the one call site inside this same file, in `recordedFlags`:

```ts
  const fees = templateAllowsFees(srcType);
```
to:
```ts
  const fees = templateAllowsFees(kind, srcType);
```

- [ ] **Step 4: Update the form dialog's call site so the build stays green**

In `components/subscriptions/subscription-form-dialog.tsx`, change:

```ts
  const showFees = templateAllowsFees(byId(accountId)?.type);
```
to:
```ts
  const showFees = templateAllowsFees(kind, byId(accountId)?.type);
```

(`kind` is already in scope there via `const kind = useWatch({ control, name: "kind" });`.)

- [ ] **Step 5: Run the tests and typecheck to verify everything passes**

```bash
npm test -- lib/subscriptions/template.test.ts
npx tsc --noEmit
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/subscriptions/template.ts lib/subscriptions/template.test.ts components/subscriptions/subscription-form-dialog.tsx
git commit -m "$(cat <<'EOF'
feat: add income to RECURRING_KINDS, income never carries fees

templateAllowsFees now takes kind as well as account type, so income
is a flat no regardless of account — matching manual income
transactions' NO_FEES rule.
EOF
)"
```

---

## MANUAL CHECKPOINT — push the migration before continuing

**Stop here.** Task 5 writes `billing_cycle: "semimonthly"` into a Supabase insert/update call, which is type-checked against `lib/supabase/types.ts` — generated from the **linked remote** database. Until that migration is applied remotely and the types are regenerated, `"semimonthly"` isn't a valid value in the generated `Database["public"]["Enums"]["billing_cycle"]` type and Task 5 will not compile.

Ask the user to run, from the repo root:

```bash
npm run db:push
npm run db:types
```

Then confirm `lib/supabase/types.ts` changed (it should now list `"semimonthly"` somewhere in its `billing_cycle` enum definition) before proceeding to Task 5:

```bash
grep -n "semimonthly" lib/supabase/types.ts
```

Do not proceed to Task 5 until this comes back with a match.

---

## Task 5: Recurring actions — third kind, income charge, pay-cycle sync

**Files:**
- Modify: `app/(app)/recurring/actions.ts`
- Test: `app/(app)/recurring/actions.test.ts`

**Interfaces:**
- Consumes: `hasAnchorField` (Task 2), `mapIncomeCycleToPayCycle` (Task 3), `type RecurringKind` (Task 4), `setPayCycle(input: { cycle: string; anchorDay: number | null }): Promise<{ error?: string }>` from `app/(app)/settings/actions.ts` (existing, unchanged).
- Produces: `createSubscription`/`updateSubscription` now sync `profiles.pay_cycle` for a sole active income template; `addCharge` records `type: "income"` transactions.

- [ ] **Step 1: Write the failing tests**

In `app/(app)/recurring/actions.test.ts`, first widen the shared `stub()` helper so it can answer a `count`-style select (needed for the sync's "am I the only active income template" check) without touching any existing caller. Change:

```ts
function stub(read: { data?: Row | null; error?: unknown } = { data: null }) {
  const writes: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => read);
  chain.single = vi.fn(async () => ({ data: { id: "sub-1" }, error: null }));
  chain.insert = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  chain.update = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ error: null });

  (createClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn(() => chain),
  });
  return writes;
}
```
to:
```ts
function stub(
  read: { data?: Row | null; error?: unknown } = { data: null },
  opts: { count?: number } = {},
) {
  const writes: Record<string, unknown>[] = [];
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => read);
  chain.single = vi.fn(async () => ({ data: { id: "sub-1" }, error: null }));
  chain.insert = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  chain.update = vi.fn((row: Record<string, unknown>) => {
    writes.push(row);
    return chain;
  });
  // Serves two different awaits: a plain `.update(...).eq(...)` (only reads
  // `.error`) and the pay-cycle sync's `.select("id", {count}).eq().eq()`
  // (only reads `.count`) — each ignores the field it doesn't care about.
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ error: null, count: opts.count ?? null });

  (createClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
    from: vi.fn(() => chain),
  });
  return writes;
}
```

Add these tests to `describe("saving a template keeps one schedule and one shape", ...)`:

```ts
  it("never stores a category or destination on an income template", async () => {
    const writes = stub();

    await createSubscription({
      ...VALID,
      kind: "income",
      category_id: "22222222-2222-4222-8222-222222222222",
      to_account_id: "33333333-3333-4333-8333-333333333333",
    });

    expect(writes[0]).toMatchObject({ kind: "income", to_account_id: null, category_id: null });
  });
```

Add this test to `describe("addCharge records the template", ...)`:

```ts
  it("writes an income transaction to its destination account, fee-free", async () => {
    const inserts = recordStub(template({ kind: "income", name: "Paycheck", category_id: null }));

    expect(await addCharge("sub-1")).toEqual({ id: "sub-1" });
    expect(inserts[0]).toMatchObject({
      type: "income",
      account_id: "acct-1",
      to_account_id: null,
      category_id: null,
      amount: 1500,
      currency: "DOP",
      include_tax: false,
      include_commission: false,
      exclude_from_budget: false,
      subscription_id: "sub-1",
      description: "Paycheck",
    });
  });
```

Add this new `describe` block at the end of the file:

```ts
describe("saving an active income template syncs the pay cycle", () => {
  it("maps a monthly income template onto pay_cycle when it's the only one", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID, kind: "income", billing_cycle: "monthly", anchor_day: 15 });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ pay_cycle: "monthly", pay_anchor_day: 15 });
  });

  it("remaps a weekly income template's anchor day to ISO", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID, kind: "income", billing_cycle: "weekly", anchor_day: 6 });

    expect(writes[1]).toMatchObject({ pay_cycle: "weekly", pay_anchor_day: 5 });
  });

  it("does not sync when a second active income template already exists", async () => {
    const writes = stub(undefined, { count: 2 });

    await createSubscription({ ...VALID, kind: "income", billing_cycle: "monthly", anchor_day: 15 });

    expect(writes).toHaveLength(1);
  });

  it("does not sync an inactive income template", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID, kind: "income", billing_cycle: "monthly", is_active: false });

    expect(writes).toHaveLength(1);
  });

  it("does not sync a non-income template", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({ ...VALID, kind: "expense" });

    expect(writes).toHaveLength(1);
  });

  it("does not sync a cycle with no pay_cycle equivalent", async () => {
    const writes = stub(undefined, { count: 1 });

    await createSubscription({
      ...VALID,
      kind: "income",
      billing_cycle: "biweekly",
      anchor_date: "2026-09-04",
    });

    expect(writes).toHaveLength(1);
  });

  it("also syncs on update, not just create", async () => {
    const writes = stub({ data: { name: "Netflix" } }, { count: 1 });

    await updateSubscription("sub-1", { ...VALID, kind: "income", billing_cycle: "monthly", anchor_day: 1 });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ pay_cycle: "monthly", pay_anchor_day: 1 });
  });
});
```

Add `setPayCycle` to the module mocks — since it lives in a sibling `"use server"` file that itself calls `createClient`, `getTranslations`, and `revalidatePath`, all of which are already mocked in this file, no new mock is needed; it will run for real against the same mocked `supabase` client. No changes needed to the mock block at the top of the file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- "app/(app)/recurring/actions.test.ts"
```

Expected: FAIL — the income-charge test gets `type: "expense"` instead of `"income"`; the sync tests see `writes` with length 1 (no profile row); the "never stores a category or destination" test currently passes already for income by coincidence of `payment` being false, but is included for completeness — confirm it passes both before and after (see step 4).

- [ ] **Step 3: Implement**

At the top of `app/(app)/recurring/actions.ts`, change:

```ts
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";
import { getExchangeRates } from "@/lib/fx";
import { settledCharge } from "@/lib/subscriptions/charge";
import { usesAnchorDate } from "@/lib/subscriptions/cycle";
import { recordedFlags } from "@/lib/subscriptions/template";
```
to:
```ts
import { subscriptionInput, type SubscriptionInput } from "@/lib/subscriptions/schema";
import { getExchangeRates } from "@/lib/fx";
import { settledCharge } from "@/lib/subscriptions/charge";
import { hasAnchorField, usesAnchorDate } from "@/lib/subscriptions/cycle";
import { recordedFlags, type RecurringKind } from "@/lib/subscriptions/template";
import { mapIncomeCycleToPayCycle } from "@/lib/subscriptions/pay-cycle-sync";
import { setPayCycle } from "@/app/(app)/settings/actions";
```

Change `toRow`:

```ts
function toRow(v: SubscriptionInput) {
  const payment = v.kind === "payment";
  const dated = usesAnchorDate(v.billing_cycle);
  return {
    kind: v.kind,
    name: v.name,
    amount: v.amount,
    billing_cycle: v.billing_cycle,
    // One anchor per cycle, never both: a biweekly row keeping an old day
    // number would read as a second, contradictory schedule.
    anchor_day: dated ? null : v.anchor_day ?? null,
    anchor_date: dated ? v.anchor_date || null : null,
    account_id: v.account_id || null,
    to_account_id: payment ? v.to_account_id || null : null,
    // A payment moves money to an account; it is not spending in a category.
    category_id: payment ? null : v.category_id || null,
    include_tax: v.include_tax,
    include_commission: v.include_commission,
    is_active: v.is_active,
  };
}
```
to:
```ts
function toRow(v: SubscriptionInput) {
  const payment = v.kind === "payment";
  const dated = usesAnchorDate(v.billing_cycle);
  const anchored = hasAnchorField(v.billing_cycle);
  return {
    kind: v.kind,
    name: v.name,
    amount: v.amount,
    billing_cycle: v.billing_cycle,
    // One anchor per cycle, never both, and none at all for a cycle with no
    // anchor field (semimonthly): a stale day number left over from a
    // previous monthly template would read as a second, contradictory
    // schedule.
    anchor_day: dated || !anchored ? null : v.anchor_day ?? null,
    anchor_date: dated ? v.anchor_date || null : null,
    account_id: v.account_id || null,
    to_account_id: payment ? v.to_account_id || null : null,
    // A payment moves money to an account, and income arrives in one; neither
    // is spending in a category. Only an expense is.
    category_id: v.kind === "expense" ? v.category_id || null : null,
    include_tax: v.include_tax,
    include_commission: v.include_commission,
    is_active: v.is_active,
  };
}
```

Add this new function directly after `toRow`:

```ts
/**
 * Mirrors an ACTIVE income template's cycle onto profiles.pay_cycle — but
 * only when it is the user's SOLE active income template, so a second income
 * source never silently overrides the first's schedule. Deactivating or
 * deleting an income template never reverts a previous sync; this function
 * is only ever called from a successful create/update.
 *
 * Best-effort: reuses the existing setPayCycle action (Settings), and any
 * failure here is swallowed — a save the person already made must never fail
 * because a courtesy sync could not complete.
 */
async function syncPayCycleFromIncome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: Pick<SubscriptionInput, "kind" | "is_active" | "billing_cycle" | "anchor_day">,
): Promise<void> {
  if (data.kind !== "income" || !data.is_active) return;
  const mapping = mapIncomeCycleToPayCycle(data.billing_cycle, data.anchor_day ?? null);
  if (!mapping) return;

  const { count } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("kind", "income")
    .eq("is_active", true);
  if (count !== 1) return;

  await setPayCycle({ cycle: mapping.payCycle, anchorDay: mapping.anchorDay });
}
```

In `createSubscription`, change:

```ts
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ ...toRow(parsed.data), currency: parsed.data.currency, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createSubscription") };
  revalidate();
  return { id: data.id };
```
to:
```ts
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({ ...toRow(parsed.data), currency: parsed.data.currency, user_id: user.id })
    .select("id")
    .single();
  if (error) return { error: await dbError(error, "createSubscription") };
  await syncPayCycleFromIncome(supabase, parsed.data);
  revalidate();
  return { id: data.id };
```

In `updateSubscription`, change:

```ts
  const { error } = await supabase
    .from("subscriptions")
    .update({
      ...toRow(parsed.data),
      currency: parsed.data.currency,
      ...(renamed ? { color: null, logo_url: null } : {}),
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  revalidate();
  return { id };
```
to:
```ts
  const { error } = await supabase
    .from("subscriptions")
    .update({
      ...toRow(parsed.data),
      currency: parsed.data.currency,
      ...(renamed ? { color: null, logo_url: null } : {}),
    })
    .eq("id", id);
  if (error) return { error: await dbError(error, "updateSubscription") };
  await syncPayCycleFromIncome(supabase, parsed.data);
  revalidate();
  return { id };
```

In `addCharge`, change:

```ts
  const payment = sub.kind === "payment";
  const dstCurrency = payment ? sub.to_account?.currency : null;
  // The destination can be deleted out from under a template (on delete set null).
  if (payment && (!sub.to_account_id || !dstCurrency)) return { error: ts("needsToAccount") };
```
to:
```ts
  const kind = sub.kind as RecurringKind;
  const payment = kind === "payment";
  const dstCurrency = payment ? sub.to_account?.currency : null;
  // The destination can be deleted out from under a template (on delete set null).
  if (payment && (!sub.to_account_id || !dstCurrency)) return { error: ts("needsToAccount") };
```

And change:

```ts
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: payment ? "payment" : "expense",
    account_id: sub.account_id,
    to_account_id: payment ? sub.to_account_id : null,
    category_id: payment ? null : sub.category_id,
    amount: settled.amount,
    // Null on a same-currency payment — the DB mirrors `amount`.
    to_amount: crossLeg ? toAmount! : null,
    currency: accountCurrency,
    exchange_rate: resolveBaseRate({
      currency: accountCurrency,
      baseCurrency,
      amount: settled.amount,
      toCurrency: dstCurrency,
      toAmount: crossLeg ? toAmount : null,
      rates,
    }),
    ...recordedFlags({
      kind: payment ? "payment" : "expense",
      srcType: sub.account?.type,
      include_tax: sub.include_tax,
      include_commission: sub.include_commission,
    }),
    occurred_at: new Date().toISOString(),
    description: sub.name,
    subscription_id: sub.id,
  });
```
to:
```ts
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: kind,
    account_id: sub.account_id,
    to_account_id: payment ? sub.to_account_id : null,
    // Only an expense spends into a category — a payment moves money and
    // income arrives, neither of which counts against one.
    category_id: kind === "expense" ? sub.category_id : null,
    amount: settled.amount,
    // Null on a same-currency payment — the DB mirrors `amount`.
    to_amount: crossLeg ? toAmount! : null,
    currency: accountCurrency,
    exchange_rate: resolveBaseRate({
      currency: accountCurrency,
      baseCurrency,
      amount: settled.amount,
      toCurrency: dstCurrency,
      toAmount: crossLeg ? toAmount : null,
      rates,
    }),
    ...recordedFlags({
      kind,
      srcType: sub.account?.type,
      include_tax: sub.include_tax,
      include_commission: sub.include_commission,
    }),
    occurred_at: new Date().toISOString(),
    description: sub.name,
    subscription_id: sub.id,
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- "app/(app)/recurring/actions.test.ts"
npx tsc --noEmit
```

Expected: both PASS, including every pre-existing test in this file (none of their assertions changed).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/recurring/actions.ts" "app/(app)/recurring/actions.test.ts"
git commit -m "$(cat <<'EOF'
feat: record income charges, sync pay_cycle from income templates

addCharge now writes type="income" transactions with no category or
destination. Saving a sole active income template mirrors its cycle
onto profiles.pay_cycle via the existing setPayCycle action; a second
active income template skips the sync.
EOF
)"
```

---

## Task 6: i18n copy

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

**Interfaces:**
- Produces: translation keys consumed by Task 7 (`SubscriptionForm.namePlaceholderIncome`, `SubscriptionForm.depositAccountLabel`) and Task 8 (`RecordCharge.incomeLine`), plus updated existing keys.

- [ ] **Step 1: Update `messages/en.json`**

In the `"Activity"` block, change:
```json
    "recurringDesc": "Bills, transfers and payments that repeat"
```
to:
```json
    "recurringDesc": "Bills, transfers, payments, and income that repeat"
```

In the `"Subscriptions"` block, change:
```json
    "pageTitle": "Recurring payments",
    "pageDescription": "Expenses and payments you repeat, their next dates, and your monthly total.",
```
to:
```json
    "pageTitle": "Recurring",
    "pageDescription": "Expenses, payments, and income you repeat, their next dates, and your monthly total.",
```

And change:
```json
    "addSubscription": "Add recurring",
    "emptyTitle": "No recurring payments yet",
    "emptyDescription": "Save a subscription, a bill, or a transfer you make every cycle, then record it in one tap each time it happens.",
```
to:
```json
    "addSubscription": "Add recurring",
    "emptyTitle": "No recurring items yet",
    "emptyDescription": "Save a subscription, a bill, a transfer, or your paycheck — anything you repeat every cycle — then record it in one tap each time it happens.",
```

In the `"RecordCharge"` block, add a new key after `"billedLine"`:
```json
    "billedLine": "Billed {amount}, charged to {account} in {currency}.",
    "incomeLine": "Expected {amount}, deposited to {account} in {currency}.",
```

In the `"SubscriptionForm"` block, change:
```json
    "addTitle": "New recurring payment",
    "editTitle": "Edit recurring payment",
```
to:
```json
    "addTitle": "New recurring",
    "editTitle": "Edit recurring",
```

And change:
```json
    "addButton": "Add recurring payment",
    "saveChangesButton": "Save changes",
    "toastAdded": "Recurring payment added",
    "toastUpdated": "Recurring payment updated",
    "namePlaceholderPayment": "Savings transfer",
    "fromAccountLabel": "From",
    "toAccountLabel": "To",
    "startDateLabel": "First date",
    "startDateHint": "Repeats every 14 days from this date."
```
to:
```json
    "addButton": "Add recurring",
    "saveChangesButton": "Save changes",
    "toastAdded": "Recurring added",
    "toastUpdated": "Recurring updated",
    "namePlaceholderPayment": "Savings transfer",
    "namePlaceholderIncome": "Paycheck",
    "fromAccountLabel": "From",
    "toAccountLabel": "To",
    "depositAccountLabel": "Deposited to",
    "startDateLabel": "First date",
    "startDateHint": "Repeats every 14 days from this date."
```

- [ ] **Step 2: Update `messages/es.json` with the matching Spanish copy**

In the `"Activity"` block, change:
```json
    "recurringDesc": "Facturas, transferencias y pagos que se repiten"
```
to:
```json
    "recurringDesc": "Facturas, transferencias, pagos e ingresos que se repiten"
```

In the `"Subscriptions"` block, change:
```json
    "pageTitle": "Pagos recurrentes",
    "pageDescription": "Gastos y pagos que repites, sus próximas fechas y tu total mensual.",
```
to:
```json
    "pageTitle": "Recurrentes",
    "pageDescription": "Gastos, pagos e ingresos que repites, sus próximas fechas y tu total mensual.",
```

And change:
```json
    "emptyTitle": "Aún no hay pagos recurrentes",
    "emptyDescription": "Guarda una suscripción, una factura o una transferencia que haces cada ciclo y regístrala con un toque cada vez que ocurra.",
```
to:
```json
    "emptyTitle": "Aún no hay recurrentes",
    "emptyDescription": "Guarda una suscripción, una factura, una transferencia o tu sueldo — cualquier cosa que se repita cada ciclo — y regístralo con un toque cada vez que ocurra.",
```

In the `"RecordCharge"` block, add a new key after `"billedLine"`:
```json
    "billedLine": "Facturado {amount}, cargado a {account} en {currency}.",
    "incomeLine": "Esperado {amount}, depositado a {account} en {currency}.",
```

In the `"SubscriptionForm"` block, change:
```json
    "addTitle": "Nuevo pago recurrente",
    "editTitle": "Editar pago recurrente",
```
to:
```json
    "addTitle": "Nuevo recurrente",
    "editTitle": "Editar recurrente",
```

And change:
```json
    "addButton": "Añadir pago recurrente",
    "saveChangesButton": "Guardar cambios",
    "toastAdded": "Pago recurrente añadido",
    "toastUpdated": "Pago recurrente actualizado",
    "namePlaceholderPayment": "Transferencia a ahorros",
    "fromAccountLabel": "Desde",
    "toAccountLabel": "Hacia",
    "startDateLabel": "Primera fecha",
    "startDateHint": "Se repite cada 14 días desde esta fecha."
```
to:
```json
    "addButton": "Añadir recurrente",
    "saveChangesButton": "Guardar cambios",
    "toastAdded": "Recurrente añadido",
    "toastUpdated": "Recurrente actualizado",
    "namePlaceholderPayment": "Transferencia a ahorros",
    "namePlaceholderIncome": "Sueldo",
    "fromAccountLabel": "Desde",
    "toAccountLabel": "Hacia",
    "depositAccountLabel": "Depositado en",
    "startDateLabel": "Primera fecha",
    "startDateHint": "Se repite cada 14 días desde esta fecha."
```

- [ ] **Step 3: Verify both files still parse as valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
feat(i18n): broaden recurring copy to cover income, en+es

"Recurring payments" becomes "Recurring" now that the page covers
income too; adds namePlaceholderIncome, depositAccountLabel, and
RecordCharge.incomeLine in both locales.
EOF
)"
```

---

## Task 7: Form dialog — three-way kind, income fields

**Files:**
- Modify: `components/subscriptions/subscription-form-dialog.tsx`

**Interfaces:**
- Consumes: `RECURRING_KINDS` (now 3 values, Task 4), `hasAnchorField` (Task 2), i18n keys from Task 6.

- [ ] **Step 1: Widen the kind toggle from 2 to 3 columns**

Change:
```tsx
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
```
to:
```tsx
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
```

- [ ] **Step 2: Track the income kind alongside payment**

Change:
```ts
  const payment = kind === "payment";
```
to:
```ts
  const payment = kind === "payment";
  const income = kind === "income";
```

- [ ] **Step 3: Income-specific name placeholder**

Change:
```tsx
                placeholder={payment ? t("namePlaceholderPayment") : t("namePlaceholder")}
```
to:
```tsx
                placeholder={
                  payment ? t("namePlaceholderPayment") : income ? t("namePlaceholderIncome") : t("namePlaceholder")
                }
```

- [ ] **Step 4: Hide the anchor field entirely for semimonthly**

Change:
```tsx
            {usesAnchorDate(cycle) ? (
              <div className="space-y-2">
                <Label htmlFor="anchor_date" required>{t("startDateLabel")}</Label>
                <Input
                  id="anchor_date"
                  type="date"
                  aria-invalid={!!errors.anchor_date}
                  aria-describedby="anchor_date_hint"
                  {...register("anchor_date")}
                  required
                />
                <p id="anchor_date_hint" className="text-xs text-muted-foreground">
                  {t("startDateHint")}
                </p>
                <FieldError message={errors.anchor_date?.message} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
                <Input id="anchor_day" type="number" min="1" max="31" placeholder={t("chargeDayPlaceholder")} {...register("anchor_day")} />
              </div>
            )}
```
to:
```tsx
            {usesAnchorDate(cycle) ? (
              <div className="space-y-2">
                <Label htmlFor="anchor_date" required>{t("startDateLabel")}</Label>
                <Input
                  id="anchor_date"
                  type="date"
                  aria-invalid={!!errors.anchor_date}
                  aria-describedby="anchor_date_hint"
                  {...register("anchor_date")}
                  required
                />
                <p id="anchor_date_hint" className="text-xs text-muted-foreground">
                  {t("startDateHint")}
                </p>
                <FieldError message={errors.anchor_date?.message} />
              </div>
            ) : hasAnchorField(cycle) ? (
              <div className="space-y-2">
                <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
                <Input id="anchor_day" type="number" min="1" max="31" placeholder={t("chargeDayPlaceholder")} {...register("anchor_day")} />
              </div>
            ) : null}
```

Add `hasAnchorField` to the existing cycle import:
```ts
import {
  BILLING_CYCLES,
  CYCLE_LABEL,
  hasAnchorField,
  usesAnchorDate,
  type BillingCycle,
} from "@/lib/subscriptions/cycle";
```

- [ ] **Step 5: Income-specific account label**

Change:
```tsx
              <Label required={payment}>{payment ? t("fromAccountLabel") : t("chargeAccountLabel")}</Label>
```
to:
```tsx
              <Label required={payment}>
                {payment ? t("fromAccountLabel") : income ? t("depositAccountLabel") : t("chargeAccountLabel")}
              </Label>
```

- [ ] **Step 6: Hide category for income (only expense shows it)**

Change:
```tsx
            {payment ? (
              <div className="space-y-2">
                <Label required>{t("toAccountLabel")}</Label>
                <Controller
                  control={control}
                  name="to_account_id"
                  render={({ field, fieldState }) => (
                    <AccountSelect
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        refreshFees({ to_account_id: v });
                      }}
                      // Paying an account into itself is not a payment.
                      accounts={accounts.filter((a) => a.id !== accountId)}
                      items={accountItems}
                      noneLabel={tc("none")}
                      invalid={!!fieldState.error}
                    />
                  )}
                />
                <FieldError message={errors.to_account_id?.message} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t("categoryLabel")}</Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={categoryItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tc("none")}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.emoji ? `${c.emoji} ` : ""}
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
```
to:
```tsx
            {payment ? (
              <div className="space-y-2">
                <Label required>{t("toAccountLabel")}</Label>
                <Controller
                  control={control}
                  name="to_account_id"
                  render={({ field, fieldState }) => (
                    <AccountSelect
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        refreshFees({ to_account_id: v });
                      }}
                      // Paying an account into itself is not a payment.
                      accounts={accounts.filter((a) => a.id !== accountId)}
                      items={accountItems}
                      noneLabel={tc("none")}
                      invalid={!!fieldState.error}
                    />
                  )}
                />
                <FieldError message={errors.to_account_id?.message} />
              </div>
            ) : income ? null : (
              <div className="space-y-2">
                <Label>{t("categoryLabel")}</Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={categoryItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tc("none")}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.emoji ? `${c.emoji} ` : ""}
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
```

(The fee-toggle block below needs no change: `showFees` is already computed from `templateAllowsFees(kind, ...)`, Task 4, which returns `false` for `kind === "income"` unconditionally.)

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/subscriptions/subscription-form-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(ui): three-way kind toggle, income fields in the recurring form

Income hides category and destination-account, gets a "Deposited to"
label and a Paycheck placeholder, and the anchor field disappears
entirely for semimonthly (it has none).
EOF
)"
```

---

## Task 8: List view and record-charge dialog — income display and copy

**Files:**
- Modify: `components/subscriptions/subscriptions-view.tsx`
- Modify: `components/subscriptions/record-charge-dialog.tsx`

**Interfaces:**
- Consumes: i18n keys from Task 6 (`RecordCharge.incomeLine`, `RecordCharge.receivedLabel` reused).

- [ ] **Step 1: Generalize the kind prefix in the card/table label**

In `components/subscriptions/subscriptions-view.tsx`, change:
```tsx
                    <p className="text-xs text-muted-foreground">
                      {sub.kind === "payment" ? `${tType("payment")} · ` : ""}
                      {CYCLE_LABEL[sub.billing_cycle as BillingCycle]}
                    </p>
```
to:
```tsx
                    <p className="text-xs text-muted-foreground">
                      {sub.kind !== "expense" ? `${tType(sub.kind)} · ` : ""}
                      {CYCLE_LABEL[sub.billing_cycle as BillingCycle]}
                    </p>
```

No other change is needed in this file: `ChargeButton` already only special-cases `sub.kind === "payment"` for the destination-currency leg, so an income template with a currency-mismatched account already correctly opens `RecordChargeDialog` (for the settled-amount prompt) and never asks for a destination amount; `accountLine` already falls through to `sub.account?.name` for any non-payment kind.

- [ ] **Step 2: Income-specific summary line and settled-amount label in the record dialog**

In `components/subscriptions/record-charge-dialog.tsx`, change:
```tsx
          <p className="text-sm text-muted-foreground">
            {subscription.kind === "payment"
              ? t("paymentLine", {
                  amount: formatMoney(subscription.amount, subscription.currency),
                  account: subscription.account?.name ?? "",
                  to: subscription.to_account?.name ?? "",
                })
              : t("billedLine", {
                  amount: formatMoney(subscription.amount, subscription.currency),
                  account: subscription.account?.name ?? "",
                  currency: accountCurrency,
                })}
          </p>
```
to:
```tsx
          <p className="text-sm text-muted-foreground">
            {subscription.kind === "payment"
              ? t("paymentLine", {
                  amount: formatMoney(subscription.amount, subscription.currency),
                  account: subscription.account?.name ?? "",
                  to: subscription.to_account?.name ?? "",
                })
              : subscription.kind === "income"
                ? t("incomeLine", {
                    amount: formatMoney(subscription.amount, subscription.currency),
                    account: subscription.account?.name ?? "",
                    currency: accountCurrency,
                  })
                : t("billedLine", {
                    amount: formatMoney(subscription.amount, subscription.currency),
                    account: subscription.account?.name ?? "",
                    currency: accountCurrency,
                  })}
          </p>
```

Change:
```tsx
              <Label htmlFor="settled_amount">{t("chargedLabel")}</Label>
```
to:
```tsx
              <Label htmlFor="settled_amount">
                {subscription.kind === "income"
                  ? t("receivedLabel", { account: subscription.account?.name ?? "" })
                  : t("chargedLabel")}
              </Label>
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/subscriptions/subscriptions-view.tsx components/subscriptions/record-charge-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(ui): income copy in the recurring list and record dialog

Generalizes the payment-only kind prefix to any non-expense kind, and
gives income its own summary line and "received" wording instead of
"billed"/"charged".
EOF
)"
```

---

## Task 9: End-to-end verification

**Files:** none (manual verification only — this codebase has no component-level tests; UI correctness here is verified by hand, matching its existing test coverage pattern).

- [ ] **Step 1: Full automated check**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all three succeed with no errors.

- [ ] **Step 2: Manual verification — ask before starting the dev server**

Ask the user for permission before starting the dev server (per their standing preference), and check nothing is already running on its port first:

```bash
ss -ltnp | grep 3000
```

If nothing is listening, start it in the background on a fixed port:

```bash
npm run dev
```

(Use `run_in_background: true` if invoking this via a tool that supports it.)

- [ ] **Step 3: Click through the flow with agent-browser**

Use a named session per the project's browser-automation convention:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix tywin-recurring-income)"
agent-browser --session "$SESSION" open http://localhost:3000/recurring
agent-browser --session "$SESSION" snapshot -i
```

Walk through:
1. Open "Add recurring", switch the kind toggle to Income — confirm category and destination-account fields disappear, the account label reads "Deposited to", and the placeholder reads "Paycheck".
2. Pick "Semimonthly" as the cycle — confirm the anchor/charge-day field disappears entirely (no date picker, no day-of-month input).
3. Save an income template named "Paycheck", monthly, day 15, into a real account.
4. Confirm it appears in the list with "Income · Monthly" and a next date.
5. Tap "Record" — confirm the transaction posts (check `/transactions` for a new income row with no category).
6. Edit the template's cycle to Semimonthly, save, and confirm the next-date recalculates to the 16th or the 1st (whichever is correct for today's date).
7. In Settings, confirm `pay_cycle` now reads Semimonthly (since this was the only active income template) — this is the pay-cycle sync taking effect.

- [ ] **Step 4: Close the session**

```bash
agent-browser --session "$SESSION" close
```

Stop the dev server if this task started it (kill the PID, confirm with `pgrep`), unless the user asked to keep it running.

- [ ] **Step 5: Report**

Summarize what was verified and any discrepancies found, back to the user. Do not commit anything in this task — it's verification only.
