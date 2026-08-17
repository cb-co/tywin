# Cost of ownership — what each credit card charges you to exist

**Date:** 2026-08-16
**Status:** Approved, ready for planning

## The question

A credit card charges you money simply for being yours: an annual fee, a bundled
insurance premium, a membership product. None of that is spending, none of it is
interest, and today the app has nowhere to show it.

Two surfaces answer the question: a roll-up card on Insights, and a per-card line
on the account detail page — the screen where you actually decide whether to keep
a card.

## What this is deliberately not

**Costs are never netted against benefits.** No "this card made you X" figure
exists anywhere in this design. Many card benefits — lounge access, travel
insurance, purchase protection, extended warranty — never appear on a statement,
so any net figure the app computed would be built from the costs it can see and a
blank where the benefits are. That number would look authoritative and be wrong
in a consistent direction: always too pessimistic about the card.

The Insights card therefore sits *beside* Cashback, not folded into it. The card
ledger reads as three separate honest columns — what carrying a balance would
cost (Cost of carry), what the card pays back (Cashback), what the card charges
you to hold it (Cost of ownership) — and the reader nets it themselves against
the benefits they know about and the app does not.

## Where the numbers come from

`card_statement_lines` rows where `kind IN ('fee','credit')`, grouped by
`account_id`, filtered to a calendar year on `posted_on`.

`credit` is in the query **only** to catch fee reversals, which the issuer posts
as credits rather than as negative fees — see "Reversal netting" below. The
overwhelming majority of `credit` rows are cashback and merchant refunds and are
discarded by the guard described there. `fee` rows alone are what the two
subtotals are built from.

Measured from statements rather than declared in a form. Three reasons:

1. **The data is already there and unused.** `card_statement_lines.kind` is an
   enum `('purchase','fee','credit','payment')` and the extraction prompt
   (`lib/statements/llm/system-prompt.ts:47`) already classifies anything opening
   with a fee word — *cargo, fee, comisión, interés, seguro* — as `fee`. Nothing
   downstream has ever read `kind`. Every annual fee and insurance premium on
   every statement already imported is sitting in the database, tagged.
2. **It runs retroactively.** No migration, no re-import, no backfill. The
   feature ships with history.
3. **It is money the bank actually charged**, not a number someone typed that
   drifts the year the issuer raises the fee.

### The cost of that choice, stated plainly

Statement history begins April 2026 — roughly four months. **An annual fee
charged once a year has not happened inside that window**, so the feature ships
showing insurance and incident fees, and grows into the annual fee as statements
accumulate. This is accepted, not overlooked. A declared annual-fee field would
close the gap sooner but would be building for a gap that closes by itself.

### Live data this design was built against

Every non-purchase, non-payment line across all imported statements:

| kind | description | n | total |
|---|---|---|---|
| fee | CARGO SEGURO FRAUDE | 2 | 700.00 |
| fee | CARGO COBERTURA DE SEGURO | 1 | 1,300.00 |
| fee | CARGO SOBREGIRO | 1 | 500.00 |
| credit | REVERSO CARGO SEGURO FRAUDE | 1 | −350.00 |

Four fee lines, one card, all June 2026. Sparse — which the empty states below
take seriously rather than treating as an edge case.

## Classification

A pure module, `lib/accounts/card-fees.ts`, following the shape of `cashback.ts`
and `welcome-bonus.ts`: pure functions over plain row shapes, with its own test
file, no Supabase client.

Classification happens **at read time from the description**, not at extraction
time.

### Why not a `feeKind` field in the LLM schema

Considered and rejected. It would need a migration, a prompt change, a schema
change, and a null-fallback for every row imported before it existed — and it
**cannot fix history at all**, because the statements bucket was dropped in
`20260722170000_drop_statements_bucket.sql`, so the source PDFs are gone and
existing rows can never be re-extracted. A read-time rule covers history and new
imports with one mechanism. If descriptions ever prove genuinely unclassifiable,
adding the LLM field then remains open.

### The rules, applied in order

Matching is case-insensitive and accent-insensitive (`interes` must match
`INTERÉS`); normalize via `String.prototype.normalize("NFD")` with combining
marks stripped, then lowercase.

**1. Interest → excluded entirely.**

```
interes · interest · financiamiento
```

This is a hard requirement, not a refinement. The prompt at
`system-prompt.ts:47` puts `interés` in the same `fee` bucket as `cargo` and
`seguro`. No interest line appears in the data today only because the cardholder
pays in full every month — a behavioural fact, not a structural one. The moment a
balance is carried, `INTERES FINANCIAMIENTO` posts as `kind = 'fee'` and would
land in this card, while also being the *realized* version of the projection that
Cost of carry already shows. One surface cannot hold a projection and a charge.

Checked **first**, so `interés por mora` is excluded too. Excluding is the
conservative direction: a misfire here can only under-report the cost of
ownership, never inflate it.

**2. Incident.**

```
sobregiro · overdraft · mora · late · atraso · tardio · penalidad
penalty · reposicion · replacement · avance · cash advance · exceso
```

Things that happened, not things you pay to hold the card.

**3. Recurring — everything else.**

Recurring is the default, and the live data is the argument. `AHORRO MUJER WHITE`
was tagged `fee` by the model despite matching *none* of the prompt's keywords —
it is a bundled insurance product with a pure brand name. Incident vocabulary is
a bounded, enumerable list; ownership charges are unbounded product names. So the
enumerable case gets the explicit list and the unbounded case gets the default,
which files `AHORRO MUJER WHITE` correctly as recurring.

### Reversal netting

A `credit` line counts as a fee reversal only when **both** hold:

- the description opens with `reverso` · `reversa` · `reversal` · `anulacion`, and
- the remainder after stripping that prefix contains a fee word —
  `cargo` · `seguro` · `comision` · `cobertura` · `membresia` · `anualidad` · `fee`

The stripped remainder is then run through the same three rules and its amount
netted against that bucket.

Both conditions are needed. The prefix alone would drag `REVERSO COMPRA` — an
ordinary purchase refund — into a card about fees. Without netting at all, the
live card reports **700.00** for `SEGURO FRAUDE` when the cardholder actually
paid **350.00**: the issuer charged it twice by mistake and reversed one. The
reversal is stored as a `credit`, in the same bucket as cashback and merchant
refunds, which is exactly why a naive `sum(kind = 'fee')` gets it wrong.

## No annualization

Both subtotals read **"Charged in {year}"** — a period total, never a projected
annual run rate.

Two reasons. Four months of history cannot support a run rate. And the charges
are irregular in a way that defeats extrapolation — two `SEGURO FRAUDE` hits
landed inside a single month, so any per-month figure multiplied by twelve would
be fiction.

This matches the convention the Loan interest card set with "Recorded in", and
for the same reason: state what the data covers rather than implying a full year
the app has not observed.

## Currency

Rows stay in each card's own currency. Closing totals convert to base currency
via `convertToBase` / `getExchangeRates` from `lib/fx`, exactly as
`getCostOfCarry` (`lib/insights/queries.ts:239`) and `getLoanInterest` do.

This differs from Cashback, which deliberately prints no grand total because a
rebate is credited in the line's own currency and summing through today's FX rate
would invent a figure no statement printed. The difference is justified: "what do
my cards cost me a year" is a question whose answer *is* a single number, and the
same reasoning already led Cost of carry and Loan interest to convert.

## Surface 1 — Insights

`getCardFees()` in `lib/insights/queries.ts`, added to the existing `Promise.all`
in `app/(app)/insights/page.tsx:138`.

Return shape, following `LoanInterest`:

```ts
export type CardFeeLine = {
  accountId: string;
  name: string;        // "Group — Card" when grouped, same as cashback/carry
  currency: string;
  recurring: number;   // native, reversals netted
  incidents: number;   // native, reversals netted
};

export type CardFees = {
  year: number;
  baseCurrency: string;
  lines: CardFeeLine[];
  recurringBase: number;
  incidentsBase: number;
};
```

Rendered with the existing `Tally` component in the Debt section, immediately
after Cashback — cost and return adjacent, never summed. Icon: `ShieldAlert` from
lucide, joining `Landmark` (Cost of carry), `Percent` (Loan interest) and `Gift`
(Cashback).

Two subtotal rows in `Tally`'s `total` slot: recurring in foreground weight,
incidents in `text-muted-foreground` beneath it — the same visual hierarchy Loan
interest uses for its monthly figure over its year figure.

**Cards with no fee lines in the year are omitted from `lines` entirely.** Not
rendered as `0.00`. This follows the rule `getCashbackByCard` documents at
`queries.ts:474`: a confident zero drawn from silence is a claim the data cannot
vouch for. With today's data exactly one card would appear.

Empty state when no card has any fee line: a single muted line, matching
`costOfCarryEmpty` and `cashbackEmpty`.

### Known wrinkle

This makes five cards in the Debt section's two-column grid, so the final row
carries an orphan. Flagged for the visual pass rather than solved here — the
options (reordering, letting one card span both columns, or splitting the
section) are layout judgements better made against the rendered page.

## Surface 2 — Account detail

`app/(app)/accounts/[id]/page.tsx`, following the Cashback line at lines 298–319:
a standing fact about the card, rendered as a `<p>` among the card's other facts,
not a card of its own.

Unlike Cashback — which is summed from the `card_statements` rows the page has
already loaded — fee lines live in `card_statement_lines`, which the page does
not fetch. This needs one extra round trip, gated on `isCardType`, in the same
position and for the same reason as `getCardSpendByCategory` at line 138: it is
only worth issuing once `type` has confirmed the account is a card, and `type`
comes out of the batch above it.

Two lines, each rendered only when its own subtotal is non-zero:

- `costOfOwnershipThisYear` — "**{amount}** in fees and insurance charged in {year}."
- `cardIncidentFeesThisYear` — "**{amount}** in penalty fees charged in {year}."

Both use `t.rich` with the amount in `figure font-medium text-foreground`,
matching `cashbackThisYear`. Year passed as `String(year)` — a numeric ICU
argument routes through `Intl.NumberFormat` and renders "2,026".

A card with no fee lines shows neither line. Silence, not zeros — the same rule
as the Insights surface.

## i18n

New keys in `messages/en.json` and `messages/es.json`:

- `Insights.cardFeesTitle` (takes `year`), `cardFeesRecurring`, `cardFeesIncidents`
  (both take `currency`), `cardFeesEmpty`
- `Accounts.costOfOwnershipThisYear`, `Accounts.cardIncidentFeesThisYear`
- `Help.accountPageCostOfOwnership`, `Help.insightsCostOfOwnership`

## Help guide

Per the standing rule that the in-app guide moves with every feature:

- `app/(app)/help/page.tsx` — add `accountPageCostOfOwnership` to the account
  page list (after `accountPageCashback`, line 196) and `insightsCostOfOwnership`
  to the insights list (after `insightsCashback`, line 324)
- `components/help/mocks.tsx` — reflect the new card in `InsightsMock`
- Both locales

**Adjacent gap, fixed while here:** the insights list in the help guide has no
entry for the Loan interest card, which shipped in `462d444` without one. Adding
`insightsLoanInterest` alongside is a one-line fix in the exact list this work
already edits.

## Testing

`lib/accounts/card-fees.test.ts`, following `cashback.test.ts`:

- interest excluded — `INTERES FINANCIAMIENTO`, `Interés`, `INTEREST CHARGE`
- interest beats incident — `INTERES POR MORA` is excluded, not filed as incident
- incident list — `CARGO SOBREGIRO` → incidents
- unknown product name defaults to recurring — `AHORRO MUJER WHITE`
- known recurring — `CARGO SEGURO FRAUDE`, `CARGO COBERTURA DE SEGURO`
- accent and case insensitivity — `INTERÉS` matches `interes`
- reversal netting — `REVERSO CARGO SEGURO FRAUDE` (−350) against
  `CARGO SEGURO FRAUDE` (700) nets to 350 recurring
- reversal guard — `REVERSO COMPRA` is ignored entirely, affecting neither bucket
- year filter on `posted_on` — a December-2025 fee is absent from the 2026 figure
- a card with no fee lines produces no line at all, not a zero line

The live four-row dataset above is a fixture worth encoding directly: it exercises
recurring, incident, and reversal netting in one case, with a known-correct
answer of 350 recurring and 500 incidents.

## Out of scope

- **A declared annual-fee field on the account form.** Measured was chosen; the
  annual fee appears on its own once a statement carries it.
- **A `feeKind` field in the extraction schema.** See the rejection above.
- **Any cost-versus-benefit net figure.** See "What this is deliberately not".
- **Changing `system-prompt.ts:47`.** `fee` remains the right storage kind for
  these lines; the interest split is a read-time concern.
