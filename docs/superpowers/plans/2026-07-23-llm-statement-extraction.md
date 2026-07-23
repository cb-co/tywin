# LLM-Based Statement Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the regex bank-specific statement parsers with a single Groq LLM call that extracts the same structured data regardless of how a bank labels its fields, while keeping the deterministic pipeline in the tree (unplugged, not deleted).

**Architecture:** `extractStatementText` (pdfjs) stays unchanged. New: a deterministic PII-scrub pass runs on the extracted text before anything leaves the server, then `extractWithLLM` calls Groq via the AI SDK's `generateObject` against a zod schema, then `toParsedStatement` converts that (money-as-strings) shape into the existing `ParsedStatement` (money-as-cents) shape using the same `parseMoneyCents`/`monthBeforePlusDay` utilities the old parsers used. Everything downstream (`validateChecksums`, mapping, DB writes) is untouched.

**Tech Stack:** Next.js server actions, `ai` + `@ai-sdk/groq` (AI SDK v6, `generateObject`), zod, vitest.

## Global Constraints

- Real bank statements and their extracted text are never committed; `.gitignore` already covers `*.pdf` and `extracted-statement.txt`.
- `scrubPii` runs on every request before the Groq call, unconditionally — not feature-flagged.
- Money is a string until `parseMoneyCents` touches it — the model never emits or is asked to compute cents.
- Tests: vitest, colocated `*.test.ts` next to the lib file. Run with `npx vitest run <path>`.
- Tests use only synthetic fixture text, never real statement text (same convention as `POPULAR_FIXTURE`/`SCOTIA_FIXTURE`).
- `sectionKey` must be `<CURRENCY>` for a revolving section or `<CURRENCY>_CUOTAS` for a line-less installments section — the LLM is told this explicitly so re-imports of the same card keep reusing saved `statement_section_mappings`.
- The old regex parsers (`lib/statements/parsers/{popular-visa,scotia-amex}.ts`, `lib/statements/registry.ts`) stay in the tree and keep compiling and passing their existing tests — they're unplugged from `statement-actions.ts`, not deleted.

---

### Task 1: Extend `ParsedLine` with `suggestedCategory`

The LLM's per-line category guess (§6 of the design spec) needs a place to live on the shared `ParsedLine` type so it can flow from `toParsedStatement` through to `resolveCategoryId` in a later task. The two existing regex parsers construct `ParsedLine` objects too and must keep compiling.

**Files:**
- Modify: `lib/statements/types.ts`
- Modify: `lib/statements/parsers/popular-visa.ts:62-75`
- Modify: `lib/statements/parsers/scotia-amex.ts:87-97`

**Interfaces:**
- Produces: `ParsedLine.suggestedCategory: string | null` — consumed by Task 5 (`extract.ts`) and Task 6 (`categorize.ts`)

- [ ] **Step 1: Add the field to `ParsedLine`**

In `lib/statements/types.ts`, add `suggestedCategory` right after `kind`:

```ts
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
  suggestedCategory: string | null; // LLM's best-guess category name, non-authoritative
}
```

- [ ] **Step 2: Run the type checker to see it fail**

Run: `npx tsc --noEmit`
Expected: two errors, both "Property 'suggestedCategory' is missing" — one in `popular-visa.ts`, one in `scotia-amex.ts`.

- [ ] **Step 3: Fix the two regex parsers**

In `lib/statements/parsers/popular-visa.ts`, the `parsedLines.push({...})` call (around line 62) ends with:

```ts
        kind:
          amountCents < 0
            ? /^pago/i.test(description) ? "payment" : "credit"
            : /^CARGO/.test(description) ? "fee" : "purchase",
      });
```

Change it to:

```ts
        kind:
          amountCents < 0
            ? /^pago/i.test(description) ? "payment" : "credit"
            : /^CARGO/.test(description) ? "fee" : "purchase",
        suggestedCategory: null,
      });
```

In `lib/statements/parsers/scotia-amex.ts`, the `current.lines.push({...})` call (around line 87) ends with:

```ts
          amountCents,
          kind: lineKind(description, amountCents),
        });
```

Change it to:

```ts
          amountCents,
          kind: lineKind(description, amountCents),
          suggestedCategory: null,
        });
```

- [ ] **Step 4: Verify the type checker and existing tests pass**

Run: `npx tsc --noEmit && npx vitest run lib/statements`
Expected: no errors, all existing tests pass (this task changes no behavior, only adds a field).

- [ ] **Step 5: Commit**

```bash
git add lib/statements/types.ts lib/statements/parsers/popular-visa.ts lib/statements/parsers/scotia-amex.ts
git commit -m "feat(statements): add suggestedCategory to ParsedLine"
```

---

### Task 2: PII scrubber

**Files:**
- Create: `lib/statements/llm/scrub-pii.ts`
- Test: `lib/statements/llm/scrub-pii.test.ts`

**Interfaces:**
- Produces: `scrubPii(text: string): string` — consumed by Task 7 (`statement-actions.ts`)

- [ ] **Step 1: Write the failing test**

`lib/statements/llm/scrub-pii.test.ts` — synthetic fixture only, modeled on the shapes found in real statements during design (see the design spec §3) but with an invented name/email/phone, never real data:

```ts
import { describe, expect, it } from "vitest";
import { scrubPii } from "./scrub-pii";

const FIXTURE = `
Estado de cuenta de:
Fecha de Corte: 15-07-2026
JANE JANE SAMPLE DOE
Fecha límite de pago: 10-08-2026
 ****-****-****-1234        10,000.00      8,574.50        25/06/2026     20/07/2026       1,000.00
  25/06      25/06   74763946147620851045422       MERCADO UNO  CIUDAD FALSA                  500.00
                                                               5411   045602
- 1234 - 000000012473453 - 15-07-2026
JANE JANE SAMPLE DOE
jane.sample@example.com
Tel: 8091234567
Estamos a tu servicio en la Línea Platinum 809-227-3182 y 1-809-200-3182
JANE JANE SAMPLE DOE OBTENIDOS ACUMULADOS
No. de Tarjeta: ****1234
JANE JANE SAMPLE DOE
jane.sample@example.com
`;

describe("scrubPii", () => {
  const out = scrubPii(FIXTURE);

  it("redacts every email occurrence", () => {
    expect(out).not.toContain("jane.sample@example.com");
    expect(out.match(/\[EMAIL\]/g)?.length).toBe(2);
  });

  it("redacts labeled and dash-grouped phone numbers, but never a dash-grouped date", () => {
    expect(out).not.toContain("8091234567");
    expect(out).not.toContain("809-227-3182");
    expect(out).not.toContain("1-809-200-3182");
    expect(out).toContain("Fecha de Corte: 15-07-2026");
    expect(out).toContain("Fecha límite de pago: 10-08-2026");
  });

  it("redacts the name everywhere, including the header-glued variant", () => {
    expect(out).not.toContain("JANE JANE SAMPLE DOE");
  });

  it("redacts the hidden doc-id artifact line", () => {
    expect(out).not.toContain("000000012473453");
  });

  it("leaves transaction data, references, MCCs, and balance figures untouched", () => {
    expect(out).toContain("74763946147620851045422");
    expect(out).toContain("MERCADO UNO");
    expect(out).toContain("500.00");
    expect(out).toContain("5411   045602");
    expect(out).toContain("10,000.00");
    expect(out).toContain("8,574.50");
    expect(out).toContain("****-****-****-1234");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/statements/llm/scrub-pii.test.ts`
Expected: FAIL — `Cannot find module './scrub-pii'`

- [ ] **Step 3: Implement the scrubber**

`lib/statements/llm/scrub-pii.ts`:

```ts
/**
 * Deterministic, regex-based PII redaction for statement text before it's sent to a
 * third-party LLM. No LLM involved in the scrubbing itself — a pattern-based pass can't
 * be talked out of redacting something the way a model theoretically could, and it's
 * free and instant. Validated against two real statements during design (see
 * docs/superpowers/specs/2026-07-23-llm-statement-extraction-design.md §3): this is a
 * heuristic, not a guarantee. Collateral stripping of non-sensitive boilerplate is
 * expected and fine — none of it is needed for extraction.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// An explicit Tel/Teléfono/Cel/Fax label followed by a digit run, OR a dash/dot/space/
// paren-grouped number shaped like 3+3+4 digits (809-227-3182, (809) 567-7268,
// 1-809-200-3182). The 3-digit middle group is deliberate: DR dates are DD-MM-YYYY
// (2+2+4 digits), so this never collides with a date — an earlier 2-4-digit version did,
// and silently ate "Fecha de Corte: 15-07-2026" during design testing.
const PHONE_RE =
  /\b(?:Tel(?:[eé]fono)?|Cel(?:ular)?|Fax|Phone)\.?:?\s*\+?[\d()][\d()\-.\s]{5,}\d\b|\+?\d{0,3}[-.\s]?\(?\d{3}\)?[-.\s]\d{3}[-.\s]?\d{4}\b/gi;

// A hidden barcode/reference layer some bank PDFs still expose as text, e.g.
// "- 6760 - 000000012473453 - 15-07-2026". Scoped to the whole-line shape so it never
// touches a transaction row's reference-number column (those always share a row with a
// description and an amount).
const ID_LINE_RE = /^\s*-\s*\S{1,8}\s*-\s*\d{8,}\s*-\s*\d{2}[-/]\d{2}[-/]\d{4}\s*-?\s*$/;

const NAME_LABEL_RE = /estado de cuenta de\s*:|titular\s*:|nombre del cliente|a nombre de\s*:|cliente\s*:/i;

function isShortNoDigitLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  if (/\d/.test(t)) return false;
  if (/https?:|www\./i.test(t)) return false;
  return true;
}

export function scrubPii(text: string): string {
  const lines = text.split("\n");
  const out = lines.slice();

  const emailLineIdx: number[] = [];
  lines.forEach((l, i) => {
    if (EMAIL_RE.test(l)) emailLineIdx.push(i);
    EMAIL_RE.lastIndex = 0;
  });
  for (let i = 0; i < out.length; i++) out[i] = out[i].replace(EMAIL_RE, "[EMAIL]");

  for (let i = 0; i < out.length; i++) out[i] = out[i].replace(PHONE_RE, "[PHONE]");

  for (let i = 0; i < lines.length; i++) if (ID_LINE_RE.test(lines[i])) out[i] = "[ID]";

  // Name candidates near an email — cardholder identity blocks cluster within a handful
  // of lines of the email in every layout seen so far, in either direction.
  const WINDOW_BEFORE = 6;
  const WINDOW_AFTER = 2;
  for (const idx of emailLineIdx) {
    for (let d = 1; d <= WINDOW_BEFORE; d++) {
      const i = idx - d;
      if (i >= 0 && isShortNoDigitLine(lines[i])) out[i] = "[NAME]";
    }
    for (let d = 1; d <= WINDOW_AFTER; d++) {
      const i = idx + d;
      if (i < lines.length && isShortNoDigitLine(lines[i])) out[i] = "[NAME]";
    }
  }

  // Name-introducing labels: scan a few lines after for the first digit-free line.
  for (let i = 0; i < lines.length; i++) {
    if (NAME_LABEL_RE.test(lines[i])) {
      for (let d = 1; d <= 4; d++) {
        const j = i + d;
        if (j < lines.length && isShortNoDigitLine(lines[j])) {
          out[j] = "[NAME]";
          break;
        }
      }
    }
  }

  // Repetition safety net: a short, multi-word, digit-free line recurring 3+ times
  // verbatim is almost always a repeating identity/contact field or boilerplate label —
  // real transaction/merchant text never appears as a bare line with no date or amount,
  // let alone three times identically. Catches occurrences too far from any email match
  // for the window above.
  const freq = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (!isShortNoDigitLine(l)) continue;
    if (t.split(/\s+/).length < 2) continue; // single-word headers (MONEDA, CUOTAS) stay
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const recurring = [...freq.entries()].filter(([, n]) => n >= 3).map(([t]) => t);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if ((freq.get(t) ?? 0) >= 3) out[i] = "[NAME]";
  }

  // Fuzzy net: a line that merely starts with one of the recurring strings above is
  // almost certainly that same field glued to unrelated header text by a column-merge
  // artifact on one occurrence — the clean occurrences already fed the exact-match set.
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (out[i] !== lines[i]) continue; // already redacted
    if (!t || /\d/.test(t)) continue;
    if (recurring.some((r) => r.length >= 8 && t.startsWith(r))) out[i] = "[NAME]";
  }

  return out.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/statements/llm/scrub-pii.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/llm/scrub-pii.ts lib/statements/llm/scrub-pii.test.ts
git commit -m "feat(statements): add PII-scrubbing pass for LLM extraction"
```

---

### Task 3: LLM output schema

**Files:**
- Create: `lib/statements/llm/schema.ts`
- Test: `lib/statements/llm/schema.test.ts`

**Interfaces:**
- Consumes: `zod` (already a dependency)
- Produces: `StatementSchema` (zod schema), `LlmLine`, `LlmSection`, `LlmStatement` (inferred types) — consumed by Task 4 (`system-prompt.ts` references the shape informally) and Task 5 (`extract.ts`)

- [ ] **Step 1: Write the failing test**

`lib/statements/llm/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { StatementSchema } from "./schema";

const VALID = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: "1,000.00",
      closingBalance: "1,425.50",
      balanceToPay: "1,425.50",
      minimumPayment: "142.55",
      overdueAmount: "0.00",
      overdueInstallments: 0,
      creditLimit: "10,000.00",
      availableCredit: "8,574.50",
      interestRateAnnual: 40,
      avgDailyBalance: "1,200.00",
      avgDailyBalancePrior: "0.00",
      costOfCarry: "40.00",
      costOfCarryPrior: "0.00",
      totalDebits: null,
      totalCredits: null,
      lines: [
        {
          madeOn: "2026-05-28",
          postedOn: "2026-05-26",
          reference: "74763946147620851045422",
          description: "MERCADO UNO CIUDAD FALSA",
          mcc: "5411",
          authCode: "045602",
          amount: "500.00",
          kind: "purchase",
          suggestedCategory: "Groceries",
        },
      ],
    },
  ],
};

describe("StatementSchema", () => {
  it("accepts a well-formed statement", () => {
    expect(() => StatementSchema.parse(VALID)).not.toThrow();
  });

  it("rejects an invalid line kind", () => {
    const bad = { ...VALID, sections: [{ ...VALID.sections[0], lines: [{ ...VALID.sections[0].lines[0], kind: "refund" }] }] };
    expect(() => StatementSchema.parse(bad)).toThrow();
  });

  it("rejects a missing required field", () => {
    const { closingBalance, ...rest } = VALID.sections[0];
    const bad = { ...VALID, sections: [rest] };
    expect(() => StatementSchema.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/statements/llm/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: Implement the schema**

`lib/statements/llm/schema.ts`:

```ts
import { z } from "zod";

export const LineSchema = z.object({
  madeOn: z.string(),
  postedOn: z.string(),
  reference: z.string().nullable(),
  description: z.string(),
  mcc: z.string().nullable(),
  authCode: z.string().nullable(),
  amount: z.string(),
  kind: z.enum(["purchase", "fee", "credit", "payment"]),
  suggestedCategory: z.string().nullable(),
});

export const SectionSchema = z.object({
  sectionKey: z.string(),
  currency: z.string(),
  periodEnd: z.string(),
  dueDate: z.string().nullable(),
  previousBalance: z.string(),
  closingBalance: z.string(),
  balanceToPay: z.string().nullable(),
  minimumPayment: z.string().nullable(),
  overdueAmount: z.string().nullable(),
  overdueInstallments: z.number().nullable(),
  creditLimit: z.string().nullable(),
  availableCredit: z.string().nullable(),
  interestRateAnnual: z.number().nullable(),
  avgDailyBalance: z.string().nullable(),
  avgDailyBalancePrior: z.string().nullable(),
  costOfCarry: z.string().nullable(),
  costOfCarryPrior: z.string().nullable(),
  totalDebits: z.string().nullable(),
  totalCredits: z.string().nullable(),
  lines: z.array(LineSchema),
});

export const StatementSchema = z.object({
  cardNetwork: z.enum(["visa", "mastercard", "amex", "discover", "other"]),
  cardLast4: z.string().nullable(),
  sections: z.array(SectionSchema),
});

export type LlmLine = z.infer<typeof LineSchema>;
export type LlmSection = z.infer<typeof SectionSchema>;
export type LlmStatement = z.infer<typeof StatementSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/statements/llm/schema.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/llm/schema.ts lib/statements/llm/schema.test.ts
git commit -m "feat(statements): add zod schema for LLM statement extraction"
```

---

### Task 4: System prompt

**Files:**
- Create: `lib/statements/llm/system-prompt.ts`
- Test: `lib/statements/llm/system-prompt.test.ts`

**Interfaces:**
- Produces: `SYSTEM_PROMPT: string` — consumed by Task 5 (`extract.ts`)

- [ ] **Step 1: Write the failing test**

`lib/statements/llm/system-prompt.test.ts` — a sanity check, not an LLM call: guards against a future edit accidentally dropping a required instruction.

```ts
import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt";

const CATEGORIES = [
  "Groceries", "Dining", "Transport", "Housing", "Utilities",
  "Health", "Shopping", "Entertainment", "Savings", "Other",
];

describe("SYSTEM_PROMPT", () => {
  it("lists every category name exactly once", () => {
    for (const c of CATEGORIES) expect(SYSTEM_PROMPT).toContain(c);
  });

  it("instructs the model never to reconstruct redacted PII", () => {
    expect(SYSTEM_PROMPT).toMatch(/never fabricate/i);
  });

  it("instructs numeric fidelity — no model-side arithmetic", () => {
    expect(SYSTEM_PROMPT).toMatch(/do not compute, round/i);
  });

  it("pins the sectionKey naming convention", () => {
    expect(SYSTEM_PROMPT).toContain("_CUOTAS");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/statements/llm/system-prompt.test.ts`
Expected: FAIL — `Cannot find module './system-prompt'`

- [ ] **Step 3: Write the prompt**

`lib/statements/llm/system-prompt.ts`:

```ts
export const SYSTEM_PROMPT = `You are a strict data-extraction engine for Latin American / Caribbean credit-card
statements (Spanish or English source text). The input is the raw text layer of a bank
statement PDF, with identifying personal data already redacted as [EMAIL], [PHONE],
[NAME], or [ID] — this is expected and correct. Do not attempt to reconstruct, guess, or
invent any redacted value, and never fabricate a cardholder name, email, phone number, or
full card number even if you believe you can infer one from context. Only the last 4
digits of the card number are ever needed, and they are never redacted.

Extract every credit line ("section") on the statement into the given schema. Banks label
the same field differently — match by MEANING, not exact wording. Aliases seen so far,
use the same reasoning for labels you haven't seen:

  periodEnd (cutoff date):     FECHA DE CORTE, Fecha de Corte
  dueDate:                     FECHA LÍMITE DE PAGO, Fecha límite de pago
  previousBalance:              BALANCE ANTERIOR, BALANCE CORTE ANTERIOR
  closingBalance:                BALANCE TOTAL, BALANCE AL CORTE
  balanceToPay:                  BALANCE A PAGAR
  minimumPayment:                 PAGO MÍNIMO, PAGO MINIMO AL CORTE
  creditLimit:                    LÍNEA DE CRÉDITO, LIMITE DE CREDITO
  availableCredit:                CRÉDITO DISPONIBLE
  overdueAmount / overdueInstallments:  MONTO VENCIDO / CUOTAS VENCIDAS
  interestRateAnnual:              Tasa de Interés Anual
  avgDailyBalance:                  Saldo Promedio Diario de los Consumos del Mes,
                                     Balance Promedio Diario de Capital del Mes
  avgDailyBalancePrior:             Saldo Promedio Diario del Capital Pendiente de
                                     Meses Anteriores, Balance Promedio Diario de
                                     Capital Anterior
  costOfCarry:                      Interés si Opta Por Financiar los Consumos del Mes,
                                     Intereses Nuevos Consumos
  costOfCarryPrior:                 Interés por Financiamiento del Capital Pendiente de
                                     Meses Anteriores, Intereses por Financiamiento del Mes

SECTIONS: emit one section per distinct currency/product block of balances and
transactions (a statement may have one, e.g. a single DOP VISA line, or several, e.g.
DOP + USD + a Cuotas/installments summary). A section with a printed balance summary but
no individual transaction lines (installments-to-be-billed, a promotional purchase plan)
still gets its own section, with an empty lines array. For that case only, fill
totalDebits by summing every positive summary column on that section's row (e.g.
"purchases" + "interest/charges" if the statement prints them separately as one combined
printed-style number, e.g. "37,597.43"), and fill totalCredits with the ABSOLUTE VALUE
(drop the minus sign) of the payments/credits column, e.g. a printed "-8,880.00" becomes
totalCredits "8,880.00". Leave totalDebits and totalCredits null whenever lines is
non-empty — the caller computes them from the lines and ignores these fields in that case.

sectionKey MUST be stable and predictable so the same physical card produces the same key
on every future statement: use the section's ISO currency code alone for an ordinary
revolving section ("DOP", "USD"), and "<CURRENCY>_CUOTAS" for an installments/no-line
summary section in that currency ("DOP_CUOTAS"). Do not invent any other naming scheme.

LINE KIND: classify every transaction line by amount sign and description vocabulary
(Spanish or English) —
  negative amount + payment vocabulary (pago, abono, payment, ACH, SPE) → "payment"
  other negative amount → "credit"
  description starts with a fee/charge word (cargo, fee, comisión, interés, seguro) → "fee"
  everything else → "purchase"

CATEGORIZATION (suggestion only — a downstream rules system has final say, don't worry
about being wrong): for each line, set suggestedCategory to your best guess from exactly
this list, based on the merchant name and MCC if present, or null if genuinely unclear:
  Groceries, Dining, Transport, Housing, Utilities, Health, Shopping, Entertainment,
  Savings, Other

NUMERIC FIDELITY: transcribe every amount EXACTLY as printed — keep the thousands
separator, decimal point, and minus sign as text (e.g. "1,623.00", "-350.00"). Do not
compute, round, convert, or reformat any number yourself, with the single exception of
the totalDebits/totalCredits combination described above for line-less sections.

DATES: normalize every date to ISO yyyy-mm-dd. When the source prints day/month with no
year, infer the year from the statement's period-end (cutoff) date — a month number
greater than the cutoff's month belongs to the previous year.

Return only the structured JSON matching the given schema. Use null for anything not
present on the statement. Never omit a required key.`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/statements/llm/system-prompt.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/statements/llm/system-prompt.ts lib/statements/llm/system-prompt.test.ts
git commit -m "feat(statements): add LLM system prompt for statement extraction"
```

---

### Task 5: Groq call + conversion to `ParsedStatement`

**Files:**
- Create: `lib/statements/llm/extract.ts`
- Test: `lib/statements/llm/extract.test.ts`
- Modify: `package.json` (via `npm install`)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `StatementSchema`/`LlmStatement` (Task 3), `SYSTEM_PROMPT` (Task 4), `parseMoneyCents`/`centsToDecimal` (existing `lib/statements/money.ts`), `monthBeforePlusDay` (existing `lib/statements/dates.ts`), `ParsedStatement`/`ParsedSection`/`ParsedLine` (existing `lib/statements/types.ts`)
- Produces: `extractWithLLM(text: string): Promise<{ ok: true; statement: LlmStatement } | { ok: false; reason: "llm_error" }>`, `toParsedStatement(statement: LlmStatement): ParsedStatement` — both consumed by Task 7 (`statement-actions.ts`)

- [ ] **Step 1: Install dependencies**

Run: `npm install ai @ai-sdk/groq`
Expected: `package.json` and `package-lock.json` gain the two new entries under `dependencies`. `zod` is already present, no change needed there.

- [ ] **Step 2: Add environment variables**

Add to `.env.example`:

```
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

`@ai-sdk/groq`'s `groq()` provider reads `GROQ_API_KEY` from the environment automatically — no explicit key-passing needed in code. `GROQ_MODEL` is read with a fallback so the model can be swapped without a code change.

You'll need a real key in your own `.env.local` (not committed) before Task 8's live verification — get one from Groq's console and set `GROQ_API_KEY=` there yourself.

- [ ] **Step 3: Write the failing test for `toParsedStatement`**

`extractWithLLM` itself is a thin wrapper around a real network call to Groq — it isn't unit-tested here; it's exercised by the dev harness script and REQUIRED manual verification in Task 8, the same way the old pipeline's pdfjs extraction was verified against real files rather than unit-tested. `toParsedStatement` is a pure function and gets full coverage.

`lib/statements/llm/extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toParsedStatement } from "./extract";
import { validateChecksums } from "../validate";
import type { LlmStatement } from "./schema";

const WITH_LINES: LlmStatement = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: "1,000.00",
      closingBalance: "1,375.50",
      balanceToPay: "1,375.50",
      minimumPayment: "137.55",
      overdueAmount: "0.00",
      overdueInstallments: 0,
      creditLimit: "10,000.00",
      availableCredit: "8,574.50",
      interestRateAnnual: 40,
      avgDailyBalance: "1,200.00",
      avgDailyBalancePrior: "0.00",
      costOfCarry: "40.00",
      costOfCarryPrior: "0.00",
      totalDebits: null,
      totalCredits: null,
      lines: [
        {
          madeOn: "2026-05-28", postedOn: "2026-05-26", reference: "REF1",
          description: "MERCADO UNO", mcc: "5411", authCode: "045602",
          amount: "500.00", kind: "purchase", suggestedCategory: "Groceries",
        },
        {
          madeOn: "2026-06-05", postedOn: "2026-06-03", reference: "REF2",
          description: "Pago via SPE", mcc: null, authCode: null,
          amount: "-200.00", kind: "payment", suggestedCategory: null,
        },
        {
          madeOn: "2026-06-10", postedOn: "2026-06-09", reference: "REF3",
          description: "RESTAURANTE TRES", mcc: "5812", authCode: "013148",
          amount: "75.50", kind: "purchase", suggestedCategory: "Dining",
        },
      ],
    },
  ],
};

const LINE_LESS: LlmStatement = {
  cardNetwork: "amex",
  cardLast4: "6760",
  sections: [
    {
      sectionKey: "DOP_CUOTAS",
      currency: "DOP",
      periodEnd: "2026-07-15",
      dueDate: "2026-08-10",
      previousBalance: "0.00",
      closingBalance: "800.00",
      balanceToPay: "800.00",
      minimumPayment: "80.00",
      overdueAmount: null,
      overdueInstallments: null,
      creditLimit: "20,000.00",
      availableCredit: null,
      interestRateAnnual: null,
      avgDailyBalance: "650.00",
      avgDailyBalancePrior: "0.00",
      costOfCarry: null,
      costOfCarryPrior: null,
      totalDebits: "1,300.00",
      totalCredits: "500.00",
      lines: [],
    },
  ],
};

describe("toParsedStatement", () => {
  it("derives a stable parserId from network + last4 + currencies", () => {
    expect(toParsedStatement(WITH_LINES).parserId).toBe("visa_1234_dop");
  });

  it("computes totals from lines when lines is non-empty, ignoring the LLM's totals", () => {
    const parsed = toParsedStatement(WITH_LINES);
    const s = parsed.sections[0];
    expect(s.totalDebitsCents).toBe(57550); // 500.00 + 75.50
    expect(s.totalCreditsCents).toBe(20000); // |-200.00|
  });

  it("assigns lineNo by index and passes suggestedCategory through", () => {
    const lines = toParsedStatement(WITH_LINES).sections[0].lines;
    expect(lines.map((l) => l.lineNo)).toEqual([1, 2, 3]);
    expect(lines[0].suggestedCategory).toBe("Groceries");
    expect(lines[1].suggestedCategory).toBeNull();
  });

  it("computes periodStart from periodEnd", () => {
    expect(toParsedStatement(WITH_LINES).sections[0].periodStart).toBe("2026-05-26");
  });

  it("passes checksums for a statement with lines", () => {
    expect(validateChecksums(toParsedStatement(WITH_LINES))).toEqual([]);
  });

  it("falls back to the LLM's totalDebits/totalCredits for a line-less section", () => {
    const s = toParsedStatement(LINE_LESS).sections[0];
    expect(s.totalDebitsCents).toBe(130000);
    expect(s.totalCreditsCents).toBe(50000);
    expect(s.lines).toEqual([]);
  });

  it("passes checksums for a line-less section", () => {
    expect(validateChecksums(toParsedStatement(LINE_LESS))).toEqual([]);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run lib/statements/llm/extract.test.ts`
Expected: FAIL — `Cannot find module './extract'`

- [ ] **Step 5: Implement `extract.ts`**

`lib/statements/llm/extract.ts`:

```ts
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { StatementSchema, type LlmLine, type LlmSection, type LlmStatement } from "./schema";
import { SYSTEM_PROMPT } from "./system-prompt";
import { parseMoneyCents } from "../money";
import { monthBeforePlusDay } from "../dates";
import type { ParsedLine, ParsedSection, ParsedStatement } from "../types";

export type LlmExtractResult =
  | { ok: true; statement: LlmStatement }
  | { ok: false; reason: "llm_error" };

export async function extractWithLLM(text: string): Promise<LlmExtractResult> {
  try {
    const { object } = await generateObject({
      model: groq(process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"),
      schema: StatementSchema,
      system: SYSTEM_PROMPT,
      prompt: text,
    });
    return { ok: true, statement: object };
  } catch {
    return { ok: false, reason: "llm_error" };
  }
}

function toLine(l: LlmLine, index: number): ParsedLine {
  return {
    lineNo: index + 1,
    madeOn: l.madeOn,
    postedOn: l.postedOn,
    reference: l.reference,
    description: l.description,
    mcc: l.mcc,
    authCode: l.authCode,
    amountCents: parseMoneyCents(l.amount),
    kind: l.kind,
    suggestedCategory: l.suggestedCategory,
  };
}

function toSection(s: LlmSection): ParsedSection {
  const lines = s.lines.map(toLine);
  const totalDebitsCents =
    lines.length > 0
      ? lines.filter((l) => l.amountCents > 0).reduce((sum, l) => sum + l.amountCents, 0)
      : s.totalDebits !== null
        ? parseMoneyCents(s.totalDebits)
        : 0;
  const totalCreditsCents =
    lines.length > 0
      ? lines.filter((l) => l.amountCents < 0).reduce((sum, l) => sum - l.amountCents, 0)
      : s.totalCredits !== null
        ? parseMoneyCents(s.totalCredits)
        : 0;

  return {
    sectionKey: s.sectionKey,
    currency: s.currency,
    periodStart: monthBeforePlusDay(s.periodEnd),
    periodEnd: s.periodEnd,
    dueDate: s.dueDate,
    previousBalanceCents: parseMoneyCents(s.previousBalance),
    totalDebitsCents,
    totalCreditsCents,
    closingBalanceCents: parseMoneyCents(s.closingBalance),
    balanceToPayCents:
      s.balanceToPay !== null ? parseMoneyCents(s.balanceToPay) : parseMoneyCents(s.closingBalance),
    minimumPaymentCents: s.minimumPayment !== null ? parseMoneyCents(s.minimumPayment) : null,
    overdueAmountCents: s.overdueAmount !== null ? parseMoneyCents(s.overdueAmount) : null,
    overdueInstallments: s.overdueInstallments,
    creditLimitCents: s.creditLimit !== null ? parseMoneyCents(s.creditLimit) : null,
    availableCreditCents: s.availableCredit !== null ? parseMoneyCents(s.availableCredit) : null,
    interestRateAnnual: s.interestRateAnnual,
    avgDailyBalanceCents: s.avgDailyBalance !== null ? parseMoneyCents(s.avgDailyBalance) : null,
    avgDailyBalancePriorCents:
      s.avgDailyBalancePrior !== null ? parseMoneyCents(s.avgDailyBalancePrior) : null,
    costOfCarryCents: s.costOfCarry !== null ? parseMoneyCents(s.costOfCarry) : null,
    costOfCarryPriorCents: s.costOfCarryPrior !== null ? parseMoneyCents(s.costOfCarryPrior) : null,
    lines,
  };
}

export function toParsedStatement(statement: LlmStatement): ParsedStatement {
  const currencies = [...new Set(statement.sections.map((s) => s.currency))].sort();
  const parserId =
    `${statement.cardNetwork}_${statement.cardLast4 ?? "na"}_${currencies.join("")}`.toLowerCase();
  return {
    parserId,
    cardLast4: statement.cardLast4,
    sections: statement.sections.map(toSection),
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/statements/llm/extract.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example lib/statements/llm/extract.ts lib/statements/llm/extract.test.ts
git commit -m "feat(statements): add Groq extraction call and ParsedStatement conversion"
```

---

### Task 6: Categorization fallback tier

**Files:**
- Modify: `lib/statements/categorize.ts`
- Modify: `lib/statements/categorize.test.ts`

**Interfaces:**
- Produces: `resolveCategoryId` gains an optional `suggestedCategory` field on its `line` parameter — consumed by Task 7 (`statement-actions.ts`, via `ParsedLine` which already carries the field from Task 1)

- [ ] **Step 1: Write the failing tests**

Add to `lib/statements/categorize.test.ts`, inside the existing `describe("resolveCategoryId", ...)` block, after the last `it`:

```ts
  it("LLM suggestion beats the MCC default table when no rule matches", () => {
    expect(
      resolveCategoryId(
        { mcc: null, description: "SOME NEW MERCHANT", suggestedCategory: "Entertainment" },
        [],
        names,
        "cat-other",
      ),
    ).toBe("cat-entertainment");
  });

  it("a merchant or MCC rule still beats the LLM suggestion", () => {
    const rules = [
      { rule_type: "mcc" as const, pattern: "5812", category_id: "cat-transport", priority: 0 },
    ];
    expect(
      resolveCategoryId(
        { mcc: "5812", description: "X", suggestedCategory: "Dining" },
        rules,
        names,
        "cat-other",
      ),
    ).toBe("cat-transport");
  });

  it("falls through to the MCC default table when the LLM suggestion isn't a real category", () => {
    expect(
      resolveCategoryId(
        { mcc: "5411", description: "X", suggestedCategory: "NotARealCategory" },
        [],
        names,
        "cat-other",
      ),
    ).toBe("cat-groceries");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: FAIL — TypeScript error, `suggestedCategory` doesn't exist on the `line` parameter type yet.

- [ ] **Step 3: Add the fallback tier**

In `lib/statements/categorize.ts`, replace the whole `resolveCategoryId` function:

```ts
export function resolveCategoryId(
  line: { mcc: string | null; description: string; suggestedCategory?: string | null },
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
  }

  if (line.suggestedCategory) {
    const byLlm = categoryIdByName.get(line.suggestedCategory);
    if (byLlm) return byLlm;
  }

  if (line.mcc) {
    const name = MCC_DEFAULT_CATEGORY[line.mcc];
    const byDefault = name ? categoryIdByName.get(name) : undefined;
    if (byDefault) return byDefault;
  }
  return otherId;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/statements/categorize.test.ts`
Expected: PASS, all 7 tests (4 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/statements/categorize.ts lib/statements/categorize.test.ts
git commit -m "feat(statements): add LLM suggestion as a categorization fallback tier"
```

---

### Task 7: Wire the new pipeline into `statement-actions.ts`

**Files:**
- Modify: `app/(app)/accounts/statement-actions.ts`

**Interfaces:**
- Consumes: `scrubPii` (Task 2), `extractWithLLM`/`toParsedStatement` (Task 5) — everything else in this file (`extractStatementText`, `validateChecksums`, `resolveCategoryId`, `suggestAccountId`, `centsToDecimal`, `getExchangeRates`) is unchanged

This task has no isolated unit test of its own — it's a server action wired to Supabase and Next.js runtime, same as the original pipeline. It's verified by `tsc`/lint plus the REQUIRED manual verification in Task 8, matching how `2026-07-22-statement-import.md` verified this same file.

- [ ] **Step 1: Swap the imports**

In `app/(app)/accounts/statement-actions.ts`, replace:

```ts
import { extractStatementText } from "@/lib/statements/extract";
import { detectParser } from "@/lib/statements/registry";
```

with:

```ts
import { extractStatementText } from "@/lib/statements/extract";
import { scrubPii } from "@/lib/statements/llm/scrub-pii";
import { extractWithLLM, toParsedStatement } from "@/lib/statements/llm/extract";
```

- [ ] **Step 2: Replace the detect+parse block in `runPipeline`**

Replace:

```ts
  await writeFile(path.join(process.cwd(), "extracted-statement.txt"), extracted.text, { mode: 0o600 });

  const parser = detectParser(extracted.text);
  if (!parser) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: "no parser matched",
    });
    return { error: t("unsupportedBank") } as const;
  }

  let parsed: ParsedStatement;
  try {
    parsed = parser.parse(extracted.text);
  } catch (e) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parser.id,
      file_name: file.name,
      status: "failed_detection",
      error: String(e),
    });
    return { error: t("parseFailed") } as const;
  }
```

with:

```ts
  await writeFile(path.join(process.cwd(), "extracted-statement.txt"), extracted.text, { mode: 0o600 });

  const llmResult = await extractWithLLM(scrubPii(extracted.text));
  if (!llmResult.ok) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: "llm extraction failed",
    });
    return { error: t("unsupportedBank") } as const;
  }

  let parsed: ParsedStatement;
  let parserId: string;
  try {
    parsed = toParsedStatement(llmResult.statement);
    parserId = parsed.parserId;
  } catch (e) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: String(e),
    });
    return { error: t("parseFailed") } as const;
  }
```

- [ ] **Step 3: Update the remaining `parser.id` references in `runPipeline`**

Replace:

```ts
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parser.id,
      file_name: file.name,
      status: "failed_validation",
      error: detail,
    });
```

with:

```ts
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parserId,
      file_name: file.name,
      status: "failed_validation",
      error: detail,
    });
```

Replace:

```ts
  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parser.id)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { supabase, user, file, bytes, parser, parsed, account, options, saved, t } as const;
```

with:

```ts
  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parserId)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { supabase, user, file, bytes, parserId, parsed, account, options, saved, t } as const;
```

- [ ] **Step 4: Update `parseStatement`**

Replace:

```ts
  const { parsed, parser, account, options, saved, file } = ctx;
```

with:

```ts
  const { parsed, parserId, account, options, saved, file } = ctx;
```

Replace:

```ts
  return {
    preview: {
      parserId: parser.id,
      cardLast4: parsed.cardLast4,
```

with:

```ts
  return {
    preview: {
      parserId,
      cardLast4: parsed.cardLast4,
```

- [ ] **Step 5: Update `confirmStatementImport`**

Replace:

```ts
  const { supabase, user, parsed, parser, account, options, file, t } = ctx;
```

with:

```ts
  const { supabase, user, parsed, parserId, account, options, file, t } = ctx;
```

Replace the payload's:

```ts
  const payload = {
    parser_id: parser.id,
    card_group_id: account.card_group_id ?? "",
```

with:

```ts
  const payload = {
    parser_id: parserId,
    card_group_id: account.card_group_id ?? "",
```

Replace the saved-mapping upsert's:

```ts
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parser.id,
          card_group_id: cardGroupId,
```

with:

```ts
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parserId,
          card_group_id: cardGroupId,
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If `detectParser`/`registry` or the unused `parser` variable are still referenced anywhere in this file, `tsc` will fail — that's the signal every reference from Steps 3–5 was found.

- [ ] **Step 7: Run the full statements test suite**

Run: `npx vitest run lib/statements`
Expected: all tests pass (this task touches no logic under `lib/statements` directly, only its caller).

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/accounts/statement-actions.ts"
git commit -m "feat(statements): route statement parsing through Groq instead of the regex parsers"
```

---

### Task 8: Dev harness, real-file verification, and finish

**Files:**
- Create: `scripts/parse-statement-llm.mjs`

- [ ] **Step 1: Write the dev harness**

Mirrors the existing `scripts/parse-statement.mjs` convention (dev-only, never run in CI, never given a real statement path that gets committed).

`scripts/parse-statement-llm.mjs`:

```js
// Usage: node scripts/parse-statement-llm.mjs <path.pdf> [password]
// Extracts, scrubs, and runs the Groq extraction pipeline against a real PDF on disk.
// Requires GROQ_API_KEY (and optionally GROQ_MODEL) in the environment.
import { readFile } from "node:fs/promises";
import { extractStatementText } from "../lib/statements/extract.ts";
import { scrubPii } from "../lib/statements/llm/scrub-pii.ts";
import { extractWithLLM, toParsedStatement } from "../lib/statements/llm/extract.ts";
import { validateChecksums } from "../lib/statements/validate.ts";
import { centsToDecimal } from "../lib/statements/money.ts";

const [path, password] = process.argv.slice(2);
const bytes = new Uint8Array(await readFile(path));
const extracted = await extractStatementText(bytes, password);
if (!extracted.ok) {
  console.error("extract failed:", extracted.reason);
  process.exit(1);
}

const scrubbed = scrubPii(extracted.text);
console.log("--- scrubbed text preview (first 500 chars) ---");
console.log(scrubbed.slice(0, 500));

const llmResult = await extractWithLLM(scrubbed);
if (!llmResult.ok) {
  console.error("llm extraction failed:", llmResult.reason);
  process.exit(1);
}

const parsed = toParsedStatement(llmResult.statement);
console.log("\nparserId:", parsed.parserId, "cardLast4:", parsed.cardLast4);
for (const s of parsed.sections) {
  console.log(
    `  [${s.sectionKey}] ${s.currency} ${s.periodStart}..${s.periodEnd}`,
    `lines=${s.lines.length}`,
    `closing=${centsToDecimal(s.closingBalanceCents)}`,
  );
}
const failures = validateChecksums(parsed);
console.log(failures.length ? failures : "checksums OK");
```

Run: `npx tsx scripts/parse-statement-llm.mjs …` if plain `node` rejects the TS imports (`tsx` is already a devDependency).

- [ ] **Step 2: Commit the harness**

```bash
git add scripts/parse-statement-llm.mjs
git commit -m "chore(statements): add dev harness for the Groq extraction pipeline"
```

- [ ] **Step 3: Full static pass**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all clean. Fix anything that isn't before continuing.

- [ ] **Step 4: REQUIRED manual verification against the real statements**

Set `GROQ_API_KEY` in `.env.local` (your own key, never committed). Use the same two real files referenced in `2026-07-22-statement-import.md` (untracked, gitignored, in the repo root if still available locally — otherwise any real statement PDF works).

Run: `npx tsx scripts/parse-statement-llm.mjs <popular-visa-file>.pdf <password>`
Expected: `parserId` starts with `visa_`, one `DOP` section, `checksums OK`, `closing` matches what the real statement prints.

Run: `npx tsx scripts/parse-statement-llm.mjs <scotia-amex-file>.pdf`
Expected: `parserId` starts with `amex_`, three sections (`DOP`, `USD`, `DOP_CUOTAS`), `checksums OK` for all three.

Inspect the "scrubbed text preview" printed by the harness on both runs — confirm no name, email, or phone number appears in it.

If a section's checksum fails or a field comes back null that the statement clearly prints, that's a system-prompt gap, not a schema/conversion bug — tighten the alias table or add the missing label to `system-prompt.ts` and re-run. Do not touch `extract.ts`'s conversion math to work around a prompt problem.

- [ ] **Step 5: Live verification in the app (REQUIRED — superpowers:verification-before-completion)**

Ask the user before starting/killing the dev server (their standing preference). Then, with the app running and `GROQ_API_KEY` set:

1. Import the Popular VISA PDF on its card page → preview shows 1 section, correct line/payment counts → confirm → card balance matches the statement's printed closing balance, statement appears in history.
2. Re-import the same PDF → transaction count unchanged, balance unchanged (idempotent re-import still works with the new pipeline).
3. Import the Scotia AMEX PDF on any of its three line pages → mapping step lists 3 sections with sensible pre-fills, reusing whatever `statement_section_mappings` already exist from a prior regex-parser import of the same card (confirms the derived `parserId` didn't break saved mappings) → confirm → three statements land correctly.
4. Check a few imported transactions' categories — confirm ones with no matching merchant/MCC rule picked up the LLM's `suggestedCategory` rather than falling straight to "Other".

- [ ] **Step 6: Code review**

Use superpowers:requesting-code-review on the full branch diff against `docs/superpowers/specs/2026-07-23-llm-statement-extraction-design.md`.

- [ ] **Step 7: Finish the branch**

Use superpowers:finishing-a-development-branch. Per the user's standing memory: merge into main and delete the branch (local + remote) without asking.
