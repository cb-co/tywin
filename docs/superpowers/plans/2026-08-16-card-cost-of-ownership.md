# Cost of Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show what each credit card charges you to hold it — annual fees, insurance, membership products — on the Insights page and on each card's detail page, read from statement fee lines already in the database.

**Architecture:** A pure classification module (`lib/accounts/card-fees.ts`) sorts fee-line descriptions into recurring ownership costs, one-off incident fees, and excluded interest, netting issuer reversals. Two thin query layers feed it: an all-cards roll-up in `lib/insights/queries.ts` and a single-account fetch in `lib/accounts/queries.ts`. No migration — the data already exists in `card_statement_lines`.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Supabase (`@supabase/ssr`), next-intl, Vitest, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-16-card-cost-of-ownership-design.md`

## Global Constraints

- **Interest is excluded by construction.** `interes` / `interest` / `financiamiento` never contribute to either subtotal. This is the cardholder's explicit requirement, not a refinement.
- **Costs are never netted against benefits.** No task may produce a combined cost-minus-cashback figure on any surface.
- **No annualization or projection.** Every user-facing figure is a period total, never a run rate. The Insights card carries the window in its title ("Cost of ownership in {year}", following the Cashback card); the account detail lines say "charged in {year}" outright.
- **Silence, not zeros.** A card with **no counted fee rows** is omitted from the Insights list entirely and shows no line on its detail page — a zero drawn from the *absence* of data is a claim the data cannot support. This does not forbid a real, data-backed zero: a card that had fee rows but no recurring ones legitimately shows `0.00` in its Insights row, with its incident figure in the subtitle explaining why it is listed.
- **Both locales, always.** Every new key lands in `messages/en.json` *and* `messages/es.json` in the same commit.
- **Year as a string in ICU.** `t("...", { year: String(year) })` — a numeric argument routes through `Intl.NumberFormat` and renders `2,026`.
- **No migration, no schema change, no prompt change.** `lib/statements/llm/system-prompt.ts` is not touched.
- Tests run with `npm test` (`vitest run`). Import alias `@` resolves to the repo root.

## File Structure

| File | Responsibility |
|---|---|
| `lib/accounts/card-fees.ts` (create) | Pure classification + reversal netting + per-year summation. No Supabase client. Mirrors `cashback.ts`. |
| `lib/accounts/card-fees.test.ts` (create) | Unit tests for the above. |
| `lib/insights/queries.ts` (modify) | `buildCardFeeLines()` (pure, testable) + `getCardFees()` (fetch + FX). |
| `lib/insights/queries.test.ts` (modify) | Tests for `buildCardFeeLines()`. |
| `app/(app)/insights/page.tsx` (modify) | Renders the Cost of ownership card in the Debt section. |
| `lib/accounts/queries.ts` (modify) | `getAccountFeeLines()` — one account, one year. |
| `app/(app)/accounts/[id]/page.tsx` (modify) | Two standing-fact lines on the card face panel. |
| `app/(app)/help/page.tsx` (modify) | Two new guide bullets + the missing Loan interest bullet. |
| `messages/en.json`, `messages/es.json` (modify) | All new copy. |

---

### Task 1: Pure fee classification module

**Files:**
- Create: `lib/accounts/card-fees.ts`
- Test: `lib/accounts/card-fees.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type FeeLineRow = { description: string; amount: number; kind: "fee" | "credit"; posted_on: string }`
  - `type FeeBucket = "recurring" | "incidents" | "excluded"`
  - `type CardFeeTotals = { recurring: number; incidents: number; counted: number }`
  - `classifyFee(description: string): FeeBucket`
  - `reversalTarget(description: string): FeeBucket | null`
  - `summarizeCardFees(rows: FeeLineRow[], year: number): CardFeeTotals`

- [ ] **Step 1: Write the failing test**

Create `lib/accounts/card-fees.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyFee,
  reversalTarget,
  summarizeCardFees,
  type FeeLineRow,
} from "./card-fees";

const fee = (description: string, amount: number, posted_on = "2026-06-15"): FeeLineRow =>
  ({ description, amount, kind: "fee", posted_on });

const credit = (description: string, amount: number, posted_on = "2026-07-03"): FeeLineRow =>
  ({ description, amount, kind: "credit", posted_on });

describe("classifyFee", () => {
  it("excludes interest, whatever the wording", () => {
    expect(classifyFee("INTERES FINANCIAMIENTO")).toBe("excluded");
    expect(classifyFee("Interés")).toBe("excluded");
    expect(classifyFee("INTEREST CHARGE")).toBe("excluded");
  });

  // Interest is tested BEFORE the incident list on purpose: late interest is
  // still interest, and Cost of carry is the surface that owns it.
  it("prefers the interest rule over the incident rule", () => {
    expect(classifyFee("INTERES POR MORA")).toBe("excluded");
  });

  it("files things that happened as incidents", () => {
    expect(classifyFee("CARGO SOBREGIRO")).toBe("incidents");
    expect(classifyFee("Cargo por mora")).toBe("incidents");
    expect(classifyFee("LATE PAYMENT FEE")).toBe("incidents");
  });

  it("files known ownership charges as recurring", () => {
    expect(classifyFee("CARGO SEGURO FRAUDE")).toBe("recurring");
    expect(classifyFee("CARGO COBERTURA DE SEGURO")).toBe("recurring");
    expect(classifyFee("CUOTA ANUALIDAD")).toBe("recurring");
  });

  // The live data's argument for defaulting to recurring: the issuer tagged
  // this a fee, and it matches none of the prompt's keywords — it is a bundled
  // insurance product with a pure brand name. Incident vocabulary is a bounded
  // list; ownership charges are unbounded product names.
  it("defaults an unrecognised product name to recurring", () => {
    expect(classifyFee("AHORRO MUJER WHITE")).toBe("recurring");
  });

  // Whole words only: a keyword must not match inside a longer word.
  it("does not match a keyword inside another word", () => {
    expect(classifyFee("CHOCOLATERIA")).toBe("recurring");
    expect(classifyFee("MEMORABLE")).toBe("recurring");
  });
});

describe("reversalTarget", () => {
  it("routes a fee reversal back to the bucket it reverses", () => {
    expect(reversalTarget("REVERSO CARGO SEGURO FRAUDE")).toBe("recurring");
    expect(reversalTarget("ANULACION CARGO SOBREGIRO")).toBe("incidents");
  });

  // The guard. Without the fee-word test this would drag an ordinary purchase
  // refund into a card about fees.
  it("ignores a reversal that reverses something other than a fee", () => {
    expect(reversalTarget("REVERSO COMPRA")).toBeNull();
  });

  it("ignores a credit that is not a reversal at all", () => {
    expect(reversalTarget("CASHBACK SERVICIOS DEL")).toBeNull();
    expect(reversalTarget("Rebate VISA ISI")).toBeNull();
  });
});

describe("summarizeCardFees", () => {
  // The four rows actually present in the database, with SEGURO FRAUDE as its
  // two real 350.00 charges. The issuer billed it twice by mistake and reversed
  // one, which is exactly why a naive sum(kind='fee') is wrong here.
  const live: FeeLineRow[] = [
    fee("CARGO SEGURO FRAUDE", 350, "2026-06-26"),
    fee("CARGO SEGURO FRAUDE", 350, "2026-06-30"),
    fee("CARGO COBERTURA DE SEGURO", 1300, "2026-06-26"),
    fee("CARGO SOBREGIRO", 500, "2026-06-25"),
    credit("REVERSO CARGO SEGURO FRAUDE", -350, "2026-07-03"),
  ];

  it("nets reversals against the bucket they reverse", () => {
    expect(summarizeCardFees(live, 2026)).toEqual({
      recurring: 1650,
      incidents: 500,
      counted: 5,
    });
  });

  it("keeps interest out of both subtotals", () => {
    const rows = [fee("CARGO SEGURO FRAUDE", 350), fee("INTERES FINANCIAMIENTO", 900)];
    expect(summarizeCardFees(rows, 2026)).toEqual({
      recurring: 350,
      incidents: 0,
      counted: 1,
    });
  });

  it("ignores rows posted in another year", () => {
    const rows = [
      fee("CARGO SEGURO FRAUDE", 350, "2025-12-26"),
      fee("CARGO SEGURO FRAUDE", 350, "2026-01-26"),
    ];
    expect(summarizeCardFees(rows, 2026).recurring).toBe(350);
  });

  // `counted` is what lets the surfaces tell "no fee lines at all" from "fees
  // that netted to zero". The former is omitted; a confident 0.00 drawn from
  // silence is a claim the data cannot support.
  it("reports nothing counted when there are no fee rows", () => {
    expect(summarizeCardFees([], 2026)).toEqual({ recurring: 0, incidents: 0, counted: 0 });
    expect(summarizeCardFees([credit("CASHBACK SERVICIOS DEL", -259)], 2026).counted).toBe(0);
  });

  it("counts rows that net to zero", () => {
    const rows = [fee("CARGO SEGURO FRAUDE", 350), credit("REVERSO CARGO SEGURO FRAUDE", -350)];
    expect(summarizeCardFees(rows, 2026)).toEqual({
      recurring: 0,
      incidents: 0,
      counted: 2,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- card-fees`
Expected: FAIL — `Failed to resolve import "./card-fees"`.

- [ ] **Step 3: Write the implementation**

Create `lib/accounts/card-fees.ts`:

```ts
/**
 * What a credit card charges you to HOLD it, read off the fee lines of imported
 * statements.
 *
 * The data was already there. `card_statement_lines.kind` has carried a 'fee'
 * value since the import shipped, because the extraction prompt classifies any
 * line opening with a fee word — cargo, fee, comisión, interés, seguro — as one
 * (lib/statements/llm/system-prompt.ts). Nothing downstream ever read it. This
 * module is the reader, which is why the feature ships with history rather than
 * starting from the next import.
 *
 * INTEREST IS EXCLUDED BY CONSTRUCTION, and that is the whole reason this file
 * classifies rather than sums. The prompt puts `interés` in the same bucket as
 * `cargo` and `seguro`, so a naive sum over kind='fee' would fold a finance
 * charge into the cost of owning the card. It would also double-count: Cost of
 * carry already reports what a balance costs, and one surface cannot hold a
 * projection and a realized charge. The exclusion is checked FIRST, so
 * "interés por mora" is excluded too — a misfire in that direction can only
 * under-report ownership cost, never inflate it.
 *
 * RECURRING IS THE DEFAULT, and the live data is the argument. `AHORRO MUJER
 * WHITE` was tagged a fee by the model despite matching none of the prompt's
 * keywords: it is a bundled insurance product with a pure brand name. Incident
 * vocabulary (sobregiro, mora, late…) is a bounded, enumerable list; ownership
 * charges are unbounded product names. So the enumerable case gets the explicit
 * list and the unbounded case gets the default.
 *
 * Classification happens HERE, at read time, rather than as a field the model
 * fills in. A `feeKind` in the extraction schema would need a migration, a
 * prompt change and a null-fallback for every existing row — and it could never
 * fix history, because the statements bucket was dropped in
 * 20260722170000_drop_statements_bucket.sql and the source PDFs are gone.
 */

/** One statement line, already coerced out of Supabase's numeric-as-string. */
export type FeeLineRow = {
  description: string;
  amount: number;
  kind: "fee" | "credit";
  posted_on: string;
};

export type FeeBucket = "recurring" | "incidents" | "excluded";

export type CardFeeTotals = {
  recurring: number;
  incidents: number;
  /** How many rows actually contributed. This is what lets a caller tell "no
   *  fee lines at all" from "fees that happened to net to zero": the surfaces
   *  omit a card entirely for the former rather than printing a 0.00 the data
   *  cannot vouch for. Same convention as hasReportedCashback in cashback.ts. */
  counted: number;
};

/** Lowercased and stripped of diacritics, so one keyword list matches `INTERÉS`,
 *  `Interes` and `interés` alike. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Whole-word match. A bare `includes` would file CHOCOLATERIA as an incident on
 *  the strength of "late", and MEMORABLE on "mora". Multi-word keywords such as
 *  "cash advance" work unchanged — \b sits at the outer edges. */
const has = (text: string, words: readonly string[]) =>
  words.some((w) => new RegExp(`\\b${w}\\b`).test(text));

const INTEREST = ["interes", "interest", "financiamiento"] as const;

const INCIDENT = [
  "sobregiro", "overdraft", "mora", "late", "atraso", "tardio",
  "penalidad", "penalty", "reposicion", "replacement",
  "avance", "cash advance", "exceso",
] as const;

const REVERSAL = ["reverso", "reversa", "reversal", "anulacion"] as const;

const FEE_WORDS = [
  "cargo", "seguro", "comision", "cobertura", "membresia", "anualidad", "fee",
] as const;

/** Which bucket a `kind = 'fee'` line belongs to. Order is load-bearing: see
 *  the interest note in this file's header. */
export function classifyFee(description: string): FeeBucket {
  const text = norm(description);
  if (has(text, INTEREST)) return "excluded";
  if (has(text, INCIDENT)) return "incidents";
  return "recurring";
}

/**
 * The bucket a `kind = 'credit'` line reverses, or null if it reverses nothing
 * this module cares about.
 *
 * Issuers post a reversal as a credit rather than as a negative fee, which puts
 * it in the same bucket as cashback and merchant refunds. Both tests are needed:
 * the prefix alone would pull `REVERSO COMPRA` — an ordinary purchase refund —
 * into a card about fees.
 */
export function reversalTarget(description: string): FeeBucket | null {
  const text = norm(description);
  const prefix = new RegExp(`^(${REVERSAL.join("|")})\\b`);
  if (!prefix.test(text)) return null;
  const rest = text.replace(prefix, "").trim();
  if (!has(rest, FEE_WORDS)) return null;
  return classifyFee(rest);
}

/** Both subtotals for one card over one calendar year, reversals netted.
 *  Credits already carry a negative sign (the extraction schema encodes the
 *  sign on the number), so netting is plain addition. */
export function summarizeCardFees(rows: FeeLineRow[], year: number): CardFeeTotals {
  const prefix = `${year}-`;
  const totals: CardFeeTotals = { recurring: 0, incidents: 0, counted: 0 };
  for (const r of rows) {
    if (!r.posted_on.startsWith(prefix)) continue;
    const bucket = r.kind === "fee" ? classifyFee(r.description) : reversalTarget(r.description);
    if (bucket === null || bucket === "excluded") continue;
    totals[bucket] += r.amount;
    totals.counted += 1;
  }
  return totals;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- card-fees`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/accounts/card-fees.ts lib/accounts/card-fees.test.ts
git commit -m "feat(accounts): classify statement fee lines by what they are

Recurring ownership charges, one-off incident fees, and interest — which
is excluded by construction. The extraction prompt buckets interes with
cargo and seguro, so a naive sum over kind='fee' would fold a finance
charge into the cost of owning the card and double-count against Cost of
carry.

Recurring is the default because incident vocabulary is enumerable and
ownership charges are unbounded product names: AHORRO MUJER WHITE is a
bundled insurance product the model tagged a fee on statement context
alone.

Reversals net against the bucket they reverse, guarded by a fee-word test
so an ordinary purchase refund never reaches a card about fees."
```

---

### Task 2: Insights roll-up query

**Files:**
- Modify: `lib/insights/queries.ts` (append after `sumCashbackByCurrency`, ~line 530)
- Test: `lib/insights/queries.test.ts` (append)

**Interfaces:**
- Consumes: `summarizeCardFees`, `type FeeLineRow` from Task 1.
- Produces:
  - `type CardFeeLine = { accountId: string; name: string; currency: string; recurring: number; incidents: number }`
  - `type CardFees = { year: number; baseCurrency: string; lines: CardFeeLine[]; recurringBase: number; incidentsBase: number }`
  - `buildCardFeeLines(rowsByAccount, accounts, groupName, year): CardFeeLine[]`
  - `getCardFees(): Promise<CardFees>`

- [ ] **Step 1: Write the failing test**

In `lib/insights/queries.test.ts`, add these two lines to the **import block at
the top of the file** (merge `buildCardFeeLines` into the existing `./queries`
import if one is already there):

```ts
import { buildCardFeeLines } from "./queries";
import type { FeeLineRow } from "@/lib/accounts/card-fees";
```

Then append this `describe` block at the **end** of the file:

```ts
describe("buildCardFeeLines", () => {
  const accounts = [
    { id: "a1", name: "Visa Infinite", currency: "DOP", card_group_id: null },
    { id: "a2", name: "USD", currency: "USD", card_group_id: "g1" },
    { id: "a3", name: "Clean Card", currency: "DOP", card_group_id: null },
  ];
  const groupName = new Map([["g1", "Platinum"]]);

  const rows = new Map<string, FeeLineRow[]>([
    ["a1", [
      { description: "CARGO SEGURO FRAUDE", amount: 350, kind: "fee", posted_on: "2026-06-26" },
      { description: "CARGO SOBREGIRO", amount: 500, kind: "fee", posted_on: "2026-06-25" },
    ]],
    ["a2", [
      { description: "ANNUAL FEE", amount: 99, kind: "fee", posted_on: "2026-03-01" },
    ]],
  ]);

  it("builds one line per card that was charged something", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines).toEqual([
      { accountId: "a1", name: "Visa Infinite", currency: "DOP", recurring: 350, incidents: 500 },
      { accountId: "a2", name: "Platinum — USD", currency: "USD", recurring: 99, incidents: 0 },
    ]);
  });

  // Silence, not zeros: a3 has no fee rows and must not appear at all.
  it("omits a card with no fee lines rather than showing it at zero", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines.map((l) => l.accountId)).not.toContain("a3");
  });

  it("sorts by recurring cost, heaviest first", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines.map((l) => l.recurring)).toEqual([350, 99]);
  });

  it("is empty for a year with no charges", () => {
    expect(buildCardFeeLines(rows, accounts, groupName, 2025)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- insights/queries`
Expected: FAIL — `buildCardFeeLines is not a function` / no matching export.

- [ ] **Step 3: Write the implementation**

Append to `lib/insights/queries.ts`. The file already imports `convertToBase` and `getExchangeRates` from `@/lib/fx` and `createClient` from `@/lib/supabase/server` — add only the Task 1 import at the top:

```ts
import { summarizeCardFees, type FeeLineRow } from "@/lib/accounts/card-fees";
```

Then append:

```ts
export type CardFeeLine = {
  accountId: string;
  name: string;
  currency: string;
  recurring: number; // native (card currency)
  incidents: number; // native
};

export type CardFees = {
  year: number;
  baseCurrency: string;
  lines: CardFeeLine[];
  recurringBase: number;
  incidentsBase: number;
};

/** The grouping and omission rules, split out from the fetch so they can be
 *  tested without a database. Cards with no counted rows are dropped entirely
 *  rather than rendered at zero — see CardFeeTotals.counted. */
export function buildCardFeeLines(
  rowsByAccount: Map<string, FeeLineRow[]>,
  accounts: { id: string; name: string; currency: string; card_group_id: string | null }[],
  groupName: Map<string, string>,
  year: number,
): CardFeeLine[] {
  const lines: CardFeeLine[] = [];
  for (const a of accounts) {
    const totals = summarizeCardFees(rowsByAccount.get(a.id) ?? [], year);
    if (totals.counted === 0) continue;
    lines.push({
      accountId: a.id,
      // Same label shape as the cost-of-carry and cashback cards, so a card
      // group's two currency lines are told apart the same way on all three.
      name:
        a.card_group_id && groupName.has(a.card_group_id)
          ? `${groupName.get(a.card_group_id)} — ${a.name}`
          : a.name,
      currency: a.currency,
      recurring: totals.recurring,
      incidents: totals.incidents,
    });
  }
  return lines.sort((x, y) => y.recurring - x.recurring);
}

/**
 * What every card charged you to hold it this calendar year.
 *
 * `kind` is queried as ('fee','credit') rather than 'fee' alone, and the credits
 * are there for ONE reason: issuers post a fee reversal as a credit, not as a
 * negative fee. Almost every credit row is cashback or a merchant refund and is
 * discarded by the guard in reversalTarget. The subtotals are still built from
 * fee rows; the credits only ever subtract.
 *
 * Totals convert to base currency, unlike the cashback card which deliberately
 * prints none. The difference is justified: a rebate is credited in the line's
 * own currency and summing those through today's rate would invent a figure no
 * statement printed, whereas "what do my cards cost me a year" is a question
 * whose answer is a single number. Cost of carry and loan interest convert for
 * the same reason.
 */
export async function getCardFees(): Promise<CardFees> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: profile }, { data: rows }, { data: accounts }, { data: groups }] =
    await Promise.all([
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase
        .from("card_statement_lines")
        .select("account_id,description,amount,kind,posted_on")
        .in("kind", ["fee", "credit"])
        .gte("posted_on", `${year}-01-01`)
        .lte("posted_on", `${year}-12-31`),
      supabase.from("accounts").select("id,name,currency,card_group_id").eq("type", "credit_card"),
      supabase.from("card_groups").select("id,name"),
    ]);

  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));

  const rowsByAccount = new Map<string, FeeLineRow[]>();
  for (const r of rows ?? []) {
    if (!r.account_id) continue;
    const list = rowsByAccount.get(r.account_id) ?? [];
    list.push({
      description: r.description ?? "",
      amount: Number(r.amount ?? 0),
      kind: r.kind as "fee" | "credit",
      posted_on: r.posted_on ?? "",
    });
    rowsByAccount.set(r.account_id, list);
  }

  const lines = buildCardFeeLines(rowsByAccount, accounts ?? [], groupName, year);

  return {
    year,
    baseCurrency,
    lines,
    recurringBase: lines.reduce(
      (s, l) => s + convertToBase(l.recurring, l.currency, baseCurrency, rates),
      0,
    ),
    incidentsBase: lines.reduce(
      (s, l) => s + convertToBase(l.incidents, l.currency, baseCurrency, rates),
      0,
    ),
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- insights/queries`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/insights/queries.ts lib/insights/queries.test.ts
git commit -m "feat(insights): add getCardFees query

Credits are in the query for one reason: issuers post a fee reversal as a
credit rather than a negative fee. Nearly every credit row is cashback or
a merchant refund and gets discarded by the reversal guard — the
subtotals are built from fee rows, and credits only ever subtract.

Totals convert to base, unlike cashback. A rebate is paid in its line's
own currency so summing those would invent a figure no statement
printed, but what the cards cost in a year is a question whose answer is
one number."
```

---

### Task 3: The Insights card

**Files:**
- Modify: `app/(app)/insights/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `getCardFees`, `type CardFees` from Task 2.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the copy**

In `messages/en.json`, inside the `Insights` object, next to the existing `cashback*` keys:

```json
"cardFeesTitle": "Cost of ownership in {year}",
"cardFeesRecurring": "Fees & insurance ({currency})",
"cardFeesIncidents": "Penalty fees ({currency})",
"cardFeesIncidentsRow": "{amount} in penalties",
"cardFeesEmpty": "Import a card statement to see what your cards charge you to hold them."
```

In `messages/es.json`, inside `Insights`:

```json
"cardFeesTitle": "Costo de tenencia en {year}",
"cardFeesRecurring": "Cargos y seguros ({currency})",
"cardFeesIncidents": "Cargos por penalidad ({currency})",
"cardFeesIncidentsRow": "{amount} en penalidades",
"cardFeesEmpty": "Importa un estado de cuenta para ver lo que te cobran tus tarjetas por tenerlas."
```

- [ ] **Step 2: Wire the query into the page**

In `app/(app)/insights/page.tsx`, add `ShieldAlert` to the `lucide-react` import, add `getCardFees` to the `@/lib/insights/queries` import, then extend the destructuring and `Promise.all` at line 138:

```tsx
  const [
    insights, carry, cardPayments, netWorth, goals, cashback, transferCosts, loanInterest, cardFees,
  ] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getCardPayments(month),
    getNetWorthHistory(),
    getGoalsOverview(),
    getCashbackByCard(),
    getTransferCosts(),
    getLoanInterest(),
    getCardFees(),
  ]);
```

- [ ] **Step 3: Render the card**

In the `sectionDebt` `<Section>`, immediately **after** the closing `</ChartCard>` of the Cashback card (currently line 449):

```tsx
          {/* The third column of the card ledger, and deliberately never netted
              against the second. Lounge access, travel insurance and purchase
              protection never reach a statement, so a cost-minus-benefit figure
              would be built from the costs the app can see and a blank where the
              benefits are — authoritative-looking and wrong in one direction.
              Cost and return sit side by side; the reader nets them against the
              benefits they know about and the app does not.

              Rows carry the recurring figure, because that is the cost of
              OWNING the card — a standing charge you decide about. Incidents
              are things that happened and ride along in the subtitle, so a card
              whose only charge was an overdraft still shows why it is listed.

              "Charged in {year}", never an annualized run rate: statement
              history is months old, and the charges are irregular enough that
              any per-month figure times twelve would be fiction. Same honesty
              as the loan interest card's "Recorded in". */}
          <ChartCard title={t("cardFeesTitle", { year: String(cardFees.year) })} icon={ShieldAlert}>
            {cardFees.lines.length > 0 ? (
              <Tally
                rows={cardFees.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.currency}
                        {l.incidents !== 0
                          ? ` · ${t("cardFeesIncidentsRow", { amount: formatMoney(l.incidents, l.currency) })}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.recurring, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground">
                        {t("cardFeesRecurring", { currency: cardFees.baseCurrency })}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {formatMoney(cardFees.recurringBase, cardFees.baseCurrency)}
                      </span>
                    </div>
                    {cardFees.incidentsBase !== 0 ? (
                      <div className="flex items-baseline justify-between text-muted-foreground">
                        <span>{t("cardFeesIncidents", { currency: cardFees.baseCurrency })}</span>
                        <span className="tabular-nums">
                          {formatMoney(cardFees.incidentsBase, cardFees.baseCurrency)}
                        </span>
                      </div>
                    ) : null}
                  </>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cardFeesEmpty")}</p>
            )}
          </ChartCard>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run lint` — expected: clean.

Then ask the user before starting the dev server (they want to be asked), and check `/insights`: the Debt section should show a Cost of ownership card listing one card at DOP 1,650.00 recurring with `· DOP 500.00 in penalties` in its subtitle.

**Note the known layout wrinkle:** this makes five cards in a two-column grid, leaving an orphan in the last row. Report it; do not silently restructure the section.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/insights/page.tsx messages/en.json messages/es.json
git commit -m "feat(insights): show the cost of ownership card

The third column of the card ledger, never netted against the second.
Lounge access, travel insurance and purchase protection never reach a
statement, so a cost-minus-benefit figure would be built from the costs
the app can see and a blank where the benefits are — wrong in one
consistent direction.

Rows carry the recurring figure because that is the standing charge you
decide about; incidents ride along in the subtitle so a card whose only
charge was an overdraft still shows why it is listed."
```

---

### Task 4: The account detail lines

**Files:**
- Modify: `lib/accounts/queries.ts` (after `getCardStatements`, line 118)
- Modify: `app/(app)/accounts/[id]/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `summarizeCardFees`, `type FeeLineRow` from Task 1.
- Produces: `getAccountFeeLines(accountId: string, year: number): Promise<FeeLineRow[]>`

- [ ] **Step 1: Add the fetch helper**

In `lib/accounts/queries.ts`, add the import at the top:

```ts
import type { FeeLineRow } from "./card-fees";
```

and after `getCardStatements` (line 118):

```ts
/**
 * One card's fee lines for one calendar year, ready for summarizeCardFees.
 *
 * A separate fetch from getCardFees rather than a filter over it: this one is
 * scoped to a single account and needs no FX at all, since the detail page
 * speaks that card's own currency throughout. The classification both share
 * lives in card-fees.ts, which is the part worth keeping DRY.
 *
 * Credits come along only to catch reversals — see reversalTarget.
 */
export async function getAccountFeeLines(
  accountId: string,
  year: number,
): Promise<FeeLineRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statement_lines")
    .select("description,amount,kind,posted_on")
    .eq("account_id", accountId)
    .in("kind", ["fee", "credit"])
    .gte("posted_on", `${year}-01-01`)
    .lte("posted_on", `${year}-12-31`);
  return (data ?? []).map((r) => ({
    description: r.description ?? "",
    amount: Number(r.amount ?? 0),
    kind: r.kind as "fee" | "credit",
    posted_on: r.posted_on ?? "",
  }));
}
```

- [ ] **Step 2: Add the copy**

In `messages/en.json`, inside `AccountDetail`, next to `cashbackThisYear`:

```json
"costOfOwnershipThisYear": "<amount></amount> in fees and insurance charged in {year}.",
"incidentFeesThisYear": "<amount></amount> in penalty fees charged in {year}."
```

In `messages/es.json`, inside `AccountDetail`:

```json
"costOfOwnershipThisYear": "<amount></amount> en cargos y seguros cobrados en {year}.",
"incidentFeesThisYear": "<amount></amount> en cargos por penalidad cobrados en {year}."
```

- [ ] **Step 3: Fetch on the page**

In `app/(app)/accounts/[id]/page.tsx`, add to the `@/lib/accounts/queries` import: `getAccountFeeLines`; and add `import { summarizeCardFees } from "@/lib/accounts/card-fees";`.

After the `spendSlices` block (line 141), add:

```tsx
  /* What this card charges you to hold it, this calendar year. A second round
   * trip for the same reason getCardSpendByCategory is one: the fee lines live
   * in card_statement_lines, which this page does not otherwise load, and the
   * query is only worth issuing once `type` says this account is a card.
   *
   * Costs only — never netted against the cashback line above it. Most of a
   * card's benefits never appear on a statement, so a net figure would be
   * built from the costs the app can see and a blank where the benefits are. */
  const feeYear = new Date().getFullYear();
  const cardFees = isCardType
    ? summarizeCardFees(await getAccountFeeLines(id, feeYear), feeYear)
    : { recurring: 0, incidents: 0, counted: 0 };
```

- [ ] **Step 4: Render the lines**

Immediately after the cashback `<p>` block's closing `) : null}` (currently line 319):

```tsx
                {/* Standing facts about the card, in the same register as the
                    cashback line above: one number each, sitting with the
                    card's other facts rather than in a card of their own.

                    Each line appears only when its own subtotal is non-zero. A
                    card with no fee lines shows neither — silence rather than a
                    confident "RD$0.00 in fees", which would be a claim drawn
                    from the absence of data rather than from data. */}
                {cardFees.recurring !== 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.rich("costOfOwnershipThisYear", {
                      year: String(feeYear),
                      amount: () => (
                        <span className="figure font-medium text-foreground">
                          {formatMoney(cardFees.recurring, currency)}
                        </span>
                      ),
                    })}
                  </p>
                ) : null}
                {cardFees.incidents !== 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t.rich("incidentFeesThisYear", {
                      year: String(feeYear),
                      amount: () => (
                        <span className="figure font-medium text-foreground">
                          {formatMoney(cardFees.incidents, currency)}
                        </span>
                      ),
                    })}
                  </p>
                ) : null}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run lint` — expected: clean.

With the dev server (ask first), open the card that has the fee lines: it should read "**DOP 1,650.00** in fees and insurance charged in 2026." and "**DOP 500.00** in penalty fees charged in 2026." A card with no fee lines shows neither line.

- [ ] **Step 6: Commit**

```bash
git add lib/accounts/queries.ts app/\(app\)/accounts/\[id\]/page.tsx messages/en.json messages/es.json
git commit -m "feat(accounts): show what a card costs to hold on its detail page

The screen where you decide whether to keep a card, so it is where the
figure pays off. Standing facts in the same register as the cashback line
above them, and never netted against it.

Each line renders only when its own subtotal is non-zero: a card with no
fee lines shows neither, because a confident RD\$0.00 would be a claim
drawn from the absence of data rather than from data."
```

---

### Task 5: Help guide

**Files:**
- Modify: `app/(app)/help/page.tsx` (lines ~196 and ~324)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

`components/help/mocks.tsx` is **not** modified. `InsightsMock` draws only the spend donut and its legend — it has never depicted Cost of carry, Cashback or Loan interest, so adding this card alone would be inconsistent rather than thorough.

- [ ] **Step 1: Add the copy**

In `messages/en.json`, inside `Help`:

```json
"accountPageCostOfOwnership": "What the card charges you to hold it — fees and insurance billed this year, read off your imported statements",
"insightsCostOfOwnership": "Cost of ownership — annual fees, insurance and membership charges each card billed this year, never subtracted from its benefits",
"insightsLoanInterest": "Loan interest — how much of each loan payment went to interest rather than to principal"
```

In `messages/es.json`, inside `Help`:

```json
"accountPageCostOfOwnership": "Lo que la tarjeta te cobra por tenerla — cargos y seguros facturados este año, leídos de tus estados de cuenta importados",
"insightsCostOfOwnership": "Costo de tenencia — cuotas anuales, seguros y cargos de membresía que cada tarjeta facturó este año, nunca restados de sus beneficios",
"insightsLoanInterest": "Intereses de préstamos — cuánto de cada pago de préstamo se fue a intereses en vez de capital"
```

- [ ] **Step 2: Add the account-page bullet**

In `app/(app)/help/page.tsx`, after `<li>{t("accountPageCashback")}</li>` (line 196):

```tsx
                <li>{t("accountPageCostOfOwnership")}</li>
```

- [ ] **Step 3: Add the insights bullets**

After `<li>{t("insightsCashback")}</li>` (line 324):

```tsx
              <li>{t("insightsCostOfOwnership")}</li>
              <li>{t("insightsLoanInterest")}</li>
```

`insightsLoanInterest` closes a pre-existing gap: the Loan interest card shipped in `462d444` without a guide entry, and this is the exact list that omission lives in.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected: no errors.
Run: `npm run lint` — expected: clean.

Confirm both locales parse:

```bash
node -e "['en','es'].forEach(l=>{const d=require('./messages/'+l+'.json');['accountPageCostOfOwnership','insightsCostOfOwnership','insightsLoanInterest'].forEach(k=>{if(!d.Help[k])throw new Error(l+' missing Help.'+k)});console.log(l,'ok')})"
```

Expected: `en ok` / `es ok`.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/help/page.tsx messages/en.json messages/es.json
git commit -m "docs(help): cover cost of ownership, and loan interest

Also adds the insights entry for the loan interest card, which shipped in
462d444 without one — the omission lives in the exact list this change
already edits."
```

---

### Task 6: Full verification

**Files:** none modified.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass. Report the actual tail of the output — do not claim a pass without it.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Report**

Summarize for the user:
- the actual figures the two surfaces render for the card that has fee lines
- the Debt section's five-card grid orphan, unresolved by design
- that no annual fee appears yet, because statement history begins April 2026 and a once-a-year charge has not landed inside that window

Do not merge or push. Branch handling is the user's call.
