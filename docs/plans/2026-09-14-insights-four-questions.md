# Insights Four Questions + Boleta de la tarjeta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Insights to cards answering four questions, move per-card figures to a "Boleta de la tarjeta" on the card detail page, and move transfer costs to the bank/investment account page.

**Architecture:** Pure helpers (`buildDebtCost`, `sumAccountTransferCosts`) are unit-tested. Per-account Supabase queries go in `lib/accounts/queries.ts`. Two new presentational components (`components/insights/debt-cost.tsx`, `components/accounts/card-report.tsx`) take already-computed props. Pages stay data-loaders. Page-wide Insights queries that lose their last caller are deleted.

**Tech Stack:** Next.js App Router (server components), Supabase JS, next-intl (`messages/en.json`, `messages/es.json`), Tailwind, vitest.

**Spec:** `docs/specs/2026-09-14-insights-four-questions-design.md`

## Global Constraints

- Every user-facing string goes in BOTH `messages/en.json` and `messages/es.json`. Spanish copy is Dominican-neutral, with no finance jargon.
- Year arguments to ICU messages are passed as `String(year)`. A number would render as "2,026".
- A figure with no data behind it is not rendered ("silence rather than a confident RD$0"). The one exception is transfer costs: zeros render, because the trigger derives every fee and tax on write.
- Negative fee subtotals show their magnitude, and the label switches to the "refunded" variant.
- Card carry and loan interest are never summed into one total.
- Boleta and transfer-cost figures stay in the account's own currency. No FX.
- Verify git results with `git --no-pager` or `rtk proxy git …`, because the RTK proxy mangles git output.
- Ask the user before starting or killing the dev server.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YLrTbrF41yPrJGuo34Zxfn
  ```
- Checks: `npx vitest run <path>`, `npx tsc --noEmit`, `npx eslint <paths>`.

---

### Task 1: `buildDebtCost` pure grouping

**Files:**
- Create: `lib/insights/debt-cost.ts`
- Test: `lib/insights/debt-cost.test.ts`

**Interfaces:**
- Consumes: `CostOfCarry`, `LoanInterest` types from `lib/insights/queries.ts` (existing, unchanged).
- Produces:
  ```ts
  export type DebtCostRow = { accountId: string; name: string; currency: string; apr: number | null; asOf: string; amount: number };
  export type DebtCost = {
    baseCurrency: string;
    year: number;
    cards: DebtCostRow[];
    cardsMonthlyBase: number;
    loans: DebtCostRow[];
    loansMonthlyBase: number;
    loansYearBase: number;
  };
  export function buildDebtCost(carry: CostOfCarry, loanInterest: LoanInterest): DebtCost;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/insights/debt-cost.test.ts
import { describe, expect, it } from "vitest";
import { buildDebtCost } from "./debt-cost";
import type { CostOfCarry, LoanInterest } from "./queries";

const carry = (lines: CostOfCarry["lines"], totalBase = 0): CostOfCarry => ({
  baseCurrency: "DOP",
  lines,
  totalBase,
});
const loans = (over: Partial<LoanInterest> = {}): LoanInterest => ({
  year: 2026,
  baseCurrency: "DOP",
  lines: [],
  monthlyBase: 0,
  yearBase: 0,
  ...over,
});
const carryLine = (over: Partial<CostOfCarry["lines"][number]> = {}) => ({
  accountId: "c1",
  name: "Visa",
  currency: "DOP",
  periodEnd: "2026-08-31",
  apr: 60,
  avgDailyBalance: 10000,
  costOfCarry: 500,
  costOfCarryBase: 500,
  ...over,
});

describe("buildDebtCost", () => {
  it("keeps cards and loans in separate groups with their own subtotals", () => {
    const result = buildDebtCost(
      carry([carryLine()], 500),
      loans({
        lines: [
          { accountId: "l1", name: "Auto", currency: "DOP", apr: 12, lastPaymentDate: "2026-09-01", lastInterest: 900, yearInterest: 7000 },
        ],
        monthlyBase: 900,
        yearBase: 7000,
      }),
    );
    expect(result.cards).toEqual([
      { accountId: "c1", name: "Visa", currency: "DOP", apr: 60, asOf: "2026-08-31", amount: 500 },
    ]);
    expect(result.cardsMonthlyBase).toBe(500);
    expect(result.loans).toEqual([
      { accountId: "l1", name: "Auto", currency: "DOP", apr: 12, asOf: "2026-09-01", amount: 900 },
    ]);
    expect(result.loansMonthlyBase).toBe(900);
    expect(result.loansYearBase).toBe(7000);
    expect(result.year).toBe(2026);
    expect(result.baseCurrency).toBe("DOP");
  });

  it("drops cards whose latest statement reported no cost of carry", () => {
    const result = buildDebtCost(
      carry([carryLine(), carryLine({ accountId: "c2", costOfCarry: null, costOfCarryBase: null })], 500),
      loans(),
    );
    expect(result.cards.map((r) => r.accountId)).toEqual(["c1"]);
  });

  it("sorts cards by base-currency cost, largest first", () => {
    const result = buildDebtCost(
      carry([
        carryLine({ accountId: "small", costOfCarry: 10, costOfCarryBase: 600, currency: "USD" }),
        carryLine({ accountId: "big", costOfCarry: 900, costOfCarryBase: 900 }),
      ]),
      loans(),
    );
    expect(result.cards.map((r) => r.accountId)).toEqual(["big", "small"]);
    expect(result.cardsMonthlyBase).toBe(1500);
  });

  it("returns empty groups when there is nothing to report", () => {
    const result = buildDebtCost(carry([]), loans());
    expect(result.cards).toEqual([]);
    expect(result.loans).toEqual([]);
    expect(result.cardsMonthlyBase).toBe(0);
    expect(result.loansMonthlyBase).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run lib/insights/debt-cost.test.ts`
Expected: FAIL, cannot resolve `./debt-cost`.

- [ ] **Step 3: Implement**

```ts
// lib/insights/debt-cost.ts
import type { CostOfCarry, LoanInterest } from "./queries";

export type DebtCostRow = {
  accountId: string;
  name: string;
  currency: string;
  apr: number | null;
  /** Statement period end for a card, last payment date for a loan. */
  asOf: string;
  /** Native currency. */
  amount: number;
};

export type DebtCost = {
  baseCurrency: string;
  year: number;
  cards: DebtCostRow[];
  cardsMonthlyBase: number;
  loans: DebtCostRow[];
  loansMonthlyBase: number;
  loansYearBase: number;
};

/**
 * The Insights "what is my debt costing me" card, as two groups that are never
 * summed together.
 *
 * A card's cost of carry is a projection — what the issuer WOULD charge to
 * finance the balance ("Interés si Opta Por Financiar"). A loan's interest is
 * money already paid. Both are monthly-shaped, but one total over a
 * hypothetical and a charge would be a figure that describes nothing, so each
 * group closes on its own subtotal.
 *
 * Cards whose newest statement printed no carry figure are dropped rather than
 * shown at zero — the statement was silent, not free.
 */
export function buildDebtCost(carry: CostOfCarry, loanInterest: LoanInterest): DebtCost {
  const cardLines = carry.lines
    .filter((l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null)
    .sort((a, b) => (b.costOfCarryBase ?? 0) - (a.costOfCarryBase ?? 0));

  return {
    baseCurrency: carry.baseCurrency,
    year: loanInterest.year,
    cards: cardLines.map((l) => ({
      accountId: l.accountId,
      name: l.name,
      currency: l.currency,
      apr: l.apr,
      asOf: l.periodEnd,
      amount: l.costOfCarry,
    })),
    cardsMonthlyBase: cardLines.reduce((s, l) => s + (l.costOfCarryBase ?? 0), 0),
    loans: loanInterest.lines.map((l) => ({
      accountId: l.accountId,
      name: l.name,
      currency: l.currency,
      apr: l.apr,
      asOf: l.lastPaymentDate,
      amount: l.lastInterest,
    })),
    loansMonthlyBase: loanInterest.monthlyBase,
    loansYearBase: loanInterest.yearBase,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run lib/insights/debt-cost.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/insights/debt-cost.ts lib/insights/debt-cost.test.ts
git commit -m "feat(insights): group debt cost into card carry and loan interest"
```

---

### Task 2: Per-account queries (transfer costs, cost of carry, card payments)

**Files:**
- Create: `lib/accounts/transfer-costs.ts`
- Test: `lib/accounts/transfer-costs.test.ts`
- Modify: `lib/accounts/queries.ts` (append three exported functions)

**Interfaces:**
- Produces:
  ```ts
  // lib/accounts/transfer-costs.ts
  export type TransferCostRow = { fee_amount: number | null; tax_amount: number | null };
  export function sumAccountTransferCosts(rows: TransferCostRow[]): { fees: number; tax: number };
  // lib/accounts/queries.ts
  export async function getAccountTransferCosts(accountId: string, year: number): Promise<{ fees: number; tax: number }>;
  export type AccountCostOfCarry = { periodEnd: string; apr: number | null; costOfCarry: number };
  export async function getAccountCostOfCarry(accountId: string): Promise<AccountCostOfCarry | null>;
  export async function getCardPaymentsInMonth(accountId: string, month: string): Promise<number>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// lib/accounts/transfer-costs.test.ts
import { describe, expect, it } from "vitest";
import { sumAccountTransferCosts } from "./transfer-costs";

describe("sumAccountTransferCosts", () => {
  it("sums fees and tax separately, in the account's own currency", () => {
    expect(
      sumAccountTransferCosts([
        { fee_amount: 50, tax_amount: 15 },
        { fee_amount: 0, tax_amount: 3.5 },
      ]),
    ).toEqual({ fees: 50, tax: 18.5 });
  });

  it("treats null amounts as zero", () => {
    expect(sumAccountTransferCosts([{ fee_amount: null, tax_amount: null }])).toEqual({ fees: 0, tax: 0 });
  });

  it("returns zeros for no rows", () => {
    expect(sumAccountTransferCosts([])).toEqual({ fees: 0, tax: 0 });
  });

  it("rounds to cents", () => {
    expect(
      sumAccountTransferCosts([
        { fee_amount: 0.1, tax_amount: 0.0015 },
        { fee_amount: 0.2, tax_amount: 0.0015 },
      ]),
    ).toEqual({ fees: 0.3, tax: 0 });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run lib/accounts/transfer-costs.test.ts`
Expected: FAIL, cannot resolve `./transfer-costs`.

- [ ] **Step 3: Implement the pure helper**

```ts
// lib/accounts/transfer-costs.ts
export type TransferCostRow = { fee_amount: number | null; tax_amount: number | null };

/**
 * Fees and tax one account paid this year, in its own currency.
 *
 * Every row is a transaction whose `account_id` is this account, so no FX:
 * transactions_compute_amounts() derives tax from the source account's
 * transfer_tax_rate and commission from its network_fee_amount, both in that
 * account's currency, on ANY transaction type — an expense paid from checking
 * carries them just like a transfer does.
 */
export function sumAccountTransferCosts(rows: TransferCostRow[]): { fees: number; tax: number } {
  let fees = 0;
  let tax = 0;
  for (const r of rows) {
    fees += Number(r.fee_amount ?? 0);
    tax += Number(r.tax_amount ?? 0);
  }
  return { fees: Math.round(fees * 100) / 100, tax: Math.round(tax * 100) / 100 };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run lib/accounts/transfer-costs.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Add the three queries to `lib/accounts/queries.ts`**

Add the import at the top next to the other `./` imports:

```ts
import { sumAccountTransferCosts, type TransferCostRow } from "./transfer-costs";
```

Append after `getCardSpendByCategory`:

```ts
/**
 * Fees and tax this account paid in `year`, across every transaction type.
 *
 * Not payments only: the trigger that fills fee_amount/tax_amount runs on any
 * type, so an expense from a checking account carries both.
 *
 * Paged because PostgREST caps a request at `max_rows` (1000, see
 * supabase/config.toml) silently — a busy account would under-report with no
 * signal that it had.
 */
export async function getAccountTransferCosts(
  accountId: string,
  year: number,
): Promise<{ fees: number; tax: number }> {
  const supabase = await createClient();
  const PAGE_SIZE = 1000;
  const rows: TransferCostRow[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("fee_amount,tax_amount")
      .eq("account_id", accountId)
      .gte("occurred_at", `${year}-01-01`)
      .lt("occurred_at", `${year + 1}-01-01`)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return sumAccountTransferCosts(rows);
}

export type AccountCostOfCarry = { periodEnd: string; apr: number | null; costOfCarry: number };

/** This card's cost of carry from its newest statement, or null when there is
 *  no statement or the statement printed no figure. The view already picks the
 *  latest statement per line — see card_cost_of_carry. */
export async function getAccountCostOfCarry(accountId: string): Promise<AccountCostOfCarry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_cost_of_carry")
    .select("period_end,interest_rate_annual,cost_of_carry")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data || data.cost_of_carry === null) return null;
  return {
    periodEnd: data.period_end ?? "",
    apr: data.interest_rate_annual === null ? null : Number(data.interest_rate_annual),
    costOfCarry: Number(data.cost_of_carry),
  };
}

/** What was paid INTO this card during `month` (a "YYYY-MM-01" string), in the
 *  card's own currency — `to_amount` when the payment crossed currencies. */
export async function getCardPaymentsInMonth(accountId: string, month: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("amount,to_amount")
    .eq("type", "payment")
    .eq("to_account_id", accountId)
    .gte("occurred_at", month)
    .lt("occurred_at", addMonths(month, 1));
  const total = (data ?? []).reduce((s, r) => s + Number(r.to_amount ?? r.amount ?? 0), 0);
  return Math.round(total * 100) / 100;
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `card_cost_of_carry` column types reject `.maybeSingle()`, check `lib/supabase/types.ts:1349`. The view exposes those columns as nullable.

- [ ] **Step 7: Commit**

```bash
git add lib/accounts/transfer-costs.ts lib/accounts/transfer-costs.test.ts lib/accounts/queries.ts
git commit -m "feat(accounts): per-account transfer costs, cost of carry and card payments"
```

---

### Task 3: Boleta de la tarjeta on the card detail page

**Files:**
- Create: `components/accounts/card-report.tsx`
- Modify: `app/(app)/accounts/[id]/page.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`AccountDetail` namespace)

**Interfaces:**
- Consumes: `getAccountCostOfCarry`, `getCardPaymentsInMonth`, `AccountCostOfCarry` (Task 2).
- Produces:
  ```ts
  export type CardReportProps = {
    currency: string;
    locale: string;
    year: number;
    monthLabel: string;
    carry: AccountCostOfCarry | null;
    cashback: number | null;          // null = no statement reported a figure
    fees: { recurring: number; incidents: number };
    paymentsThisMonth: number;
    bonus: { spent: number; goal: number; goalCurrency: string; dueDate: string } | null;
  };
  export function CardReport(props: CardReportProps): JSX.Element;
  ```

- [ ] **Step 1: Add messages**

In `messages/en.json` → `AccountDetail`, add:

```json
"cardReportTitle": "Card report",
"cardReportEmpty": "This fills in as you import this card's statements.",
"cardReportCarry": "Cost of carry",
"cardReportCarryDetail": "if you finance · as of {date}",
"cardReportCarryApr": "{rate}% APR",
"cardReportCashback": "Cashback in {year}",
"cardReportOwnership": "Fees & insurance in {year}",
"cardReportOwnershipRefunded": "Fees & insurance refunded in {year}",
"cardReportIncidents": "Penalty fees in {year}",
"cardReportIncidentsRefunded": "Penalty fees refunded in {year}",
"cardReportPayments": "Paid to this card in {month}"
```

In `messages/es.json` → `AccountDetail`, add:

```json
"cardReportTitle": "Boleta de la tarjeta",
"cardReportEmpty": "Se va llenando a medida que importas los estados de cuenta de esta tarjeta.",
"cardReportCarry": "Costo de financiamiento",
"cardReportCarryDetail": "si financias · al {date}",
"cardReportCarryApr": "{rate}% anual",
"cardReportCashback": "Cashback en {year}",
"cardReportOwnership": "Cargos y seguros en {year}",
"cardReportOwnershipRefunded": "Cargos y seguros reembolsados en {year}",
"cardReportIncidents": "Cargos por penalidad en {year}",
"cardReportIncidentsRefunded": "Penalidades reembolsadas en {year}",
"cardReportPayments": "Pagado a esta tarjeta en {month}"
```

Remove these `AccountDetail` keys from BOTH files, because they now have no caller: `cashbackThisYear`, `costOfOwnershipThisYear`, `costOfOwnershipRefundedThisYear`, `incidentFeesThisYear`, `incidentFeesRefundedThisYear`. Keep `welcomeBonusProgress` and `welcomeBonusDetail`; the Boleta reuses them.

- [ ] **Step 2: Create the component**

```tsx
// components/accounts/card-report.tsx
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ImportButton } from "@/components/statements/import-button";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { AccountCostOfCarry } from "@/lib/accounts/queries";

export type CardReportProps = {
  currency: string;
  locale: string;
  year: number;
  monthLabel: string;
  carry: AccountCostOfCarry | null;
  /** null when no statement this year reported a cashback figure. */
  cashback: number | null;
  fees: { recurring: number; incidents: number };
  paymentsThisMonth: number;
  bonus: { spent: number; goal: number; goalCurrency: string; dueDate: string } | null;
};

function Row({ label, detail, amount }: { label: string; detail?: string; amount: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="text-foreground">{label}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <span className="shrink-0 tabular-nums text-foreground">{amount}</span>
    </div>
  );
}

/**
 * Boleta de la tarjeta — the standing facts that let someone judge this card
 * against another one: what financing costs, what it pays back, what it charges
 * to hold, what went into it this month, and the welcome bonus still in play.
 *
 * Each row renders only when it has real data. A card with no statement yet
 * shows a single line instead of five confident zeros — and the section itself
 * stays, so its absence never reads as a failed load.
 *
 * Costs and cashback sit side by side and are never netted: most of a card's
 * benefits never reach a statement, so a net figure would be wrong in one
 * direction. Every amount is in the card's own currency.
 */
export function CardReport({
  currency,
  locale,
  year,
  monthLabel,
  carry,
  cashback,
  fees,
  paymentsThisMonth,
  bonus,
}: CardReportProps) {
  const t = useTranslations("AccountDetail");
  const y = String(year);
  const money = (n: number) => formatMoney(Math.abs(n), currency);

  const rows: React.ReactNode[] = [];
  if (carry) {
    rows.push(
      <Row
        key="carry"
        label={t("cardReportCarry")}
        detail={[
          carry.apr !== null ? t("cardReportCarryApr", { rate: carry.apr }) : null,
          t("cardReportCarryDetail", { date: formatDate(carry.periodEnd, locale) }),
        ]
          .filter(Boolean)
          .join(" · ")}
        amount={formatMoney(carry.costOfCarry, currency)}
      />,
    );
  }
  if (cashback !== null) {
    rows.push(<Row key="cashback" label={t("cardReportCashback", { year: y })} amount={money(cashback)} />);
  }
  if (fees.recurring !== 0) {
    rows.push(
      <Row
        key="ownership"
        label={t(fees.recurring < 0 ? "cardReportOwnershipRefunded" : "cardReportOwnership", { year: y })}
        amount={money(fees.recurring)}
      />,
    );
  }
  if (fees.incidents !== 0) {
    rows.push(
      <Row
        key="incidents"
        label={t(fees.incidents < 0 ? "cardReportIncidentsRefunded" : "cardReportIncidents", { year: y })}
        amount={money(fees.incidents)}
      />,
    );
  }
  if (paymentsThisMonth !== 0) {
    rows.push(
      <Row
        key="payments"
        label={t("cardReportPayments", { month: monthLabel })}
        amount={money(paymentsThisMonth)}
      />,
    );
  }

  const bonusPct = bonus ? (bonus.spent / bonus.goal) * 100 : 0;

  return (
    <Card className="gap-0 p-6">
      <h2 className="mb-4 text-lg font-medium text-foreground">{t("cardReportTitle")}</h2>
      {rows.length === 0 && !bonus ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("cardReportEmpty")}</p>
          <ImportButton size="sm" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows}
          {bonus ? (
            <div className={`space-y-2 ${rows.length > 0 ? "border-t pt-3" : ""}`}>
              <div className="flex justify-between text-sm text-foreground">
                <span>{t("welcomeBonusProgress")}</span>
                <span className="tabular-nums">{formatPercent(bonusPct)}</span>
              </div>
              <Progress value={Math.min(Math.max(bonusPct, 0), 100)} />
              <p className="text-xs text-muted-foreground">
                {t("welcomeBonusDetail", {
                  spent: formatMoney(bonus.spent, bonus.goalCurrency),
                  goal: formatMoney(bonus.goal, bonus.goalCurrency),
                  date: formatDate(bonus.dueDate, locale),
                })}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Wire it into `app/(app)/accounts/[id]/page.tsx`**

1. Update the imports:
   - Add `getAccountCostOfCarry` and `getCardPaymentsInMonth` to the `@/lib/accounts/queries` import list.
   - Add `import { CardReport } from "@/components/accounts/card-report";`.
   - Remove `Progress` and `formatPercent` only if nothing else uses them. `formatPercent` is still used by utilization and the transfer-fees card, and `Progress` by utilization and loans, so both stay.
2. Replace the `spendSlices` block and the `cardFees` block so the three card-only round trips run together. Keep their existing comments.

```ts
  const spendMonth = monthStart();
  const feeYear = new Date().getFullYear();
  const [spendSlices, feeLines, carry, paymentsThisMonth] = isCardType
    ? await Promise.all([
        getCardSpendByCategory(id, spendMonth, t("uncategorized")),
        getAccountFeeLines(id, feeYear),
        getAccountCostOfCarry(id),
        getCardPaymentsInMonth(id, spendMonth),
      ])
    : [[], [], null, 0];
  const spendMonthTotal = spendTotal(spendSlices);
  const cardFees = isCardType
    ? summarizeCardFees(feeLines, feeYear)
    : { recurring: 0, incidents: 0, counted: 0 };
```

   If TypeScript widens the tuple badly, annotate the fallback as `[[] as SpendSlice[], [] as FeeLineRow[], null, 0] as const` and import the types from `@/lib/accounts/card-spend` and `@/lib/accounts/card-fees`.
3. In the hero's `isCardType` branch, delete the `showBonus` block, the `cashbackReported` paragraph, and the two `cardFees.*` paragraphs, along with their comments. Utilization, the statement anchor line and `paymentDueEachMonth` stay.
4. Directly after the hero `</Card>` (before the `!isCardType && !isLoanType` balance chart), insert:

```tsx
      {/* Boleta de la tarjeta. Sits right under the hero because it is the
          card's standing record — what it costs, what it pays back — and comes
          before what the card was used for this month. These figures used to be
          split between the hero and cards on Insights; a person comparing two
          cards opens the cards. */}
      {isCardType ? (
        <CardReport
          currency={currency}
          locale={locale}
          year={feeYear}
          monthLabel={monthLabel(spendMonth, locale)}
          carry={carry}
          cashback={cashbackReported ? cashbackTotal : null}
          fees={cardFees}
          paymentsThisMonth={paymentsThisMonth}
          bonus={
            showBonus
              ? {
                  spent: bonusSpent,
                  goal: effectiveBonus!.welcome_bonus_goal_amount!,
                  goalCurrency: effectiveBonus!.welcome_bonus_goal_currency!,
                  dueDate: effectiveBonus!.welcome_bonus_due_date!,
                }
              : null
          }
        />
      ) : null}
```

   `bonusPct` is now computed inside the component. Delete its line from the page.

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npx eslint "app/(app)/accounts/[id]/page.tsx" components/accounts/card-report.tsx`
Expected: clean.

Run: `grep -rn "cashbackThisYear\|costOfOwnershipThisYear\|incidentFeesThisYear\|incidentFeesRefundedThisYear\|costOfOwnershipRefundedThisYear" app components lib`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add components/accounts/card-report.tsx "app/(app)/accounts/[id]/page.tsx" messages/en.json messages/es.json
git commit -m "feat(accounts): boleta de la tarjeta on the card's own page"
```

---

### Task 4: Transfer costs paid on bank/investment account pages

**Files:**
- Modify: `app/(app)/accounts/[id]/page.tsx` (the `hasTransferFees(type)` card)
- Modify: `messages/en.json`, `messages/es.json` (`AccountDetail`)

**Interfaces:**
- Consumes: `getAccountTransferCosts(accountId, year)` (Task 2).

- [ ] **Step 1: Add messages**

en `AccountDetail`:
```json
"transferPaidIn": "Paid in {year}",
"transferPaidFees": "Fees",
"transferPaidTax": "Tax"
```
es `AccountDetail`:
```json
"transferPaidIn": "Pagado en {year}",
"transferPaidFees": "Comisiones",
"transferPaidTax": "Impuestos"
```

- [ ] **Step 2: Fetch**

In the page, after the `cardFees` block:

```ts
  /* What this account has actually paid in transfer tax and network fees this
   * year, on every kind of transaction drawn from it — not just transfers. The
   * settings card below says what it WOULD charge; this says what it did.
   * Only issued for the types that can carry the charges at all. */
  const transferPaid = hasTransferFees(type)
    ? await getAccountTransferCosts(id, feeYear)
    : null;
```

Add `getAccountTransferCosts` to the `@/lib/accounts/queries` import.

- [ ] **Step 3: Render**

Inside the `hasTransferFees(type)` card, after the closing `</dl>`:

```tsx
        {/* Zeros are shown, unlike the card report's silent rows: the trigger
            derives every fee and tax on write, so a zero here is a real answer
            rather than missing data. */}
        {transferPaid ? (
          <div className="mt-5 border-t pt-4">
            <p className="text-sm font-medium text-foreground">
              {t("transferPaidIn", { year: String(feeYear) })}
            </p>
            <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("transferPaidFees")}</dt>
                <dd className="tabular-nums">{formatMoney(transferPaid.fees, currency)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("transferPaidTax")}</dt>
                <dd className="tabular-nums">{formatMoney(transferPaid.tax, currency)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
```

While in that block, re-indent the `<Card>` under `{hasTransferFees(type) ? (` so it sits one level in, matching the rest of the file.

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npx eslint "app/(app)/accounts/[id]/page.tsx"`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/accounts/[id]/page.tsx" messages/en.json messages/es.json
git commit -m "feat(accounts): show the transfer fees and tax an account actually paid"
```

---

### Task 5: Insights — three bands, Debt cost card, dead code removed

**Files:**
- Create: `components/insights/debt-cost.tsx`
- Modify: `app/(app)/insights/page.tsx`
- Modify: `app/(app)/insights/loading.tsx`
- Modify: `lib/insights/queries.ts` (delete dead functions and types; fix comments)
- Modify: `lib/insights/queries.test.ts` (delete tests for deleted functions)
- Delete: `components/insights/savings-goals.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Insights`)

**Interfaces:**
- Consumes: `buildDebtCost`, `DebtCost` (Task 1); `getCostOfCarry`, `getLoanInterest` (existing).
- Produces: `export function DebtCostList({ data, locale }: { data: DebtCost; locale: string }): JSX.Element`

- [ ] **Step 1: Messages (`Insights` namespace)**

en, add:
```json
"debtCostTitle": "What your debt costs",
"debtCostCards": "Cards · if you finance",
"debtCostLoans": "Loans · paid",
"debtCostCardsMonthly": "Per month ({currency})",
"debtCostEmpty": "Import a card statement or log a loan payment to see what your debt costs."
```
es, add:
```json
"debtCostTitle": "Lo que te cuesta la deuda",
"debtCostCards": "Tarjetas · si financias",
"debtCostLoans": "Préstamos · pagado",
"debtCostCardsMonthly": "Por mes ({currency})",
"debtCostEmpty": "Importa un estado de cuenta o registra un pago de préstamo para ver lo que te cuesta la deuda."
```
en, change `pageDescription` to `"Is your net worth moving, where the money went, whether you're on pace, and what your debt costs."`
es, change `pageDescription` to `"Si tu patrimonio se mueve, a dónde fue el dinero, si vas a buen ritmo y cuánto te cuesta la deuda."`

Remove from BOTH files: `cardCardPayments`, `cardPaymentsEmpty`, `cardPaymentsTotal`, `costOfCarryTitle`, `costOfCarryTotal`, `costOfCarryEmpty`, `loanInterestTitle`, `loanInterestEmpty`, `cashbackTitle`, `cashbackEmpty`, `cashbackTotal`, `cardFeesTitle`, `cardFeesRecurring`, `cardFeesRecurringRefunded`, `cardFeesIncidents`, `cardFeesIncidentsRefunded`, `cardFeesIncidentsRow`, `cardFeesRefundedRow`, `cardFeesEmpty`, `transferCostsTitle`, `transferFeesLabel`, `transferTaxLabel`, `cardSavingsGoals`, `savingsGoalsTotal`, `savingsGoalsEmpty`.

Keep: `costOfCarryApr`, `costOfCarryAsOf`, `loanInterestMonthly`, `loanInterestRecorded`. The Debt cost card reuses them.

- [ ] **Step 2: Create `components/insights/debt-cost.tsx`**

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ImportButton } from "@/components/statements/import-button";
import { formatDate, formatMoney } from "@/lib/format";
import type { DebtCost, DebtCostRow } from "@/lib/insights/debt-cost";

function Rows({ rows, locale }: { rows: DebtCostRow[]; locale: string }) {
  const t = useTranslations("Insights");
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Link
          key={r.accountId}
          href={`/accounts/${r.accountId}`}
          className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted"
        >
          <div className="min-w-0">
            <p className="truncate text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">
              {r.currency} · {r.apr !== null ? `${t("costOfCarryApr", { rate: r.apr })} · ` : ""}
              {t("costOfCarryAsOf", { date: formatDate(r.asOf, locale) })}
            </p>
          </div>
          <span className="shrink-0 tabular-nums text-foreground">{formatMoney(r.amount, r.currency)}</span>
        </Link>
      ))}
    </div>
  );
}

function Subtotal({ label, amount, muted }: { label: string; amount: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{amount}</span>
    </div>
  );
}

/**
 * Two groups, never one total. Card carry is what financing WOULD cost; loan
 * interest is what was paid. See buildDebtCost. Each row links to the account,
 * where the card's full Boleta or the loan's schedule lives.
 */
export function DebtCostList({ data, locale }: { data: DebtCost; locale: string }) {
  const t = useTranslations("Insights");
  const cur = data.baseCurrency;

  if (data.cards.length === 0 && data.loans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("debtCostEmpty")}</p>
        <ImportButton size="sm" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.cards.length > 0 ? (
        <section className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("debtCostCards")}</h4>
          <Rows rows={data.cards} locale={locale} />
          <div className="border-t pt-3">
            <Subtotal label={t("debtCostCardsMonthly", { currency: cur })} amount={formatMoney(data.cardsMonthlyBase, cur)} />
          </div>
        </section>
      ) : null}
      {data.loans.length > 0 ? (
        <section className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("debtCostLoans")}</h4>
          <Rows rows={data.loans} locale={locale} />
          <div className="space-y-1.5 border-t pt-3">
            <Subtotal label={t("loanInterestMonthly", { currency: cur })} amount={formatMoney(data.loansMonthlyBase, cur)} />
            <Subtotal
              muted
              label={t("loanInterestRecorded", { year: String(data.year), currency: cur })}
              amount={formatMoney(data.loansYearBase, cur)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/(app)/insights/page.tsx`**

Keep `ChartCard`, `Section` and the month nav exactly as they are. Delete `Tally`, which has no caller left. Replace everything from the imports down to the return with the following.

Imports:

```tsx
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  Gauge,
  PieChart,
  BarChart3,
  HeartPulse,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { Card } from "@/components/ui/card";
import { getInsights, getCostOfCarry, getLoanInterest } from "@/lib/insights/queries";
import { buildDebtCost } from "@/lib/insights/debt-cost";
import { getNetWorthHistory } from "@/lib/insights/net-worth-history";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import { SpendDonut, CashflowChart, SpendingPace, NetWorthChart } from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { DebtCostList } from "@/components/insights/debt-cost";
```

Data loading:

```tsx
  const [insights, carry, netWorth, loanInterest] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getNetWorthHistory(),
    getLoanInterest(),
  ]);
  const cur = insights.baseCurrency;
  const t = await getTranslations("Insights");
  const locale = await getLocale();
  const debtCost = buildDebtCost(carry, loanInterest);
```

Body after `<FxDegradedNotice …/>`. Replace the long ordering comment with a short one that matches the new structure:

```tsx
      {/* Four questions, three clocks, one band per clock: is my net worth
          moving (trend), where did this month's money go and am I on pace (the
          picked month — every card in that band obeys the picker in its
          heading), and what does my debt cost (now). Anything that answered a
          different question moved to the account it belongs to: per-card
          figures to the card's Boleta, transfer fees and tax to the bank
          account's page.

          Container query, not a viewport one, because the shell around these
          grids changes width: the sidebar takes 256px from `md` up and `main`
          adds 48px of padding. 34rem is that chrome subtracted from the ~850px
          viewport where the split is wanted. */}
      <div className="@container space-y-10">
        <Section title={t("sectionPosition")}>
          <ChartCard title={t("cardNetWorth")} icon={TrendingUp} className="@[34rem]:col-span-2">
            <NetWorthChart data={netWorth.points} currency={netWorth.baseCurrency} />
          </ChartCard>
          <ChartCard title={t("cardCashFlow")} icon={ArrowLeftRight} className="@[34rem]:col-span-2">
            <CashflowChart data={insights.trend} currency={cur} />
          </ChartCard>
        </Section>

        <Section title={t("sectionThisMonth")} actions={monthNav}>
          <ChartCard title={t("cardSpendingPace")} basis={t("basisWhenCharged")} icon={Gauge} className="@[34rem]:col-span-2">
            <SpendingPace data={insights.pace} currency={cur} />
          </ChartCard>
          <ChartCard title={t("cardSpendDistribution")} basis={t("basisWhenCharged")} icon={PieChart} className="@[34rem]:col-span-2">
            <SpendDonut data={insights.distribution} total={insights.totalSpend} currency={cur} />
          </ChartCard>
          <ChartCard
            title={insights.budgetBarsBy === "group" ? t("cardExpensesVsBudgetGroups") : t("cardExpensesVsBudget")}
            basis={t("basisWhenPaid")}
            icon={BarChart3}
            className="@[34rem]:col-span-2"
          >
            <BudgetBars data={insights.budgetBars} currency={cur} />
          </ChartCard>
        </Section>

        <Section title={t("sectionDebt")}>
          <ChartCard title={t("cardDebtHealth")} icon={HeartPulse}>
            <DebtHealth utilization={insights.utilization} loans={insights.loans} />
          </ChartCard>
          <ChartCard title={t("debtCostTitle")} icon={Landmark}>
            <DebtCostList data={debtCost} locale={locale} />
          </ChartCard>
        </Section>
      </div>
```

Update the `FxDegradedNotice` comment: "the same missing rates skew net worth and the debt cost subtotals below."

- [ ] **Step 4: Update `app/(app)/insights/loading.tsx`**

The second band is now three full-width skeletons, and the third band stays as two halves:

```tsx
        <SectionSkeleton nav>
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
          <div className="skeleton h-72 rounded-xl lg:col-span-2" />
        </SectionSkeleton>
```

- [ ] **Step 5: Delete dead code in `lib/insights/queries.ts`**

Delete these with their doc comments: `CardPaymentLine`, `CardPayments`, `getCardPayments`, `CashbackLine`, `CashbackByCard`, `getCashbackByCard`, `sumCashbackByCurrency`, `sumTransferCosts`, `TransferCosts`, `getTransferCosts`, `fetchAllTransferRows`, `CardFeeLine`, `CardFees`, `buildCardFeeLines`, `getCardFees`.

Then:
- Remove any import that is now unused. `summarizeCardFees`/`FeeLineRow` is likely one of them; let `npx eslint lib/insights/queries.ts` and `tsc` confirm. `addMonths` may still be used by `getInsights`, so check before removing.
- Rewrite `cardLabel`'s doc comment to say it labels a card group's currency lines in cost of carry, since that is its only caller now.
- In `fetchAllLoanPayments`'s comment, replace "than the transfer-costs total: that one merely under-reports" with "than a plain total would have: a total merely under-reports".
- In `fetchPace`'s comment, replace "(see the plan's UX-07 framing: the other ten cards stay monthly on purpose)" with "(the other month-band cards stay calendar-monthly on purpose)".

Also fix the comment in `lib/accounts/queries.ts` above `getAccountFeeLines`. Replace "A separate fetch from getCardFees rather than a filter over it: this one is scoped to a single account and needs no FX at all" with "Scoped to a single account and needs no FX at all".

In `lib/insights/queries.test.ts`, delete the `sumCashbackByCurrency`, `sumTransferCosts` and `buildCardFeeLines` describe blocks. Change the import to `import { buildLoanInterest } from "./queries";` and remove the `FeeLineRow` import if nothing else uses it.

Delete `components/insights/savings-goals.tsx`.

- [ ] **Step 6: Check**

Run: `grep -rn "getCardPayments\|getCashbackByCard\|getTransferCosts\|getCardFees\|sumCashbackByCurrency\|sumTransferCosts\|buildCardFeeLines\|SavingsGoals\|savings-goals\"" app components lib`
Expected: no matches.

Run: `npx vitest run lib/insights && npx tsc --noEmit && npx eslint "app/(app)/insights" components/insights lib/insights lib/accounts/queries.ts`
Expected: all pass, clean.

Run a key-parity check:
```bash
python3 -c "
import json
a=json.load(open('messages/en.json')); b=json.load(open('messages/es.json'))
def keys(d,p=''):
  return {p+k for k,v in d.items() for _ in [0] if not isinstance(v,dict)} | {x for k,v in d.items() if isinstance(v,dict) for x in keys(v,p+k+'.')}
print(sorted(keys(a)^keys(b)))"
```
Expected: `[]`

- [ ] **Step 7: Commit**

```bash
git add -A "app/(app)/insights" components/insights lib/insights lib/accounts/queries.ts messages/en.json messages/es.json
git commit -m "feat(insights): four questions, three clocks, one debt cost card"
```

---

### Task 6: Help guide and audit doc

**Files:**
- Modify: `app/(app)/help/page.tsx` (insights chapter around line 391; accounts chapter's account-page list around line 222)
- Modify: `messages/en.json`, `messages/es.json` (`Help`)
- Modify: `docs/product-audit-dominican-market.md` (UX-07)

- [ ] **Step 1: Help messages**

en `Help`:
- `insightsIntro`: "Insights answers four questions: is your net worth moving, where did the money go, are you on pace, and what does your debt cost. The middle band follows the month you pick; the others don't need one."
- `insightsDebt`: "Debt health: credit utilization and loan payoff at a glance"
- Add `insightsDebtCost`: "What your debt costs, in two groups never added together: what each card would charge if you financed its balance (from its latest statement), and the interest each loan payment actually went to. Tap a row to open that card or loan."
- Delete `insightsCarry`, `insightsCashback`, `insightsCostOfOwnership`, `insightsLoanInterest`.
- Delete `accountPageCashback` and `accountPageCostOfOwnership`. Add `accountPageReport`: "For credit cards, a card report (Boleta): cost of carry from the latest statement, cashback and fees & insurance this year, penalty fees, what you paid into the card this month, and welcome-bonus progress. Rows appear only once there's data behind them."
- `accountPageActivity`: "For checking, savings and investment accounts, the transfer tax and network fee settings plus what the account actually paid in fees and tax this year, across every kind of transaction; then the complete activity feed"

es `Help`:
- `insightsIntro`: "Análisis responde cuatro preguntas: si tu patrimonio se mueve, a dónde fue el dinero, si vas a buen ritmo y cuánto te cuesta la deuda. La franja del medio sigue el mes que elijas; las demás no lo necesitan."
- `insightsDebt`: "Salud de la deuda: utilización de crédito y avance de préstamos de un vistazo"
- Add `insightsDebtCost`: "Lo que te cuesta la deuda, en dos grupos que nunca se suman: lo que cada tarjeta te cobraría si financias el balance (según su último estado de cuenta) y los intereses que realmente se llevó cada pago de préstamo. Toca una fila para abrir esa tarjeta o préstamo."
- Delete the same four `insights*` keys.
- Delete `accountPageCashback` and `accountPageCostOfOwnership`. Add `accountPageReport`: "En tarjetas de crédito, la Boleta de la tarjeta: costo de financiamiento del último estado de cuenta, cashback y cargos y seguros del año, cargos por penalidad, lo que le pagaste a la tarjeta este mes y el progreso del bono de bienvenida. Cada fila aparece solo cuando hay datos detrás."
- `accountPageActivity`: "En cuentas corrientes, de ahorro e inversión, la configuración de impuesto y comisión de transferencia más lo que la cuenta realmente pagó en comisiones e impuestos este año, en cualquier tipo de movimiento; luego todo el historial de actividad"

- [ ] **Step 2: Help page**

In the insights chapter's `<ul>`, the list becomes:

```tsx
              <li>{t("insightsCashflow")}</li>
              <li>{t("insightsSpend")}</li>
              <li>{t("insightsBudget")}</li>
              <li>{t("insightsDebt")}</li>
              <li>{t("insightsDebtCost")}</li>
```

In the account-page `<ul>`, replace the `accountPageCashback` and `accountPageCostOfOwnership` items with one `<li>{t("accountPageReport")}</li>` in the same position.

`InsightsMock` draws only the spend donut, which still exists, so leave it unchanged.

- [ ] **Step 3: Check**

Run: `npx tsc --noEmit && npx eslint "app/(app)/help/page.tsx"`, then the key-parity script from Task 5 Step 6.
Expected: clean, `[]`.

- [ ] **Step 4: Audit doc**

In `docs/product-audit-dominican-market.md` under UX-07:
- Change `- [ ] Done` to `- [x] Done (14 Sep 2026)`.
- Add a `**Done** —` paragraph after the "Do this" paragraph, in the same voice as UX-05/UX-06. It should cite `app/(app)/insights/page.tsx`, `lib/insights/debt-cost.ts`, `components/insights/debt-cost.tsx`, `components/accounts/card-report.tsx`, `lib/accounts/transfer-costs.ts`, `app/(app)/accounts/[id]/page.tsx`, and the commit hashes from Tasks 1–5 (get them with `git --no-pager log --oneline -8`). Also state the two deviations from the audit's text:
  - Transfer costs went to the account page, not Settings.
  - Insights keeps one combined debt-cost card with two un-summed groups.
- Add a `**Remaining** —` list:
  - `- [ ]` The live browser pass (if not run in Task 7), or note it ran.
  - `- [ ]` Card payments per card were cut from Insights. A user who relied on the cross-card payment total now has only the budget bars.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/help/page.tsx" messages/en.json messages/es.json docs/product-audit-dominican-market.md
git commit -m "docs(help,audit): insights' four questions and the card report"
```

---

### Task 7: Verification

- [ ] **Step 1: Full checks**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: all green. Report failures verbatim.

- [ ] **Step 2: Build**

Run: `rtk proxy npx next build`
Expected: compiles. (Per memory, the dev server needs a 6GB heap: `NODE_OPTIONS=--max-old-space-size=6144`.)

- [ ] **Step 3: Browser pass (ask the user first before starting the dev server)**

With agent-browser and a named session (`agent-browser session id --scope worktree --prefix tywin`):
1. `/insights`: three bands. No savings goals, card payments, transfer costs, cashback or cost-of-ownership cards. Clicking the month arrows changes all three cards in the middle band. The Debt cost card shows its groups, and a row click lands on `/accounts/<id>`.
2. A credit card with an imported statement: the Boleta sits under the hero with carry and cashback rows. The hero no longer shows cashback, fees or bonus lines.
3. A credit card with no statements: the Boleta shows the empty line and the import button.
4. A checking account: the "Paid in 2026" block shows fees and tax.
5. Spanish locale at a 360px viewport: `/insights` and a card page have no horizontal scroll.
6. `agent-browser close`.

If the pass can't run (auth or remote DB), say so, and leave the audit's Remaining item unchecked.

- [ ] **Step 4: Finish**

Per the branch-lifecycle memory: if work happened on a branch, merge it into `main` and delete the branch locally and remotely. Push, then ask the user to verify the deploy. Do not inspect Vercel.
