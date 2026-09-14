# Insights answers four questions; the card gets a report card (UX-07)

**Date:** 14 Sep 2026
**Audit item:** UX-07 · Fix · High — *"Insights is eleven cards answering three different clocks"*
**Audit doc:** `docs/product-audit-dominican-market.md`

## Why

`app/(app)/insights/page.tsx` renders thirteen cards on four different clocks: 6-month trend, the
picked month, year-to-date, and "as of the last statement". The month picker sits in one band's
heading, and that band carries Transfer costs, which ignores the picker and needs a "YTD" in its
title to say so. The page's own comments spend paragraphs explaining which card obeys which clock.

Most of the card-specific cards are already duplicated. The card detail page
(`app/(app)/accounts/[id]/page.tsx`) shows cashback this year, cost of ownership, incident fees and
welcome-bonus progress as lines in its hero. The one card fact that lives *only* on Insights is
cost of carry. A person comparing two cards opens the cards, not Insights.

## Decisions taken

- Insights answers four questions: *is my net worth moving*, *where did the money go*, *am I on
  pace*, *what is my debt costing me*. Nothing else stays.
- Savings goals and Card payments leave Insights. Goals already live under Budgets; card payments
  are already counted inside Expenses vs budget.
- Card-specific figures move to a **Boleta de la tarjeta** section on the card detail page.
- Transfer costs move to the bank/investment account page, per account. Not a new Settings
  section.
- The Insights debt band keeps one combined **Debt cost** card, not a grand total.

## Scope

### 1. Insights — three bands, each on one clock

| Band | Cards | Clock |
|---|---|---|
| Position (`sectionPosition`) | Net worth, Cash flow | Trend |
| This month (`sectionThisMonth`) + picker | Spending pace, Spend distribution, Expenses vs budget | Picked month — every card obeys it |
| Debt (`sectionDebt`) | Debt health, Debt cost | Now |

Removed from the page: Savings goals, Card payments, Transfer costs, Cost of carry, Loan interest,
Cashback, Cost of ownership (as separate cards).

Layout: Net worth, Cash flow, Spending pace, Spend distribution stay full-bleed as today. Expenses
vs budget becomes full-bleed too (it lost its pairing with Card payments). Debt health and Debt cost
pair side by side at `@[34rem]`.

**Debt cost card.** Two groups, each with its own subtotal, and **no grand total**. Card carry is a
projection (what the card *would* charge to finance, "Interés si Opta Por Financiar"); loan interest
is money already paid. The existing comment on the loan-interest card explains why one total can't
close over both, and that reasoning carries over unchanged.

- *Tarjetas · si financias* — one row per card from `getCostOfCarry()` lines with a non-null
  `costOfCarry`: name, currency · APR · as of `periodEnd`, amount. Subtotal in base currency.
- *Préstamos · pagado* — one row per loan from `getLoanInterest()`: name, currency · APR · as of
  `lastPaymentDate`, `lastInterest`. Subtotal monthly in base, plus the muted "Recorded in {year}"
  line as today.
- Every row links to `/accounts/{accountId}`.
- A group with no rows is omitted. If both are empty, the card shows the empty copy and the
  `ImportButton`, as Cost of carry does today.

Grouping is a pure function `buildDebtCost(carry, loanInterest)` in `lib/insights/queries.ts` (or a
sibling `lib/insights/debt-cost.ts`), unit-tested. The page renders its output.

The page's top-of-file comments get rewritten to match the new structure. The paragraph about a card
sitting under a picker it doesn't obey goes away, because that card no longer exists.

**Dead code.** `getCardPayments`, `getCashbackByCard`, `sumCashbackByCurrency`, `getTransferCosts`,
`fetchAllTransferRows`, `getCardFees`, `buildCardFeeLines` and their tests are deleted from
`lib/insights/queries.ts` once nothing calls them. `getCostOfCarry`, `getLoanInterest` and
`buildLoanInterest` stay. `SavingsGoals` (`components/insights/savings-goals.tsx`) is deleted if it
has no other caller. Orphaned `Insights.*` message keys are removed from `messages/en.json` and
`messages/es.json`.

### 2. Boleta de la tarjeta — card detail page

A new `Card` titled **Boleta de la tarjeta** / *Card report* is placed between the hero and the
spend-by-category donut, on `credit_card` accounts only. It is a list of rows in the Tally
register: label and context on the left, the figure right-aligned in `tabular-nums`, in the
account's own currency.

Rows, in order. Each one renders only when it has real data, following the existing
"silence rather than a confident RD$0" rule.

1. **Cost of carry** — from the latest statement: "as of {date} · APR {rate}", amount. Source: a
   new `getAccountCostOfCarry(accountId)` reading `card_cost_of_carry` filtered by `account_id`.
   Shown when `cost_of_carry` is non-null.
2. **Cashback {year}** — `yearCashback(statements, year)`, shown when `hasReportedCashback`. (Moved
   from the hero.)
3. **Cost of ownership {year}** — `cardFees.recurring`, with the negative → "refunded" wording.
   (Moved from the hero.)
4. **Incident fees {year}** — `cardFees.incidents`, same sign convention. (Moved from the hero.)
5. **Payments this month** — sum of `payment` transactions into this account (`to_account_id`)
   in the current calendar month, in `to_amount ?? amount`, the same way `getCardPayments` totals
   today. Shown when non-zero. Source: a per-account query in `lib/accounts/queries.ts`.
6. **Welcome bonus** — the progress bar and "spent of goal by date" detail, moved out of the hero
   as-is, with the same `showBonus` gating.

The hero loses rows 2, 3, 4 and 6 and keeps balance owed, the statement anchor line, utilization
and payment due day.

Empty Boleta: if no row renders, the card still shows, with one muted line saying the report fills
in from imported statements and an `ImportButton size="sm"`. It does not disappear.

Row 1 costs one extra round trip and row 5 costs one. Both are issued only once `isCardType` is
known, the same pattern `getCardSpendByCategory` and `getAccountFeeLines` already follow on this
page. Rows 1 and 5 are fetched together in one `Promise.all`.

The Boleta is its own component, `components/accounts/card-report.tsx`. It takes already-computed
figures as props, so the page stays a data-loader and the component has no queries.

### 3. Transfer costs — bank and investment account pages

Under the existing **Transfer fees** settings card (shown when `hasTransferFees(type)`), a
**Paid in {year}** row with two figures: fees and tax.

Scope: **every transaction type** where `account_id` is this account and `occurred_at` falls in
the current calendar year, summing `fee_amount` and `tax_amount`. Not payments only.
`transactions_compute_amounts()` sets tax from the source account's `transfer_tax_rate` whenever
`include_tax` is set and commission from `network_fee_amount` whenever `include_commission` is set,
on any type. So an expense paid from a checking account carries both, and a payments-only filter
would drop them.

Figures stay in the account's own currency, summing raw `fee_amount` / `tax_amount` with no
exchange-rate conversion, because every row is in that account's currency.

Implementation: `getAccountTransferCosts(accountId, year)` in `lib/accounts/queries.ts`. It pages
past PostgREST's 1000-row cap the same way `fetchAllTransferRows` does today; that loop moves here.
A pure `sumAccountTransferCosts(rows)` returns `{ fees, tax }` rounded to cents and is unit-tested,
replacing `sumTransferCosts`.

When both figures are zero, the row is shown with zeros. Unlike a card's cashback, a zero here is a
real answer, since every fee and tax that could apply is derived on write by the trigger.

### 4. Help guide and audit doc

Per the help-guide upkeep rule, en + es:

- **Insights chapter:** the bullet list drops `insightsCarry`, `insightsCashback`,
  `insightsCostOfOwnership` and `insightsLoanInterest`, and gains a `insightsDebtCost` bullet
  describing the two-group card. The intro names the four questions. `InsightsMock` is checked for
  any removed card and updated if it draws one.
- **Accounts chapter:** a short Boleta paragraph listing its rows, and a line that bank accounts
  show transfer fees and tax paid this year.
- **Audit doc:** UX-07 marked done with a **Done** paragraph citing files and commits, plus a
  **Remaining** list. The live browser pass is recorded there if it is not run.

## Out of scope

- Any net-worth detail page, or a link from Overview's net-worth stat to Insights.
- A per-card-group Boleta. The Boleta is per account (per currency line), like every figure it
  reuses.
- Converting Boleta figures to base currency.
- Changing how cost of carry, cashback or fees are computed.

## Testing

- Unit (vitest): `buildDebtCost` (both groups, one empty, both empty, null carry filtered out),
  `sumAccountTransferCosts` (mixed nulls, rounding, empty). Existing `buildLoanInterest` tests
  stay. Deleted functions' tests are deleted with them.
- `tsc --noEmit` and lint clean. `next build` compiles.
- Browser pass with agent-browser (asking before starting the dev server): Insights shows three
  bands and the month picker moves every card in its band; a card with an imported statement shows
  the Boleta with carry and cashback; a card with nothing shows the empty Boleta; a checking
  account shows "Paid in {year}"; Spanish locale at 360px.
