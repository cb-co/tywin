# LLM-Based Statement Extraction — Design

**Date:** 2026-07-23
**Status:** Approved direction, pending spec review
**Supersedes:** the "no LLM involved, no statement data leaves the app" decision in
`2026-07-22-statement-import-design.md` §1 — that constraint traded bank-agnostic coverage
for a fully local, deterministic pipeline that only understands two hand-written parsers.
This design keeps the deterministic pipeline in the tree (unplugged, not deleted) and
routes statement text through Groq instead, so a new bank format needs no new parser code.

## 1. Goal

Replace the regex bank-specific parsing step (`detectParser` + `StatementParser.parse`)
with a single LLM call that extracts the same structured data regardless of how a given
bank labels its fields. The PDF-to-text extraction step (`extractStatementText`, pdfjs +
password handling) is unchanged — only the "text → structured statement" step moves to
Groq.

## 2. Architecture

```
File upload
   ↓
extractStatementText()      unchanged: pdfjs text extraction, password handling
   ↓ raw text
scrubPii(text)               NEW — deterministic regex pass, strips identifying data
   ↓ scrubbed text             before anything leaves the server
extractWithLLM(text)         NEW — Groq call via AI SDK generateObject, zod schema
   ↓ StatementExtraction (LLM shape: amounts as strings, dates as ISO)
toParsedStatement()          NEW — pure function: parseMoneyCents on every amount,
   ↓ ParsedStatement            computed totalDebits/CreditsCents from lines,
                                 computed periodStart, derived parserId
validateChecksums()          unchanged
mapping / categorize / DB    unchanged (categorize gets one new fallback tier, §6)
```

`detectParser` and `lib/statements/parsers/{popular-visa,scotia-amex}.ts` stay in the
tree, uncalled from `statement-actions.ts`.

**New files:**
- `lib/statements/llm/scrub-pii.ts`
- `lib/statements/llm/schema.ts`
- `lib/statements/llm/system-prompt.ts`
- `lib/statements/llm/extract.ts` (`extractWithLLM`, `toParsedStatement`)

**Changed files:**
- `app/(app)/accounts/statement-actions.ts` — `runPipeline` calls `scrubPii` +
  `extractWithLLM` + `toParsedStatement` instead of `detectParser`/`parser.parse`;
  every `parser.id` reference becomes the derived identity key (§7)
- `lib/statements/categorize.ts` — `resolveCategoryId` gains one fallback tier (§6)
- `package.json` — add `ai`, `@ai-sdk/groq` (`zod` already present)
- `.env.example` — add `GROQ_API_KEY=`, `GROQ_MODEL=llama-3.3-70b-versatile`

## 3. PII scrubbing (`scrub-pii.ts`)

Runs on the raw pdfjs text before it is sent to Groq. Deterministic and regex-based —
no LLM involved in scrubbing itself, since a pattern-based pass can't be talked out of
redacting something the way a model theoretically could, and it's cheaper/faster/free.

Validated against two real statements (Banco Popular VISA, Scotiabank AMEX) pulled during
this session via the debug write in `statement-actions.ts`. Both test inputs were deleted
after validation; only the redacted structure below is captured here.

**Rules, in order:**

1. **Email** — standard email regex, replaced with `[EMAIL]`.
2. **Phone** — either an explicit label (`Tel`/`Teléfono`/`Cel`/`Fax`/`Phone`) followed by
   a digit run, or a dash/dot/space/paren-grouped number shaped like 3+3+4 digits
   (`809-227-3182`, `(809) 567-7268`, `1-809-200-3182`). The 3-digit middle group is
   deliberate: DR-format dates are `DD-MM-YYYY` (2+2+4 digits), so this shape never
   collides with a date. (First version of this rule used a looser 2-4 digit middle
   group and silently ate `Fecha de Corte: 15-07-2026` — caught by testing against the
   real Scotia file before it ever became a bug in production.)
3. **Standalone numeric doc-ID lines** — some bank PDFs carry a hidden barcode/reference
   layer that pdfjs still extracts as text, e.g. `- 6760 - 000000012473453 - 15-07-2026`.
   A line matching `-  <token>  -  <8+ digits>  -  <date>  -` in isolation is replaced
   with `[ID]`. Scoped to the whole-line shape specifically so it never touches a
   transaction row's reference-number column (those always share a row with a
   description and an amount).
4. **Name near an email** — for each matched email, the up-to-6-lines-before and
   up-to-2-lines-after are checked: any that are non-empty, ≤60 chars, and contain no
   digit are replaced with `[NAME]`. Cardholder identity blocks (name/phone/email) print
   clustered together in both real samples, just not in a fixed order or exact offset.
5. **Name after a label** — `Estado de cuenta de:`, `Titular:`, `Nombre del cliente`,
   `A nombre de:`, `Cliente:` — the next digit-free line within 4 lines is `[NAME]`.
6. **Repetition safety net** — any short (≤60 char), multi-word, digit-free line that
   recurs 3+ times identically across the document is redacted everywhere it appears.
   Real transaction/merchant text never appears as a bare line with no date or amount on
   it, let alone verbatim three separate times — a name, or a repeating label, does. This
   is what actually generalizes across bank layouts we haven't seen: it doesn't depend on
   proximity to an email or a specific label string.
7. **Fuzzy variant of the above** — a line that merely *starts with* one of rule 6's
   recurring strings is also redacted. Catches one-off garbled occurrences — e.g. pdfjs
   glued the real name to an unrelated table-header word on one page only
   (`ROBERT R DE LA CRUZ OBTENIDOS`, from column-position bleed in a rewards-points
   table) because that occurrence didn't match any *other* rule and wasn't frequent
   enough on its own to trip rule 6.

**Known limitation, stated plainly:** this is heuristic, not a guarantee. It was tuned and
verified against two real, structurally different statements, not a corpus of every bank
format the LLM path might eventually see. Collateral stripping of non-sensitive boilerplate
(product names, repeated coupon labels) is expected and accepted — none of it is needed for
extraction. The risk direction that matters is the other one (real PII slipping through on
a bank layout the two samples didn't cover), which is why rules 6–7 exist as a
proximity-independent net rather than relying solely on anchoring near an email match.

## 4. Groq call

`@ai-sdk/groq` + `generateObject`, model `env.GROQ_MODEL` (default
`llama-3.3-70b-versatile` — large context for multi-page statements, reliable structured
output, handles Spanish financial text). Schema in `lib/statements/llm/schema.ts`:

```ts
const Line = z.object({
  madeOn: z.string(),        // ISO yyyy-mm-dd
  postedOn: z.string(),
  reference: z.string().nullable(),
  description: z.string(),
  mcc: z.string().nullable(),
  authCode: z.string().nullable(),
  amount: z.string(),        // exact printed number, e.g. "1,623.00" or "-350.00"
  kind: z.enum(["purchase", "fee", "credit", "payment"]),
  suggestedCategory: z.string().nullable(),
});

const Section = z.object({
  sectionKey: z.string(),
  currency: z.string(),      // ISO 4217
  periodEnd: z.string(),     // ISO date
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
  totalDebits: z.string().nullable(),  // fallback, only used when lines is empty
  totalCredits: z.string().nullable(),
  lines: z.array(Line),
});

const Statement = z.object({
  cardNetwork: z.enum(["visa", "mastercard", "amex", "discover", "other"]),
  cardLast4: z.string().nullable(),
  sections: z.array(Section),
});
```

`toParsedStatement()` converts every amount string via the existing `parseMoneyCents`
(never trusts the model to do money arithmetic), computes `totalDebitsCents`/
`totalCreditsCents` from `lines` when non-empty (falls back to the model's
`totalDebits`/`totalCredits` only for line-less sections, e.g. a Cuotas/installments
summary), computes `periodStart` via the existing `monthBeforePlusDay`, and assigns each
line's `lineNo` from its index within the section (the model's schema has no `lineNo`
field — it's a property of the conversion, not of the statement) — none of that logic
moves into the model.

## 5. System prompt (`system-prompt.ts`)

```
You are a strict data-extraction engine for Latin American / Caribbean credit-card
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
  totalDebits (line-less sections only): COMPRAS Y DEBITOS
  totalCredits (line-less sections only): TOTAL PAGOS Y CREDITOS

SECTIONS: emit one section per distinct currency/product block of balances and
transactions (a statement may have one, e.g. a single DOP VISA line, or several, e.g.
DOP + USD + a Cuotas/installments summary). A section with a printed balance summary but
no individual transaction lines (installments-to-be-billed, a promotional purchase plan)
still gets its own section — with an empty `lines` array and `totalDebits`/`totalCredits`
filled from its summary row instead (leave both null if lines is non-empty; the caller
computes them from the lines and ignores these fields in that case).

sectionKey MUST be stable and predictable so the same physical card produces the same
key on every future statement: use the section's ISO currency code alone for an ordinary
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
compute, round, convert, or reformat any number yourself.

DATES: normalize every date to ISO yyyy-mm-dd. When the source prints day/month with no
year, infer the year from the statement's period-end (cutoff) date — a month number
greater than the cutoff's month belongs to the previous year.

Return only the structured JSON matching the given schema. Use null for anything not
present on the statement. Never omit a required key.
```

## 6. Categorization priority

`resolveCategoryId` gains one fallback tier, ordered:

1. Saved merchant rule (`category_rules`, `rule_type = 'merchant'`) — unchanged
2. Saved MCC rule (`category_rules`, `rule_type = 'mcc'`) — unchanged
3. **NEW** — `suggestedCategory` from the LLM, matched case-insensitively against the
   user's actual category names
4. Hardcoded `MCC_DEFAULT_CATEGORY` table — unchanged, now mostly a backstop for banks
   that do print MCC but where the LLM's guess didn't land
5. `Other` — unchanged

User customization always wins; the LLM only fills the gap the MCC table leaves on banks
that print no MCC at all (Scotia Amex, confirmed from the real sample).

## 7. Statement identity key

The old `parser_id` (`"popular_visa"`, `"scotia_amex"`) gated
`statement_section_mappings` reuse and the `unique (user_id, parser_id, card_group_id,
section_key)` constraint. An LLM won't reliably emit the same free-text bank name twice,
so the new key is derived from structured fields already in the schema instead:

```
parserId = `${cardNetwork}_${cardLast4 ?? "na"}_${sortedUniqueCurrencies.join("")}`.toLowerCase()
```

No migration needed — `parser_id` is already a plain `text` column. Stable across
re-imports of the same physical card (network + last4 + currency set don't change month
to month), so saved section mappings keep being reused exactly as before.

## 8. Error handling

`extractWithLLM` failure (network error, rate limit, or the model's output still fails
schema validation after the AI SDK's built-in repair/retry) returns a typed error.
`runPipeline` surfaces it the same way `unreadablePdf`/`parseFailed` do today — no
fallback to the regex parsers; the two pipelines are not both live at once.

## 9. Global constraints

- Real bank statements and their extracted text are never committed — same rule as the
  original statement-import spec, now also covering anything written for LLM-flow
  debugging (`.gitignore` already covers `*.pdf` and `extracted-statement.txt`).
- `scrubPii` runs on every request before the Groq call, unconditionally — not a
  feature-flagged or opt-in step.
- Money is a string until `parseMoneyCents` touches it — the model never emits or is
  asked to compute cents.
- Tests: vitest, colocated `*.test.ts`. `scrub-pii.test.ts` and `schema`/`extract`
  tests use synthetic fixtures (existing `POPULAR_FIXTURE`/`SCOTIA_FIXTURE` conventions),
  never real statement text.
