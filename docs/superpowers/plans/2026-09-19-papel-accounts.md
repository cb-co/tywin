# Papel Moneda — Phase 2: Accounts & Shared Card Face Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design sub-skill:** every UI task runs under `/impeccable` (`.claude/skills/impeccable`). Load `reference/craft-floor.md` before editing UI. Composition for the Accounts list page was already resolved in an `/impeccable shape accounts` round this plan was written from (see "Locked composition" below) — do not re-run concept-seed for it.

**Goal:** Move Accounts (the list page and the account detail page) onto the Papel Moneda primitives, and extract the drawn card face into one component shared by the marketing home page and every in-app card, per Task 13 of the master redesign plan.

**Architecture:** Phase 0's primitives (`Note`, `LedgerRow`, `Stamp`, `ProofMark`, `Perforation`, `RuleMeter`, `SpecimenFrame`) are the only building blocks. A new `CardFace` primitive is added (`components/papel/card-face.tsx`), replacing `PaymentCard` and `NetworkMark` and matching the marketing home page's drawn card exactly. Two small pieces of net-new logic are added under TDD: a shared `netWorthTotal` calculation (extracted from Overview, so both screens agree) and an "attention" classifier that surfaces cards with a payment due soon, overdue amounts, or unfinished import triage, using data already loaded — no new database tables or migrations.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn on `@base-ui/react`, next-intl, Vitest, Supabase (`account_balances`, `card_status`, `loan_status`, `card_statements` — all existing).

**Spec:** `docs/superpowers/plans/2026-09-19-papel-moneda-app-redesign.md` Task 13 (lines ~1457–1513) is the binding scope, file list and acceptance criteria for this phase; this plan argues from it. `DESIGN.md` is the visual system. `docs/superpowers/specs/2026-09-19-papel-moneda-app-redesign-design.md` is the original brief.

## Locked composition (from the `/impeccable shape accounts` round)

The Accounts **list** page renders, top to bottom:
1. An **attention ledger** — cards with a payment due soon, an overdue amount, or unfinished import triage, each a `LedgerRow` with a `ProofMark`. A calm, wordless-empty section (nothing renders, not even a header) when nothing needs attention — the page must never look broken on a quiet month.
2. The violet net-worth `Note` (`tone="violet"`).
3. The `CardFace` gallery (today's `cards` group).
4. The `cash`/`assets`/`loans` groups as ledger sections; per-currency **card** lines print as `LedgerRow`s under a double rule beneath each card's `CardFace`.
5. Loan and cuota progress as `Perforation`.

The **detail** page keeps Task 13's own order: `CardFace`, statements ledger (`LedgerRow` + `ProofMark`), amortization ledger, ink-line balance chart, activity — this was already fixed by Task 13's non-negotiables and was not part of the open-composition round.

Build path is **code-led**: no comp image exists (no image-generation tool is available in this environment) and none is owed; the wireframe's ambition carries into this plan's per-task acceptance checks, and the finish reviewer (Task 14) is the craft gate.

## Global Constraints

- One family: Archivo (`wdth` axis), already global — no font work in this phase.
- Tokens are already global (`app/globals.css`, `design/tokens.json`) — this phase never edits a colour value, only which component reads which token.
- **At most one Note per screen.** The Accounts list page's net worth is the only Note; the detail page has none (per Task 13, unchanged from the incumbent detail page's own hero, which is not a Papel Note — see Task 13's file list, which does not ask for one there).
- State is ink density, rule weight or a glyph, never colour alone — `ProofMark` and the perforation strip carry this, not `text-destructive`/`text-warning` (drop `utilizationTone`'s colour-only tone map, Task 8).
- Category and account colour is user data (`lib/palette.ts`, `lib/color.ts`) — never assume a shipped swatch. `CardFace` validates every stored accent through `HEX6` before use, exactly like the incumbent `PaymentCard`.
- WCAG 2.2 AA: 4.5:1 body text, keyboard-complete, visible 2px `currentColor` focus, `prefers-reduced-motion` honoured.
- i18n: no hardcoded copy; `messages/en.json` and `messages/es.json` change together in every task that touches copy; microprint and bank terms (cuotas, quincena) stay Spanish in both.
- No database migration. Every new query in this plan (Task 2) reads existing tables/views (`account_balances`, `card_status`, `loan_status`, `card_statements`) with new SQL, not new schema.
- Screen logic, queries, server actions and routes stay unless a task explicitly changes one (Task 2 adds two new read-only query functions; no server action changes).
- A dev server, when started for a screenshot round, runs on a fixed port via `run_in_background` and is stopped in the same turn.
- Branch: `redesign/papel-accounts` (already created). Merge to `main` and delete the branch when Task 14 ships.
- Each commit message ends with the session's attribution line.

## File Structure

**Create:**
- `lib/accounts/net-worth.ts` (+ `.test.ts`) — `netWorthTotal`, extracted from `lib/overview/queries.ts`.
- `lib/accounts/attention.ts` (+ `.test.ts`) — pure classifier, `accountsNeedingAttention`.
- `components/papel/card-face.tsx` (+ `.test.tsx`) — the shared drawn card.
- `components/accounts/attention-ledger.tsx` — the new list-page section.

**Modify:**
- `lib/overview/queries.ts` — call the extracted `netWorthTotal` instead of the inline reduce (behaviour-preserving).
- `lib/accounts/queries.ts` — add `getNetWorth`, `getAccountsAttention`.
- `components/marketing/marketing-home.tsx`, `components/marketing/papel/papel.module.css` — cards section uses `CardFace`; `.card*` rules deleted.
- `components/accounts/{account-card,card-group-tile,account-gallery,amortization-table,balance-chart,statements-panel}.tsx`, `app/(app)/accounts/{page,[id]/page}.tsx` — recomposed onto the primitives.
- `components/onboarding/parts.tsx` (`SavedRow`) — restyled onto `LedgerRow`/`Stamp`.
- `app/(app)/help/page.tsx`, `components/help/mocks.tsx` — Accounts chapter + `AccountsMock` built from the primitives inside `SpecimenFrame`.
- `messages/en.json`, `messages/es.json` — new keys for the attention ledger and any copy the recomposition needs.

**Delete:**
- `components/accounts/payment-card.tsx`, `components/accounts/network-mark.tsx` — superseded by `CardFace` (network now prints as a wordmark, not an inline brand mark; see Task 5).

**Keep unchanged (styling untouched, confirmed by reading the file):**
- `components/accounts/account-form-dialog.tsx`, `account-detail-actions.tsx`, `card-line-rail.tsx`, `card-report.tsx`, `account-activity.tsx`, `card-art-backfill.tsx` — already `Card`/`Button`/`Progress`-based, which are already Papel-restyled shadcn primitives from Phase 0; Task 13 does not ask for a structural change here and none is needed.

## Interfaces summary (for tasks that consume earlier tasks)

- `netWorthTotal(balances, cards, loans, baseCurrency, toBase)` → `number` (Task 1).
- `accountsNeedingAttention(accounts: AttentionInput[], today: string)` → `AttentionItem[]` (Task 2).
- `CardFace({ name, last4, network, accent, className? })` (Task 3).
- `<AttentionLedger items={AttentionItem[]} />` (Task 6).

---

### Task 1: Extract `netWorthTotal`

**Files:**
- Create: `lib/accounts/net-worth.ts`, `lib/accounts/net-worth.test.ts`
- Modify: `lib/overview/queries.ts:199-205`

**Interfaces:**
- Produces: `netWorthTotal(balances: { balance: number | string; currency: string | null }[], cards: { owed: number | string | null; currency: string | null }[], loans: { outstanding_balance: number | string | null; currency: string | null }[], baseCurrency: string, toBase: (amount: number, currency: string) => number): number`

- [ ] **Step 1: Write the failing test**

```ts
// lib/accounts/net-worth.test.ts
import { describe, it, expect } from "vitest";
import { netWorthTotal } from "./net-worth";

const identity = (amount: number, _currency: string) => amount;

describe("netWorthTotal", () => {
  it("sums balances minus card owed minus loan outstanding", () => {
    const total = netWorthTotal(
      [{ balance: 1000, currency: "DOP" }, { balance: 500, currency: "USD" }],
      [{ owed: 200, currency: "DOP" }],
      [{ outstanding_balance: 300, currency: "DOP" }],
      "DOP",
      identity,
    );
    expect(total).toBe(1000 + 500 - 200 - 300);
  });

  it("converts every row through the supplied toBase before summing", () => {
    const toBase = (amount: number, currency: string) => (currency === "USD" ? amount * 60 : amount);
    const total = netWorthTotal(
      [{ balance: 100, currency: "USD" }],
      [],
      [],
      "DOP",
      toBase,
    );
    expect(total).toBe(6000);
  });

  it("falls back to baseCurrency when a row's currency is null", () => {
    const toBase = (amount: number, currency: string) => (currency === "DOP" ? amount : NaN);
    const total = netWorthTotal(
      [{ balance: 50, currency: null }],
      [{ owed: null, currency: null }],
      [{ outstanding_balance: null, currency: null }],
      "DOP",
      toBase,
    );
    expect(total).toBe(50);
  });

  it("returns 0 for three empty lists", () => {
    expect(netWorthTotal([], [], [], "DOP", identity)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/accounts/net-worth.test.ts`
Expected: FAIL. Cannot find module `./net-worth`.

- [ ] **Step 3: Implement `lib/accounts/net-worth.ts`**

```ts
/**
 * Net worth in base currency: every account balance, minus what every
 * credit card owes, minus every loan's outstanding balance. Extracted from
 * lib/overview/queries.ts so the Overview hero and the Accounts page can
 * never disagree about what net worth means.
 */
export function netWorthTotal(
  balances: { balance: number | string; currency: string | null }[],
  cards: { owed: number | string | null; currency: string | null }[],
  loans: { outstanding_balance: number | string | null; currency: string | null }[],
  baseCurrency: string,
  toBase: (amount: number, currency: string) => number,
): number {
  return (
    balances.reduce((s, b) => s + toBase(Number(b.balance), b.currency ?? baseCurrency), 0) -
    cards.reduce((s, c) => s + toBase(Number(c.owed ?? 0), c.currency ?? baseCurrency), 0) -
    loans.reduce(
      (s, l) => s + toBase(Number(l.outstanding_balance ?? 0), l.currency ?? baseCurrency),
      0,
    )
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/accounts/net-worth.test.ts`
Expected: PASS.

- [ ] **Step 5: Point `lib/overview/queries.ts` at it**

In `lib/overview/queries.ts`, add `import { netWorthTotal } from "@/lib/accounts/net-worth";` near the other `lib/accounts` imports, then replace lines 199-205:

```ts
  const netWorth =
    (balances ?? []).reduce((s, b) => s + toBase(Number(b.balance), b.currency ?? baseCurrency), 0) -
    (cards ?? []).reduce((s, c) => s + toBase(Number(c.owed ?? 0), c.currency ?? baseCurrency), 0) -
    (loans ?? []).reduce(
      (s, l) => s + toBase(Number(l.outstanding_balance ?? 0), l.currency ?? baseCurrency),
      0,
    );
```

with:

```ts
  const netWorth = netWorthTotal(balances ?? [], cards ?? [], loans ?? [], baseCurrency, toBase);
```

- [ ] **Step 6: Run the Overview suite and typecheck**

Run: `npx vitest run lib/overview lib/accounts/net-worth.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. The Overview net worth figure is unchanged (same formula, same inputs).

- [ ] **Step 7: Commit**

```bash
git add lib/accounts/net-worth.ts lib/accounts/net-worth.test.ts lib/overview/queries.ts
git commit -m "refactor(accounts): extract netWorthTotal so Overview and Accounts agree"
```

---

### Task 2: `getNetWorth` and the attention classifier

**Files:**
- Create: `lib/accounts/attention.ts`, `lib/accounts/attention.test.ts`
- Modify: `lib/accounts/queries.ts` (add `getNetWorth`, `getAccountsAttention`)

**Interfaces:**
- Consumes: `netWorthTotal` (Task 1), `getExchangeRates`/`convertToBase` (`@/lib/fx`, already used by `lib/overview/queries.ts`).
- Produces:
  - `type AttentionInput = { id: string; name: string; currency: string; color: string | null; brand: string | null; last4: string | null; dueDate: string | null; overdueAmount: number | null; overdueInstallments: number | null; pendingTriageCount: number }`
  - `type AttentionItem = { id: string; name: string; currency: string; color: string | null; brand: string | null; last4: string | null; reason: "due-soon" | "overdue" | "untriaged"; dueDate: string | null; pendingTriageCount: number }`
  - `accountsNeedingAttention(accounts: AttentionInput[], today: string, dueWithinDays?: number): AttentionItem[]`
  - `getNetWorth(baseCurrency: string): Promise<number>`
  - `getAccountsAttention(): Promise<AttentionItem[]>`

- [ ] **Step 1: Write the failing test for the pure classifier**

```ts
// lib/accounts/attention.test.ts
import { describe, it, expect } from "vitest";
import { accountsNeedingAttention, type AttentionInput } from "./attention";

const base: AttentionInput = {
  id: "a1",
  name: "BHD Visa Platinum",
  currency: "DOP",
  color: null,
  brand: null,
  last4: "4417",
  dueDate: null,
  overdueAmount: null,
  overdueInstallments: null,
  pendingTriageCount: 0,
};

describe("accountsNeedingAttention", () => {
  it("flags a due date within the window as due-soon", () => {
    const [item] = accountsNeedingAttention([{ ...base, dueDate: "2026-09-24" }], "2026-09-19", 7);
    expect(item.reason).toBe("due-soon");
  });

  it("does not flag a due date past the window", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-10-19" }], "2026-09-19", 7)).toEqual([]);
  });

  it("overdue outranks due-soon when both are true", () => {
    const [item] = accountsNeedingAttention(
      [{ ...base, dueDate: "2026-09-20", overdueAmount: 500 }],
      "2026-09-19",
      7,
    );
    expect(item.reason).toBe("overdue");
  });

  it("flags overdue installments even with no overdue amount", () => {
    const [item] = accountsNeedingAttention([{ ...base, overdueInstallments: 1 }], "2026-09-19");
    expect(item.reason).toBe("overdue");
  });

  it("flags pending triage when nothing else applies", () => {
    const [item] = accountsNeedingAttention([{ ...base, pendingTriageCount: 3 }], "2026-09-19");
    expect(item.reason).toBe("untriaged");
    expect(item.pendingTriageCount).toBe(3);
  });

  it("returns nothing for an account with no signal", () => {
    expect(accountsNeedingAttention([base], "2026-09-19")).toEqual([]);
  });

  it("a past due date with no overdue figures does not flag due-soon (already reflected as overdue by the bank, not this account's job to guess)", () => {
    expect(accountsNeedingAttention([{ ...base, dueDate: "2026-09-10" }], "2026-09-19", 7)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run lib/accounts/attention.test.ts`
Expected: FAIL. Cannot find module `./attention`.

- [ ] **Step 3: Implement `lib/accounts/attention.ts`**

```ts
export type AttentionInput = {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  brand: string | null;
  last4: string | null;
  /** The newest statement's due date, or the account's own `payment_due_day`-derived date. */
  dueDate: string | null;
  overdueAmount: number | null;
  overdueInstallments: number | null;
  /** Uncategorised lines still sitting in the newest import that touched this account. */
  pendingTriageCount: number;
};

export type AttentionReason = "due-soon" | "overdue" | "untriaged";

export type AttentionItem = {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  brand: string | null;
  last4: string | null;
  reason: AttentionReason;
  dueDate: string | null;
  pendingTriageCount: number;
};

/**
 * What belongs on the Accounts page's attention ledger: whatever needs a
 * decision, ranked overdue > due soon > still-uncategorised. Every signal
 * here already exists in the data the app has (card_statements.overdue_*,
 * card_status.latest_due_date, import triage) — nothing is invented or
 * guessed, per PRODUCT.md's "refuse rather than guess" principle.
 */
export function accountsNeedingAttention(
  accounts: AttentionInput[],
  today: string,
  dueWithinDays = 7,
): AttentionItem[] {
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + dueWithinDays);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const items: AttentionItem[] = [];
  for (const a of accounts) {
    const overdue = (a.overdueAmount ?? 0) > 0 || (a.overdueInstallments ?? 0) > 0;
    const dueSoon = a.dueDate !== null && a.dueDate >= today && a.dueDate <= horizonISO;
    const untriaged = a.pendingTriageCount > 0;

    let reason: AttentionReason | null = null;
    if (overdue) reason = "overdue";
    else if (dueSoon) reason = "due-soon";
    else if (untriaged) reason = "untriaged";

    if (reason) {
      items.push({
        id: a.id,
        name: a.name,
        currency: a.currency,
        color: a.color,
        brand: a.brand,
        last4: a.last4,
        reason,
        dueDate: a.dueDate,
        pendingTriageCount: a.pendingTriageCount,
      });
    }
  }
  return items;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/accounts/attention.test.ts`
Expected: PASS.

- [ ] **Step 5: Read the query helpers this task wires together**

Before writing `getNetWorth`/`getAccountsAttention`, confirm the exact shapes: `getExchangeRates`/`convertToBase` (`rg -n "export function (getExchangeRates|convertToBase)" lib/fx`), and `getPendingTriageCounts` (`lib/accounts/queries.ts:129-153`, per-account today — read it in full, it is the working reference for Step 6's triage-count query below: the real table is `card_statement_lines` (not `statement_lines`), keyed by `statement_id`, with `transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)` embedded — there is no `statement_line_id` column on `transactions` and no direct `account_id` on a line). This task adds an unscoped sibling rather than changing that function's signature (existing callers must keep working unmodified).

- [ ] **Step 6: Implement `getNetWorth` and `getAccountsAttention` in `lib/accounts/queries.ts`**

Add near the bottom of the file, after `getAccountsWithStatus`:

```ts
import { getExchangeRates, convertToBase } from "@/lib/fx";
import { netWorthTotal } from "./net-worth";
import { accountsNeedingAttention, type AttentionItem } from "./attention";

/** Net worth in `baseCurrency`, computed the same way Overview computes it. */
export async function getNetWorth(baseCurrency: string): Promise<number> {
  const supabase = await createClient();
  const [{ data: balances }, { data: cards }, { data: loans }, rates] = await Promise.all([
    supabase.from("account_balances").select("*"),
    supabase.from("card_status").select("*"),
    supabase.from("loan_status").select("*"),
    getExchangeRates(baseCurrency),
  ]);
  const toBase = (amount: number, currency: string) => convertToBase(amount, currency, baseCurrency, rates);
  return netWorthTotal(balances ?? [], cards ?? [], loans ?? [], baseCurrency, toBase);
}

/**
 * Cards that need a decision: overdue, due soon, or still carrying
 * uncategorised statement lines. Walks every card account's newest
 * statement rather than every statement, since only the newest one's due
 * date and overdue figures are still actionable. The triage-count half of
 * this mirrors `getPendingTriageCounts` exactly, just unscoped across every
 * card account instead of one.
 */
export async function getAccountsAttention(): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, currency, color, brand, last4")
    .eq("is_archived", false)
    .eq("type", "credit_card");
  if (!accounts || accounts.length === 0) return [];

  const ids = accounts.map((a) => a.id);
  const { data: statements } = await supabase
    .from("card_statements")
    .select("id, account_id, import_id, due_date, overdue_amount, overdue_installments, period_end")
    .in("account_id", ids)
    .order("period_end", { ascending: false });

  // Only the newest statement per account — an older one's due date is moot.
  const newestByAccount = new Map<string, NonNullable<typeof statements>[number]>();
  for (const s of statements ?? []) {
    if (!newestByAccount.has(s.account_id)) newestByAccount.set(s.account_id, s);
  }

  // Pending triage, scoped to statements that actually have an import — same
  // guard getPendingTriageCounts uses, same reason (a hand-added statement
  // has no import to triage).
  const importedStatementIds = (statements ?? []).filter((s) => s.import_id !== null).map((s) => s.id);
  const { data: lines } = importedStatementIds.length
    ? await supabase
        .from("card_statement_lines")
        .select("statement_id, transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)")
        .in("statement_id", importedStatementIds)
    : { data: [] };

  const triageCountByStatement = new Map<string, number>();
  for (const l of lines ?? []) {
    if (l.transaction && l.transaction.category_id === null) {
      triageCountByStatement.set(l.statement_id, (triageCountByStatement.get(l.statement_id) ?? 0) + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const inputs = accounts.map((a) => {
    const statement = newestByAccount.get(a.id);
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      color: a.color,
      brand: a.brand,
      last4: a.last4,
      dueDate: statement?.due_date ?? null,
      overdueAmount: statement?.overdue_amount ?? null,
      overdueInstallments: statement?.overdue_installments ?? null,
      pendingTriageCount: statement ? triageCountByStatement.get(statement.id) ?? 0 : 0,
    };
  });

  return accountsNeedingAttention(inputs, today);
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `NonNullable<typeof statements>[number]` needs `statements` to still be in scope with its inferred Supabase row type; if the generated type names the embedded relation differently than written above, let the compiler's own error name the real one and correct it there rather than guessing twice.

- [ ] **Step 8: Commit**

```bash
git add lib/accounts/attention.ts lib/accounts/attention.test.ts lib/accounts/queries.ts
git commit -m "feat(accounts): getNetWorth and getAccountsAttention queries"
```

---

### Task 3: The `CardFace` primitive

**Files:**
- Create: `components/papel/card-face.tsx`, `components/papel/card-face.test.tsx`

**Interfaces:**
- Consumes: `Guilloche` (`@/components/papel/guilloche`), `cardForeground`/`gradientFrom` (`@/lib/color`), `DEFAULT_CARD_ACCENT`/`HEX6` (`@/lib/accounts/card-art`).
- Produces: `CardFace({ name, last4, network, accent, className? }: { name: string; last4: string | null; network: CardNetwork | null; accent: string | null; className?: string })`, and `NETWORK_WORDMARK: Record<CardNetwork, string>`.

**Anatomy (matches `components/marketing/papel/papel.module.css:921-974`, the single source):** 1.7 aspect ratio, 18px radius, `flex-col justify-between` (name at the top, masked number at the bottom), a clipped `Guilloche` rosette at 0.35 opacity in `currentColor`, the fill from `gradientFrom`/`cardForeground` fed by the stored accent, the network as an italic expanded wordmark bottom-right, and the inset top-highlight-plus-drop-shadow the marketing card already carries in its own box-shadow (`921-936`).

**Note — this drops the cardholder name from the face.** The marketing reference and Task 13's own `CardFace` signature carry no `holder` prop: the face's headline is the card's own name (the name the user typed when adding it — "the name inference" DESIGN.md resolved decision #2 calls out), matching PRODUCT.md's positioning claim ("brand, network, and colour inferred from the name the user typed"), not the person's name. The incumbent `PaymentCard` shows the cardholder instead; Task 4/5 remove that prop from every caller. This is a real, visible behaviour change resolved by the user in DESIGN.md, not an accidental one — flagged here so it is not "corrected" back during review.

- [ ] **Step 1: Write the failing test**

This project's existing Papel primitive tests (`components/papel/stamp.test.tsx`, `components/papel/note.test.tsx`) render with `renderToStaticMarkup` from `react-dom/server` and assert on the resulting HTML string — there is no `@testing-library/react` dependency in this project. Follow that exact convention, not `render`/`screen`:

```tsx
// components/papel/card-face.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CardFace, NETWORK_WORDMARK } from "./card-face";

const html = (props: Partial<React.ComponentProps<typeof CardFace>> = {}) =>
  renderToStaticMarkup(
    <CardFace name="BHD Visa Platinum" last4="4417" network="visa" accent="#e4b64a" {...props} />,
  );

describe("CardFace", () => {
  it("prints the network wordmark", () => {
    expect(html()).toContain(NETWORK_WORDMARK.visa);
  });

  it("renders no wordmark when the network is null", () => {
    const out = html({ network: null });
    expect(out).not.toContain(NETWORK_WORDMARK.visa);
    expect(out).not.toContain(NETWORK_WORDMARK.mastercard);
  });

  it("falls back to the default accent for an invalid or missing hex without throwing", () => {
    expect(() => html({ accent: "not-a-color" })).not.toThrow();
    expect(html({ accent: "not-a-color" })).toContain("BHD Visa Platinum");
  });

  it("masks a missing last4 as dots", () => {
    expect(html({ last4: null })).toContain("····");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/papel/card-face.test.tsx`
Expected: FAIL. Cannot find module `./card-face`.

- [ ] **Step 3: Implement `components/papel/card-face.tsx`**

```tsx
import { Guilloche } from "./guilloche";
import { cardForeground, gradientFrom } from "@/lib/color";
import { DEFAULT_CARD_ACCENT, HEX6 } from "@/lib/accounts/card-art";
import type { CardNetwork } from "@/lib/accounts/network";
import { cn } from "@/lib/utils";

export const NETWORK_WORDMARK: Record<CardNetwork, string> = {
  visa: "VISA",
  mastercard: "MASTERCARD",
  amex: "AMEX",
  discover: "DISCOVER",
};

/**
 * The one card face: the homepage's drawn card
 * (components/marketing/papel/papel.module.css:921-974), fed by the card's
 * own stored accent. Used by the marketing home page and every in-app card
 * (gallery, group tile, detail hero) so they match by construction.
 *
 * `name` is the card's own name (what the user typed), not the cardholder —
 * see the module doc comment above the plan task this was built from.
 */
export function CardFace({
  name,
  last4,
  network,
  accent,
  className,
}: {
  name: string;
  last4: string | null;
  network: CardNetwork | null;
  accent: string | null;
  className?: string;
}) {
  const base = accent && HEX6.test(accent) ? accent : DEFAULT_CARD_ACCENT;
  const fg = cardForeground(base);
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[1.7] w-full max-w-[25rem] flex-col justify-between overflow-hidden rounded-[18px] px-[1.4rem] py-[1.3rem]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_26px_50px_-24px_rgb(20_10_40/0.7)]",
        className,
      )}
      style={{ backgroundImage: gradientFrom(base), color: fg }}
    >
      <Guilloche
        lineWidth={0.5}
        className="pointer-events-none absolute -right-[95%] -top-[75%] -z-10 aspect-square w-[150%] opacity-35"
      />
      <span className="truncate text-[1.1rem] font-extrabold [font-stretch:112%]">{name}</span>
      <span className="figure font-semibold tracking-[0.14em]">•••• {last4 ?? "····"}</span>
      {network ? (
        <span className="absolute bottom-[1.2rem] right-[1.4rem] text-[0.95rem] font-black italic tracking-[0.04em] [font-stretch:125%]">
          {NETWORK_WORDMARK[network]}
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run components/papel/card-face.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/papel/card-face.tsx components/papel/card-face.test.tsx
git commit -m "feat(design): CardFace, the drawn card shared by marketing and the app"
```

---

### Task 4: Marketing home adopts `CardFace`

**Files:**
- Modify: `components/marketing/marketing-home.tsx:216-227`, `components/marketing/papel/papel.module.css:907-974`

**Interfaces:**
- Consumes: `CardFace` (Task 3).

- [ ] **Step 1: Replace the two static specimens**

In `components/marketing/marketing-home.tsx`, replace lines 216-227:

```tsx
              <div className={`${s.card} ${s.cardGold}`}>
                <Guilloche className={s.cardRosette} lineWidth={0.5} />
                <span className={s.cardName}>Visa Oro</span>
                <span className={s.cardNumber}>•••• 4417</span>
                <span className={s.cardNet}>VISA</span>
              </div>
              <div className={`${s.card} ${s.cardBlack}`}>
                <Guilloche className={s.cardRosette} lineWidth={0.5} />
                <span className={s.cardName}>Mastercard Black</span>
                <span className={s.cardNumber}>•••• 0932</span>
                <span className={s.cardNet}>MASTERCARD</span>
              </div>
```

with:

```tsx
              <CardFace
                name="Visa Oro"
                last4="4417"
                network="visa"
                accent="#e4b64a"
                className={s.cardGold}
              />
              <CardFace
                name="Mastercard Black"
                last4="0932"
                network="mastercard"
                accent="#2a2733"
                className={s.cardBlack}
              />
```

Add `import { CardFace } from "@/components/papel/card-face";` to the file's imports. `Guilloche` stays imported for the page's other rosettes (hero, close section).

- [ ] **Step 2: Trim `papel.module.css` to only what `CardFace` does not carry**

`CardFace` owns aspect ratio, radius, padding, flex layout, shadow, background and the rosette. `.cardGold`/`.cardBlack` in `components/marketing/papel/papel.module.css:937-946` keep only what is specific to their marketing placement — the `rotate` and, for `.cardBlack`, the offset `margin` — and lose the `background`/`color` declarations, which `CardFace` now sets inline from the `accent` prop:

```css
.cardGold {
  rotate: -5deg;
}
.cardBlack {
  rotate: 4deg;
  margin: 5.5rem 0 0 min(28%, 9rem);
}
```

Delete `.card` (921-936), `.cardRosette` (948-957), `.cardName` (958-962), `.cardNumber` (963-966) and `.cardNet` (967-974) entirely — `CardFace` draws all of it now.

- [ ] **Step 3: Confirm nothing else references the deleted classes**

Run: `rg -n "s\.card\b|s\.cardRosette|s\.cardName|s\.cardNumber|s\.cardNet\b" components/marketing`
Expected: no matches (only `s.cardGold`/`s.cardBlack` remain, both still used).

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/marketing-home.tsx components/marketing/papel/papel.module.css
git commit -m "refactor(marketing): home page cards render through CardFace"
```

---

### Task 5: In-app cards adopt `CardFace`; retire `PaymentCard`/`NetworkMark`

**Files:**
- Delete: `components/accounts/payment-card.tsx`, `components/accounts/network-mark.tsx`
- Modify: `components/accounts/{account-card,card-group-tile}.tsx`, `app/(app)/accounts/{page,[id]/page}.tsx`

**Interfaces:**
- Consumes: `CardFace` (Task 3).
- Removes: the `holder` prop from `AccountGallery`, `AddAccountControl` is unaffected; `AccountCard`, `CardGroupTile` drop `holder`; `AccountDetailPage`'s `face` object drops `holder`.

- [ ] **Step 1: Confirm `NetworkMark` has no other caller**

Run: `rg -l "NetworkMark|network-mark" components app`
Expected: only `components/accounts/payment-card.tsx`. If anything else matches, stop and re-scope this task rather than deleting a shared component.

- [ ] **Step 2: `account-card.tsx` — standalone card face**

Replace the `isStandaloneCard` branch (currently rendering `<PaymentCard holder={holder} last4={...} network={...} color={account.color} />`) with:

```tsx
        {isStandaloneCard ? (
          <CardFace
            name={account.name}
            last4={inferLast4(account.name, account.last4)}
            network={inferNetwork(account.name, account.brand)}
            accent={account.color}
          />
        ) : (
```

Update the import: replace `import { PaymentCard } from "./payment-card";` with `import { CardFace } from "@/components/papel/card-face";`. Remove `holder` from `AccountCard`'s props and from its one call site (`account-gallery.tsx`, both `<AccountCard key={cluster.key} account={cluster.items[0]} holder={holder} />` occurrences and the plain-group one) — `AccountCard` no longer takes it.

Also swap the colour-only `utilizationTone` usages inside this file for a glyph-carrying `ProofMark` per the Global Constraints "not colour alone" rule: where `CardBody` currently prints `<span className={cn("text-sm font-medium", utilizationTone(util))}>{formatPercent(util)}</span>`, replace with:

```tsx
        {util !== null ? (
          <ProofMark tone={util >= 80 ? "flag" : "neutral"} className="text-sm">
            {formatPercent(util)}
          </ProofMark>
        ) : null}
```

Delete the now-unused `utilizationTone` function and its `cn` import if nothing else in the file needs `cn`. Add `import { ProofMark } from "@/components/papel/proof-mark";`.

- [ ] **Step 3: `card-group-tile.tsx` — group face**

Replace the `<PaymentCard holder={holder} last4={resolvedLast4} network={network} color={artColor} className="pointer-events-none" />` call with:

```tsx
      <CardFace
        name={name}
        last4={resolvedLast4}
        network={network}
        accent={artColor}
        className="pointer-events-none"
      />
```

Remove the `holder` prop from `CardGroupTile`'s own props and its one call site in `account-gallery.tsx`. Update the import to `CardFace`. `resolvedLast4`/`network` inference stays exactly as written — only the rendered face changes.

- [ ] **Step 4: `account-gallery.tsx` — drop `holder` end to end**

`AccountGallery` currently threads `holder` from `page.tsx` through to both card components. Remove the `holder` prop from `AccountGallery`'s own signature, its two call sites (`<CardGroupTile ... holder={holder} .../>`, `<AccountCard key={cluster.key} account={cluster.items[0]} holder={holder} />`) and the plain-group `<AccountCard key={account.id} account={account} holder={holder} />`.

- [ ] **Step 5: `app/(app)/accounts/page.tsx` — drop the `holder` computation**

Remove the `holder` computation (the `profileLabel`/`t("cardholder")` block and the now-unused `auth`/`profile` destructuring it alone required — check whether `profile`/`auth` are still needed for `baseCurrency` before removing the `supabase.auth.getUser()` call; `baseCurrencyOf(profile)` still needs `profile`, so only drop what `holder` alone needed). Remove the `holder={holder}` prop passed to `<AccountGallery />`.

- [ ] **Step 6: `app/(app)/accounts/[id]/page.tsx` — detail hero face**

The `face` object (lines 113-120) currently includes `holder: profileLabel(...)`. Drop that field; `face` becomes:

```tsx
  const face = isCardType
    ? {
        last4: inferLast4(account.name, account.last4),
        network: inferNetwork(cardGroup?.name ?? account.name, cardGroup?.brand ?? account.brand),
        color: cardGroup ? cardGroup.art_color : account.color,
      }
    : null;
```

`face`'s `name` needs a value the current object never carried explicitly (it relied on `PaymentCard`'s `holder`); use the card's own display name, matching Task 3's contract:

```tsx
  const face = isCardType
    ? {
        name: cardGroup ? cardGroup.name : account.name,
        last4: inferLast4(account.name, account.last4),
        network: inferNetwork(cardGroup?.name ?? account.name, cardGroup?.brand ?? account.brand),
        accent: cardGroup ? cardGroup.art_color : account.color,
      }
    : null;
```

Replace `<PaymentCard {...face} />` with `<CardFace {...face} />` and update the import. Remove the now-dead `profileLabel`/`profile?.display_name`/`auth.user?.email` usage this block alone required — re-check the rest of the file (the welcome-bonus block above still needs `t("cardholder")`? confirm with `rg -n "cardholder|profileLabel" "app/(app)/accounts/[id]/page.tsx"` before deleting the import) since `profile`/`auth` may still be needed for `baseCurrencyOf(profile)`.

- [ ] **Step 7: Remove the dead `cardholder` message key if nothing else uses it**

Run: `rg -n '"cardholder"|t\("cardholder"\)' app components lib`
Expected: no remaining matches. If none, remove `"cardholder"` from both `Accounts` and `AccountDetail` namespaces in `messages/en.json` and `messages/es.json`, keeping the two files in parity.

- [ ] **Step 8: Delete the retired files**

```bash
git rm components/accounts/payment-card.tsx components/accounts/network-mark.tsx
```

- [ ] **Step 9: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS. Fix any remaining `holder`/`PaymentCard`/`NetworkMark` reference the compiler surfaces.

- [ ] **Step 10: Commit**

```bash
git add -A components/accounts app/\(app\)/accounts messages
git commit -m "feat(accounts): cards render through CardFace; drop the cardholder-on-card behavior"
```

---

### Task 6: The attention ledger

**Files:**
- Create: `components/accounts/attention-ledger.tsx`
- Modify: `messages/en.json`, `messages/es.json` (new `Accounts.attention*` keys)

**Interfaces:**
- Consumes: `AttentionItem` (Task 2), `LedgerRow`/`ProofMark`/`Stamp` (Phase 0), `getAccountsAttention` (Task 2, called from `page.tsx` in Task 7).
- Produces: `<AttentionLedger items={AttentionItem[]} />` — renders nothing (not even a heading) when `items` is empty.

- [ ] **Step 1: Add the message keys**

`messages/en.json`, under `Accounts`:

```json
"attentionTitle": "Needs a look",
"attentionOverdue": "Overdue",
"attentionDueSoon": "Due {date}",
"attentionUntriaged": "{count} uncategorized"
```

`messages/es.json`, under `Accounts`:

```json
"attentionTitle": "Necesita revisión",
"attentionOverdue": "Atrasada",
"attentionDueSoon": "Vence {date}",
"attentionUntriaged": "{count} sin categorizar"
```

- [ ] **Step 2: Implement `components/accounts/attention-ledger.tsx`**

```tsx
import { useTranslations, useLocale } from "next-intl";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ProofMark } from "@/components/papel/proof-mark";
import { Stamp } from "@/components/papel/stamp";
import { inferNetwork } from "@/lib/accounts/network";
import { formatDate } from "@/lib/format";
import type { AttentionItem } from "@/lib/accounts/attention";

/**
 * What needs a decision before anything else on the page: overdue, due
 * soon, or still carrying uncategorised spend. Renders nothing at all,
 * including no heading, when there is nothing to flag — a quiet month must
 * read as calm, not as a section that failed to load.
 */
export function AttentionLedger({ items }: { items: AttentionItem[] }) {
  const t = useTranslations("Accounts");
  const locale = useLocale();
  if (items.length === 0) return null;

  return (
    <section className="space-y-1">
      <h2 className="legend text-[11px] text-muted-foreground">{t("attentionTitle")}</h2>
      <div className="rounded-[4px] border border-(--paper-line)">
        {items.map((item) => (
          <LedgerRow
            key={item.id}
            lead={<Stamp color={item.color} name={item.name} size="sm" />}
            title={item.name}
            amount={
              <ProofMark tone="flag">
                {item.reason === "overdue"
                  ? t("attentionOverdue")
                  : item.reason === "due-soon" && item.dueDate
                    ? t("attentionDueSoon", { date: formatDate(item.dueDate, locale) })
                    : t("attentionUntriaged", { count: item.pendingTriageCount })}
              </ProofMark>
            }
          />
        ))}
      </div>
    </section>
  );
}
```

`inferNetwork` is imported for parity with other account rows but unused directly here (the `Stamp` lead uses the account's own colour/name initial, matching every other ledger row in the app); remove the import if `tsc`/lint flags it unused after Step 2 — keep the component honest rather than keeping a dead import to match a template.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (this task has no page mounting it yet — that is Task 7 — so verify only that the component itself compiles and lints clean).

- [ ] **Step 4: Commit**

```bash
git add components/accounts/attention-ledger.tsx messages
git commit -m "feat(accounts): the attention ledger, wordless when nothing needs a look"
```

---

### Task 7: Recompose the Accounts list page

**Files:**
- Modify: `app/(app)/accounts/page.tsx`, `components/accounts/account-gallery.tsx`

**Interfaces:**
- Consumes: `getNetWorth`, `getAccountsAttention` (Task 2), `AttentionLedger` (Task 6), `Note` (Phase 0), `CardFace` (Task 3, already wired into `AccountCard`/`CardGroupTile` by Task 5).

- [ ] **Step 1: Fetch net worth and attention on the list page**

In `app/(app)/accounts/page.tsx`, add to the `Promise.all` that already fetches `accounts`, `currencies`, `cardGroups`, `banks`:

```tsx
  const [accounts, currencies, cardGroups, banks, netWorth, attention] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
    getNetWorth(baseCurrencyOf(await (async () => {
```

This inline IIFE is awkward because `baseCurrency` today is derived after the `Promise.all` (it needs `profile`, fetched in a second `Promise.all` below). Reorder instead: move the `supabase`/`profile`/`auth` fetch **above** the accounts `Promise.all` so `baseCurrency` is known first, then fetch `getNetWorth(baseCurrency)` and `getAccountsAttention()` alongside the rest:

```tsx
export default async function AccountsPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("base_currency, display_name").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const baseCurrency = baseCurrencyOf(profile);

  const [accounts, currencies, cardGroups, banks, netWorth, attention] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
    getNetWorth(baseCurrency),
    getAccountsAttention(),
  ]);
  const t = await getTranslations("Accounts");
```

Remove the now-duplicate `supabase`/`profile`/`auth` block that used to sit after the accounts fetch (Task 5, Step 5 already trimmed the `holder`-only parts of it; this step removes the rest, since it moved up). Add the two new imports:

```tsx
import { getNetWorth, getAccountsAttention } from "@/lib/accounts/queries";
```

(these live in the same module as the other `getAccountsWithStatus`/`getCurrencies` imports already imported from `@/lib/accounts/queries`, so add them to that existing import line rather than a new one.) Also import `Note` and `AttentionLedger`:

```tsx
import { Note } from "@/components/papel/note";
import { AttentionLedger } from "@/components/accounts/attention-ledger";
import { MoneyDisplay } from "@/components/ui/money-display";
```

- [ ] **Step 2: Render the attention ledger and the Note above the gallery**

Replace the page's return block:

```tsx
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          accounts.length > 0 ? (
            <AddAccountControl
              currencies={currencies}
              banks={banks}
              baseCurrency={baseCurrency}
              placeholder={t("addAccount")}
            />
          ) : undefined
        }
      />
      <AttentionLedger items={attention} />
      {accounts.length > 0 ? (
        <Note tone="violet" label={t("netWorthLabel")}>
          <MoneyDisplay amount={netWorth} currency={baseCurrency} size="hero" />
        </Note>
      ) : null}
      <AccountGallery
        accounts={accounts}
        currencies={currencies}
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
      />
      <CardArtBackfill pending={pendingArt} />
    </div>
  );
```

The Note is skipped on the empty-accounts state (`accounts.length === 0`), matching the "at most one Note, and never a Note with nothing to report" discipline Overview's own empty state already follows.

- [ ] **Step 3: Add the `netWorthLabel` message key**

`messages/en.json` `Accounts`: `"netWorthLabel": "Net worth"`. `messages/es.json` `Accounts`: `"netWorthLabel": "Patrimonio neto"`.

- [ ] **Step 4: Per-currency card lines under a double rule**

In `account-gallery.tsx`, the `cards` group today renders every cluster (solo card or `CardGroupTile`) in one `grid`. Task 13 asks for per-currency lines "as ledger sections under a double rule" beneath each card's face — `CardGroupTile` already renders its currency lines as rows beneath the face (Task 5 kept that structure); this step only adds the double rule Task 13 asks for, immediately above those rows. In `card-group-tile.tsx`, change:

```tsx
      <div className="relative z-10 mt-4 divide-y">
```

to:

```tsx
      <div className="relative z-10 mt-4 divide-y border-t-2 border-(--rule)">
```

The heavy `border-t-2` plus the hairline `divide-y` immediately under it reads as the double rule DESIGN.md's Layout section describes for the shell's own heavy-rule-over-hairline pattern — no new CSS token needed.

- [ ] **Step 5: Verify `holder` is fully gone from this file**

Run: `rg -n "holder" components/accounts/account-gallery.tsx`
Expected: no matches (Task 5 already removed it from this file's two call sites; this step is a checkpoint, not new work).

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/accounts/page.tsx components/accounts/account-gallery.tsx components/accounts/card-group-tile.tsx messages
git commit -m "feat(accounts): Attention First composition — attention ledger, net-worth Note, card gallery"
```

---

### Task 8: Loans and cuotas print as `Perforation`

**Files:**
- Modify: `components/accounts/account-card.tsx` (`LoanBody`), `app/(app)/accounts/[id]/page.tsx` (loan progress block)

**Interfaces:**
- Consumes: `Perforation` (Phase 0, `total`/`paid`/`label`).

- [ ] **Step 1: `account-card.tsx` — `LoanBody`**

Replace:

```tsx
      {term ? <Progress value={pct} /> : null}
```

with:

```tsx
      {term ? <Perforation total={term} paid={paid} label={t("paidOfTerm", { paid, term })} /> : null}
```

`pct` becomes unused in `LoanBody` once `Progress` is gone — remove its computation (`const pct = term && term > 0 ? ... : 0;`) along with the now-unused `Progress` import if nothing else in the file needs it (`AccountCard`'s card `CardBody` still uses `Progress` for utilization — Task 13 does not ask for the card utilization bar to change, only cuotas/loans — so keep the import if `CardBody` still uses it). Add `import { Perforation } from "@/components/papel/perforation";`.

- [ ] **Step 2: `[id]/page.tsx` — the loan hero's progress block**

Replace:

```tsx
                {progressTerm ? (
                  <div className="mt-4 max-w-sm space-y-2">
                    <Progress value={Math.min(Math.max((progressPaid / progressTerm) * 100, 0), 100)} />
                    <p className="text-sm text-muted-foreground">
                      {t("installmentsPaidOfTerm", { paid: progressPaid, term: progressTerm })}
                    </p>
                  </div>
                ) : (
```

with:

```tsx
                {progressTerm ? (
                  <div className="mt-4 max-w-sm space-y-2">
                    <Perforation
                      total={progressTerm}
                      paid={progressPaid}
                      label={t("installmentsPaidOfTerm", { paid: progressPaid, term: progressTerm })}
                    />
                  </div>
                ) : (
```

Add `import { Perforation } from "@/components/papel/perforation";`. Check whether `Progress` is still used elsewhere in this file (the card utilization block above it uses `<Progress value={...} />` too — Task 13 does not ask for that one to change) before removing the import.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/accounts/account-card.tsx app/\(app\)/accounts/\[id\]/page.tsx
git commit -m "feat(accounts): loans and cuotas print as a perforated strip"
```

---

### Task 9: Statements panel onto `LedgerRow` + `ProofMark`

**Files:**
- Modify: `components/accounts/statements-panel.tsx`

**Interfaces:**
- Consumes: `LedgerRow`, `ProofMark` (Phase 0).
- Decision: `ok` = the statement's newest import has no pending triage lines (`!triageCounts[s.id]`); `flag` = it does (`triageCounts[s.id]` present, with the pending count as the flag's label). This is Task 13's "the statement's sums checked" read through the one field the page already loads for exactly this purpose — no new query.

- [ ] **Step 1: Replace the `<ul>` of `<li>` rows with `LedgerRow`s**

Replace the statements list block (currently `<ul className="space-y-2">...<li className="rounded-lg border p-3">`) with a `LedgerRow` per statement, keeping every existing behaviour (expand/collapse lines, delete, categorize-count button) as children under the row:

```tsx
        <div className="rounded-[4px] border border-(--paper-line)">
          {statements.map((s) => (
            <div key={s.id}>
              <LedgerRow
                lead={
                  triageCounts[s.id] ? (
                    <ProofMark tone="flag">{t("categorizeCount", { count: triageCounts[s.id].count })}</ProofMark>
                  ) : (
                    <ProofMark tone="ok">{tc("done")}</ProofMark>
                  )
                }
                title={formatDate(s.period_end, locale)}
                subtitle={
                  s.due_date
                    ? t("dueLabel", { date: formatDate(s.due_date, locale) })
                    : s.source === "import"
                      ? t("sourceImport")
                      : t("sourceManual")
                }
                amount={<span className="figure text-sm">{formatMoney(Number(s.total_balance), currency)}</span>}
                meta={
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      isLoading={busyId === s.id}
                      aria-label={expanded === s.id ? t("hideLinesAria") : t("viewLinesAria")}
                      onClick={() => onToggleLines(s.id)}
                    >
                      {busyId === s.id ? null : expanded === s.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      isLoading={busyId === s.id}
                      onClick={() => setDeleteTarget(s.id)}
                    >
                      {busyId === s.id ? null : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                }
              />
              {expanded === s.id ? (
                <div className="border-b border-(--paper-line) px-4 pb-3 pt-1 space-y-1.5">
                  {lines[s.id] === undefined ? (
                    <p className="text-xs text-muted-foreground">{t("linesLoading")}</p>
                  ) : lines[s.id].length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("linesEmpty")}</p>
                  ) : (
                    lines[s.id].map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground">{formatDate(l.madeOn, locale)}</span>{" "}
                          <span className="text-foreground">{l.description}</span>
                          {l.kind === "payment" ? (
                            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                              {t("linePaymentBadge")}
                            </span>
                          ) : l.kind === "adjustment" ? (
                            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                              {t("lineAdjustmentBadge")}
                            </span>
                          ) : l.amount < 0 ? (
                            <span className="ml-1.5 rounded bg-success/10 px-1 py-0.5 text-[9px] uppercase text-success">
                              {tTxn("refundBadge")}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "figure shrink-0 tabular-nums",
                            l.amount < 0 ? "text-success" : "text-foreground",
                          )}
                        >
                          {formatMoney(l.amount, currency, { signed: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
```

Add `import { LedgerRow } from "@/components/papel/ledger-row";` and `import { ProofMark } from "@/components/papel/proof-mark";`. The `minimumLabel`/`costOfCarryStat` copy above the list is untouched — this step only replaces the list markup.

- [ ] **Step 2: Add the `Common.done` key if it does not already exist**

Run: `node -e "console.log(require('./messages/en.json').Common.done)"`. If it prints `undefined`, add `"done": "Done"` to `Common` in `messages/en.json` and `"done": "Listo"` in `messages/es.json`; otherwise reuse the existing key as written above.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/accounts/statements-panel.tsx messages
git commit -m "feat(accounts): statements panel prints as a ledger with proof marks"
```

---

### Task 10: Amortization table onto ruled-ledger tokens

**Files:**
- Modify: `components/accounts/amortization-table.tsx`

**Interfaces:** none new — a token/typography pass only, structure (a `<table>`) is unchanged, matching Task 13's "the amortisation table is a ruled ledger" against a table that is already ruled.

- [ ] **Step 1: Swap incumbent tokens for Papel ones and add `.figure`/`.legend`**

Replace the header row's classes (`className="border-b text-left text-xs text-muted-foreground"`) with `className="legend border-b border-(--paper-line) text-left text-[11px] text-muted-foreground"`, and each numeric `<td>`'s bare `tabular-nums` with `figure` (the Papel figure class already sets `tabular-nums`, so this also normalizes the font). The paid row's `text-muted-foreground` styling and the `Check` glyph stay — that is already the "not colour alone" pattern (a glyph, not a colour, marks a paid row).

- [ ] **Step 2: Screenshot-check at 360px**

This is a pure restyle with no logic change, so no new test — verify visually in the batched review round (Task 14) that the table still fits 360px without horizontal scroll regressing (`min-w-[28rem]` inside `overflow-x-auto` already handles that; confirm it still does after the class changes).

- [ ] **Step 3: Typecheck, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/accounts/amortization-table.tsx
git commit -m "style(accounts): amortization table onto Papel figure/legend tokens"
```

---

### Task 11: Balance chart onto ink-line-on-hairline-axes

**Files:**
- Modify: `components/accounts/balance-chart.tsx`

**Interfaces:** none new — restyle only. Non-negotiable from Task 13: "the balance chart is an ink line on hairline axes (Phase 5 finalises chart style, and Phase 2 must not contradict it)" — this means a plain ink line, no gradient area fill (Phase 5 owns the eventual chart palette/pattern system; Phase 2 must not invent a competing fill treatment).

- [ ] **Step 1: Drop the gradient area fill; keep the axes on `--paper-line`**

Remove the `<defs><linearGradient id="balanceFill">...` block and the `<Area ... fill="url(#balanceFill)" />`. Replace `AreaChart`/`Area` with `LineChart`/`Line`:

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
```

```tsx
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          stroke="var(--ink-soft)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip
          contentStyle={{
            background: "var(--paper-2)",
            border: "1px solid var(--paper-line)",
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(value) => formatMoney(Number(value), currency)}
        />
        <Line dataKey="balance" stroke="var(--ink)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
```

`var(--chart-1)` is replaced with `var(--ink)` for the line itself — the line is the "ink line" Task 13 asks for, not a categorical series colour (this chart has exactly one series; `--chart-1`/the categorical palette is Phase 5's territory and this task must not touch it). `var(--muted-foreground)``/``var(--border)``/``var(--popover)` become their Papel equivalents (`--ink-soft`, `--paper-line`, `--paper-2`).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/accounts/balance-chart.tsx
git commit -m "style(accounts): balance chart is an ink line on hairline axes"
```

---

### Task 12: Onboarding `SavedRow` onto `LedgerRow`/`Stamp`

**Files:**
- Modify: `components/onboarding/parts.tsx`

**Interfaces:**
- Consumes: `LedgerRow`, `Stamp` (Phase 0).

- [ ] **Step 1: Replace `SavedRow`'s body**

`SavedRow` (line 85) currently renders a bordered `<li>` wrapping a `ColorTile`. Replace its body with `LedgerRow` and `Stamp` (`ColorTile` already aliases `Stamp` since Phase 0, so this is a like-for-like swap of the wrapper, not the icon):

```tsx
export function SavedRow({
  icon,
  color,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="rounded-[4px] border border-(--paper-line)">
      <LedgerRow lead={<Stamp color={color} icon={icon} size="sm" />} title={title} subtitle={subtitle} meta={trailing} />
    </li>
  );
}
```

Add `import { LedgerRow } from "@/components/papel/ledger-row";` and `import { Stamp } from "@/components/papel/stamp";`; the existing `ColorTile` import can be removed from this file once this is its only caller within `parts.tsx` (`rg -n "ColorTile" components/onboarding/parts.tsx` to confirm before removing the import).

`trailing` moves from a free-floating flex child to `meta`, which `LedgerRow` right-aligns in its own tabular column — check each `SavedRow` caller's `trailing` content (`rg -n "trailing=" components/onboarding`) still reads sensibly right-aligned (a `<Check>` icon or a small `<Button>`, both already right-aligned in the incumbent layout, so this should be a no-op visually).

- [ ] **Step 2: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/parts.tsx
git commit -m "style(onboarding): saved rows print as ledger rows"
```

---

### Task 13: Help — Accounts chapter and mock

**Files:**
- Modify: `app/(app)/help/page.tsx`, `components/help/mocks.tsx`, `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `SpecimenFrame` (Phase 0), `Note`, `CardFace`, `LedgerRow`, `ProofMark`, `Perforation` (this phase).

- [ ] **Step 1: Read the Overview precedent before writing this one**

Read `components/help/mocks.tsx`'s existing `OverviewMock` and its `SpecimenFrame` wrapper, and the Overview chapter in `app/(app)/help/page.tsx`, in full before writing `AccountsMock` — the two must use the same sample-data labelling convention (`specimenLabel`/`sampleData`) Task 13's file list and DESIGN.md's "label every specimen number" rule both require, and copying the established pattern is safer than re-deriving it.

- [ ] **Step 2: Write `AccountsMock`**

Build it from the same primitives the live page now uses (`Note` for net worth, `CardFace` for one sample card, a couple of `LedgerRow`s for per-currency lines, a `Perforation` for a sample cuota), with clearly synthetic sample values (following whatever `sampleData`/specimen-labelling helper `OverviewMock` uses), wrapped in `<SpecimenFrame>`. Mount it in the Accounts chapter of `app/(app)/help/page.tsx`, replacing whatever placeholder or incumbent-look illustration is there today (read that chapter's current content first — `rg -n "Accounts" "app/(app)/help/page.tsx"` — before replacing it, since the exact current markup was not part of this plan's research and must be read fresh at build time).

- [ ] **Step 3: Copy parity check**

Run: `node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const a=new Set(f(require('./messages/en.json'))),b=new Set(f(require('./messages/es.json')));const d=[...a].filter(k=>!b.has(k)).concat([...b].filter(k=>!a.has(k)));console.log(d.length?d:'parity ok')"`
Expected: `parity ok`.

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/help/page.tsx components/help/mocks.tsx messages
git commit -m "docs(help): Accounts chapter and mock match the live primitives"
```

---

### Task 14: Batched review, audit, polish, finish

**Files:** none new — this task inspects and, where the review finds material gaps, fixes across the files this plan already touched.

- [ ] **Step 1: Build and smoke-test**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all pass, including the message-parity check from Task 13.

- [ ] **Step 2: Batched screenshot round**

Start the dev server on a fixed port (`run_in_background`, stop it in this same task once captures are done). Capture `/accounts` and `/accounts/[a real card id]` at desktop and 360px, light and dark, and in `es` locale, into `.impeccable/review/` (`desktop.png`, `mobile.png` per route, per the impeccable finish convention) — one batched round, per this project's own common-steps contract (fewer, larger rounds rather than a screenshot per tweak).

- [ ] **Step 3: One fix batch**

Fix everything the round surfaces in one batch (do not re-open individual findings one at a time). Re-run Step 1's checks after the batch.

- [ ] **Step 4: Detector**

Run: `node .claude/skills/impeccable/scripts/detect.mjs --json` over the changed targets (`app/(app)/accounts`, `components/accounts`, `components/papel/card-face.tsx`, `components/onboarding/parts.tsx`, `components/marketing`). Fix what is mechanical; carry the rest into the reviewer packet.

- [ ] **Step 5: Spawn `impeccable-finish-reviewer`**

Per `.claude/skills/impeccable/reference/new-work.md` section 7: pass the original Task 13 scope, this plan's locked composition, the artifact paths, the Step 2 screenshots, the detector findings, and `reference/craft-floor.md`'s path. No approved comp exists (code-led build, Task 13's own wireframe is the reference); note that explicitly in the packet.

- [ ] **Step 6: Act on the disposition**

Follow `ship`/`fix`/`recapture`/`rebuild` exactly as new-work.md section 7 defines them. A `fix` disposition gets one batch, one recapture, one verdict pass — no third round without asking the user.

- [ ] **Step 7: Spawn `impeccable-documenter`**

Extend `DESIGN.md`'s "Pending, not yet migrated" table: move Accounts from the Phase 2 pending line into a new "### Accounts (Phase 2)" section describing what actually got built (mirroring the existing "### Overview (Phase 1)" section's level of detail), and update the primitives table's "Used for" column for any primitive Accounts newly consumes (`CardFace` needs its own new row; `Perforation`'s "no screen uses it yet" note needs removing).

- [ ] **Step 8: Merge**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
git add -A && git commit -m "chore(accounts): finish Phase 2 — review, audit, DESIGN.md"
git checkout main && git merge --no-ff redesign/papel-accounts
git branch -d redesign/papel-accounts
```

Ask the user before pushing `main` or deleting the remote branch, per this session's standing git-safety instructions — this plan's Step 8 stops at the local merge.
