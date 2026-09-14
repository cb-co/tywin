# Insights Four Questions + Boleta de la tarjeta — QA Guide (UX-07)

**Shipped:** 2026-09-14 (`3df8775`…`64a744a`)
**Spec:** `docs/specs/2026-09-14-insights-four-questions-design.md`
**Plan:** `docs/plans/2026-09-14-insights-four-questions.md`

## Before you start

- No migrations. This change is app-side only.
- Sign in with data that has all of the following. Each one exercises a different branch.
  - **Card A:** a credit card with at least one imported statement that printed cost of carry and
    cashback.
  - **Card B:** a credit card with **no** statements.
  - **Loan:** a loan with at least one payment logged against it.
  - **Checking:** a checking or savings account with a transfer tax rate and/or network fee set,
    and at least one expense or transfer this year with tax or commission switched on.
- Test on a desktop width first, then repeat the checks marked 📱 at **360px** in **Spanish** (use the
  language switcher).

The invariant throughout: **no figure is invented from missing data.** A row that has no data
behind it is not shown. It should never appear as `RD$0.00`. The one exception is the bank account
"Paid in" block (§4), where zero is a real answer.

---

## 1. Insights — three bands

Open `/insights`.

| Check | Expected |
|---|---|
| Page description | "Is your net worth moving, where the money went, whether you're on pace, and what your debt costs." / es: "Si tu patrimonio se mueve, a dónde fue el dinero…" |
| First band **Position** | Exactly two full-width cards: **Net worth (last 6 months)**, **Cash flow** |
| Second band **This month** (month picker in its heading) | Exactly three full-width cards: **Spending pace**, **Spend distribution**, **Expenses vs budget** (or **Groups vs budget**) |
| Third band **Debt** | Two cards side by side: **Credit & debt health**, **What your debt costs** |
| Gone from the page | Savings goals, Card payments this month, Transfer costs (YTD), Cost of carry, Loan interest, Cashback in {year}, Cost of ownership in {year} |
| Loading state (hard refresh, or throttle the network) | Skeleton shows 2 / 3 / 2 blocks. Nothing jumps when the page swaps in |

### Month picker

| Step | Expected |
|---|---|
| Click ◀ (previous month) | All three cards in the **This month** band change. Page does not scroll to top |
| Watch the Position and Debt bands while clicking | They do not change |
| Click ▶ back | Returns to the current month |

---

## 2. Insights — "What your debt costs" card

| Check | Expected |
|---|---|
| **Tarjetas · si financias** / **Cards · if you finance** group | One row per card whose latest statement printed a cost of carry. Name, `currency · XX% APR · as of <statement date>`, amount in the card's currency |
| Card B (no statement) | **Not** listed |
| Cards subtotal | "Per month (DOP)". The sum of card rows converted to base currency |
| **Préstamos · pagado** / **Loans · paid** group | One row per loan with a logged payment. `as of <last payment date>`, interest from that payment |
| Loan subtotals | "Per month (DOP)" plus a muted "Recorded in 2026 (DOP)" |
| **No grand total** | There must be no line adding cards and loans together |
| Row order (cards) | Largest cost first |
| Click a card row | Lands on that card's `/accounts/<id>` |
| Click a loan row | Lands on that loan's page |
| Row hover | Subtle background highlight |
| A group with no rows | That whole group (heading + subtotal) is absent |
| Account with no statements and no loan payments | Empty copy ("Import a card statement or log a loan payment…") + **Import statement** button |

📱 At 360px the two debt cards stack. Long card names truncate, and amounts stay on one line.

---

## 3. Card detail page — Boleta de la tarjeta

### Card A (has statements)

Open Card A's page.

| Check | Expected |
|---|---|
| Hero panel (beside the card face) | Balance owed, "As of the … statement", utilization bar, "Payment due…". **No** cashback line, fees line, or welcome-bonus bar |
| New section directly under the hero | Title **Card report** / **Boleta de la tarjeta** |
| Order below it | Boleta → Spend by category → Statements → Activity |
| **Cost of carry** row | Detail `XX% APR · if you finance · as of <date>` (es: `XX% anual · si financias · al <fecha>`), amount in the card's currency. Should match that card's row on Insights |
| **Cashback in 2026** | Shown only if some 2026 statement reported cashback. Matches the sum of the statements' cashback |
| **Fees & insurance in 2026** | Shown only if non-zero. If the only fee is a reversal of a prior year's charge, the label reads "…refunded…" and the amount has **no minus sign** |
| **Penalty fees in 2026** | Same rules as above |
| **Paid to this card this month** / **Pagado a esta tarjeta este mes** | Shown only if a payment into this card was logged this calendar month. The amount is in the card's currency, even when paid from a different-currency account |
| Year prints as `2026` | Not `2,026` |
| **Welcome bonus** (only if the card, or its group, has an unexpired bonus goal) | Progress bar and "X of Y spent, due <date>" at the bottom of the Boleta, separated by a rule |

Quick cross-check: log a payment into Card A dated today → reload → the "Paid to this card" row
appears or increases. Delete it → the row disappears (or goes back to its previous amount).

### Card B (no statements)

| Check | Expected |
|---|---|
| Boleta section | Still present, with one muted line: "This fills in as you import this card's statements below." / "Se va llenando a medida que importas abajo los estados de cuenta de esta tarjeta." |
| Import button in the Boleta | **None** (on purpose, because the Statements panel below imports into this card) |
| Card B with an active welcome bonus but no statements | Shows the bonus bar only, with no empty line and no top rule above the bar |

### Card group

Open one currency line of a grouped card (e.g. USD line), then switch to the other line via the rail.

| Check | Expected |
|---|---|
| Boleta figures | Belong to the line you're on, in that line's currency. They are not combined across lines |

📱 At 360px, Spanish: Boleta labels wrap under the amount column without pushing amounts off-screen,
and there is no horizontal scroll.

---

## 4. Bank / investment account — "Paid in 2026"

Open the Checking account.

| Check | Expected |
|---|---|
| **Transfer fees** / **Comisiones de transferencia** card | Existing three settings (tax rate, network fee, fee is…) unchanged |
| New block under a rule | "Paid in 2026" / "Pagado en 2026" with **Fees** and **Tax** figures in the account's currency |
| Counts expenses too | Log an **expense** from this account with tax and commission on → reload → both figures go up by that transaction's tax and fee |
| Counts transfers | Same with a transfer out of this account |
| Same-bank transfer with commission on | Fee does **not** increase (commission is waived same-bank), but tax still does if tax is on |
| Money coming **in** | A transfer *into* this account does not change its figures (the charges belong to the sending account) |
| Account with no charges this year | Shows `RD$0.00` for both. Zero is shown here on purpose |
| Credit card, loan, cash, asset pages | No Transfer fees card at all (unchanged) |

---

## 5. Help guide

Open `/help`.

| Check | Expected |
|---|---|
| Insights chapter intro | Names the four questions, and says the middle band follows the picked month |
| Insights bullets | Cash flow, Spend distribution, Budget, Debt health, **What your debt costs**. No cost of carry / cashback / cost of ownership / loan interest bullets |
| Wallet chapter → "On an account's page" | One **card report / Boleta** bullet replaces the separate cashback and cost-of-ownership bullets. The activity bullet mentions fees and tax paid this year |
| Statements paragraph | Says imports fill "each card's report … and the debt cost card in Insights" |
| Switch to Spanish | Same structure, no English leaking through, no raw keys like `Help.insightsDebtCost` |

---

## 6. Regression spot-checks

| Check | Expected |
|---|---|
| Overview | Unchanged: Disponible hero, net worth secondary stat, FX warning if rates are down |
| `/budgets` → savings goals | Still there and working (only the Insights *copy* of goals was removed) |
| FX degraded (if you can simulate it) | Insights warning still shows at the top of the page |
| Any page, both locales | No `MISSING_MESSAGE` errors in the browser console |

---

## Reporting back

If everything passes, tick the first **Remaining** box under UX-07 in
`docs/product-audit-dominican-market.md`. For a failure, note the section/row number above,
the account, the locale and the viewport width.
