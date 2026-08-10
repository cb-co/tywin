# Insights Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a leading icon to every insight card, a per-currency total row to the Cashback card, and a new year-to-date "Transfer costs" card (fees + tax) to `/insights`.

**Architecture:** All changes live in `app/(app)/insights/page.tsx` (a server component) plus one new query + pure helper in `lib/insights/queries.ts`. No new dependencies — icons come from the already-installed `lucide-react`, and the animated stat numbers reuse the existing `MoneyDisplay` component (`size="stat"`, `animate`).

**Tech Stack:** Next.js server components, next-intl, Supabase, Vitest.

## Global Constraints

- No new npm packages — `lucide-react` and `@/components/ui/money-display` already exist in the project.
- Every new user-facing string is added to **both** `messages/en.json` and `messages/es.json` in the same task, under the existing `"Insights"` namespace.
- Transfer fee/tax base-currency conversion uses each transaction's own stored `exchange_rate` (never today's live rate) — this is the whole reason the figure is trustworthy; do not swap in `lib/fx.ts`'s `getExchangeRates`/`convertToBase` for this feature.
- Cashback stays un-converted across currencies — the new total is one row **per currency**, never a single FX-blended number.
- Verify type safety after every `page.tsx` or `queries.ts` edit with `npx tsc --noEmit`, and run `npm run lint` before each commit.

---

### Task 1: Add new translation keys

**Files:**
- Modify: `messages/en.json` (inside the `"Insights"` object, `messages/en.json:523-565`)
- Modify: `messages/es.json` (inside the `"Insights"` object, `messages/es.json:523-565`)

**Interfaces:**
- Produces: four new i18n keys under the `Insights` namespace — `cashbackTotal`, `transferCostsTitle`, `transferFeesLabel`, `transferTaxLabel` — consumed by Tasks 6 and 7.

- [ ] **Step 1: Add the keys to `messages/en.json`**

Find this line inside the `"Insights"` object:

```json
    "cashbackTitle": "Cashback in {year}",
    "cashbackEmpty": "Import a card statement to see the cashback your cards have earned.",
```

Replace it with:

```json
    "cashbackTitle": "Cashback in {year}",
    "cashbackEmpty": "Import a card statement to see the cashback your cards have earned.",
    "cashbackTotal": "Total ({currency})",
    "transferCostsTitle": "Transfer costs ({year} YTD)",
    "transferFeesLabel": "Fees",
    "transferTaxLabel": "Tax",
```

- [ ] **Step 2: Add the keys to `messages/es.json`**

Find this line inside the `"Insights"` object:

```json
    "cashbackTitle": "Cashback en {year}",
    "cashbackEmpty": "Importa un estado de cuenta para ver el cashback que han generado tus tarjetas.",
```

Replace it with:

```json
    "cashbackTitle": "Cashback en {year}",
    "cashbackEmpty": "Importa un estado de cuenta para ver el cashback que han generado tus tarjetas.",
    "cashbackTotal": "Total ({currency})",
    "transferCostsTitle": "Costos de transferencia ({year} AAF)",
    "transferFeesLabel": "Comisiones",
    "transferTaxLabel": "Impuesto",
```

- [ ] **Step 3: Verify both files still parse as valid JSON and contain the new keys**

Run: `node -e "const en=require('./messages/en.json').Insights, es=require('./messages/es.json').Insights; for (const k of ['cashbackTotal','transferCostsTitle','transferFeesLabel','transferTaxLabel']) { if (!en[k] || !es[k]) throw new Error('missing ' + k); } console.log('ok')"`

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "i18n: add strings for cashback total and transfer costs card"
```

---

### Task 2: `sumTransferCosts` pure function + tests

**Files:**
- Modify: `lib/insights/queries.ts` (add near the bottom, after `getCashbackByCard`)
- Create: `lib/insights/queries.test.ts`

**Interfaces:**
- Produces: `sumTransferCosts(rows: { fee_amount: number | null; tax_amount: number | null; exchange_rate: number | null }[]): { totalFeesBase: number; totalTaxBase: number }` — consumed by Task 3's `getTransferCosts`.

This mirrors the pattern in `lib/insights/net-worth-history.ts`: fetch-and-assemble logic (`getNetWorthHistory`) is a thin wrapper around pure, directly-testable functions. `sumTransferCosts` is that pure function here — it takes rows already fetched from Supabase and does the arithmetic, so the test never needs to mock a Supabase client.

- [ ] **Step 1: Write the failing tests**

Create `lib/insights/queries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sumTransferCosts } from "./queries";

describe("sumTransferCosts", () => {
  it("sums fee and tax separately, each weighted by its own row's exchange rate", () => {
    const result = sumTransferCosts([
      { fee_amount: 5, tax_amount: 2, exchange_rate: 1 },
      { fee_amount: 10, tax_amount: 4, exchange_rate: 60 },
    ]);
    // 5*1 + 10*60 = 605 ; 2*1 + 4*60 = 242
    expect(result.totalFeesBase).toBe(605);
    expect(result.totalTaxBase).toBe(242);
  });

  it("treats a null fee, tax, or rate as zero fee/tax and a 1:1 rate", () => {
    const result = sumTransferCosts([{ fee_amount: null, tax_amount: null, exchange_rate: null }]);
    expect(result).toEqual({ totalFeesBase: 0, totalTaxBase: 0 });
  });

  it("returns zero for no rows", () => {
    expect(sumTransferCosts([])).toEqual({ totalFeesBase: 0, totalTaxBase: 0 });
  });

  it("rounds each total to two decimal places", () => {
    const result = sumTransferCosts([{ fee_amount: 1, tax_amount: 1, exchange_rate: 1 / 3 }]);
    expect(result.totalFeesBase).toBe(0.33);
    expect(result.totalTaxBase).toBe(0.33);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/insights/queries.test.ts`
Expected: FAIL — `sumTransferCosts` is not exported from `./queries` (module has no such export).

- [ ] **Step 3: Add `sumTransferCosts` to `lib/insights/queries.ts`**

Append this after the closing brace of `getCashbackByCard` (after the `return { year, lines };` / closing `}` at the end of the file, `lib/insights/queries.ts:347-348`):

```ts

export function sumTransferCosts(
  rows: { fee_amount: number | null; tax_amount: number | null; exchange_rate: number | null }[],
): { totalFeesBase: number; totalTaxBase: number } {
  let totalFeesBase = 0;
  let totalTaxBase = 0;
  for (const r of rows) {
    const rate = Number(r.exchange_rate ?? 1);
    totalFeesBase += Number(r.fee_amount ?? 0) * rate;
    totalTaxBase += Number(r.tax_amount ?? 0) * rate;
  }
  return {
    totalFeesBase: Math.round(totalFeesBase * 100) / 100,
    totalTaxBase: Math.round(totalTaxBase * 100) / 100,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/insights/queries.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/insights/queries.ts lib/insights/queries.test.ts
git commit -m "feat(insights): add sumTransferCosts helper for fee/tax totals"
```

---

### Task 3: `getTransferCosts` data query

**Files:**
- Modify: `lib/insights/queries.ts` (add directly after `sumTransferCosts`, added in Task 2)

**Interfaces:**
- Consumes: `sumTransferCosts` from Task 2; `createClient` from `@/lib/supabase/server` (already imported at the top of this file).
- Produces: `type TransferCosts = { year: number; baseCurrency: string; totalFeesBase: number; totalTaxBase: number }` and `async function getTransferCosts(): Promise<TransferCosts>` — consumed by Task 7 in `app/(app)/insights/page.tsx`.

- [ ] **Step 1: Add the type and function**

Append after `sumTransferCosts` (added in Task 2) at the end of `lib/insights/queries.ts`:

```ts

export type TransferCosts = {
  year: number;
  baseCurrency: string;
  totalFeesBase: number;
  totalTaxBase: number;
};

/**
 * Fees and tax paid to move money between your own accounts this calendar
 * year — the `payment`-type transactions' `fee_amount`/`tax_amount`
 * (see transactions_compute_amounts() in
 * supabase/migrations/20260717234227_transactions.sql). Converted to base
 * currency using each transaction's own stored exchange_rate, not today's
 * live rate — the same rate base_amount was derived from, so this doesn't
 * restate history through a rate that didn't apply at the time.
 */
export async function getTransferCosts(): Promise<TransferCosts> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("transactions")
      .select("fee_amount,tax_amount,exchange_rate")
      .eq("type", "payment")
      .gte("occurred_at", `${year}-01-01`)
      .lt("occurred_at", `${year + 1}-01-01`),
  ]);

  const baseCurrency = profile?.base_currency ?? "USD";
  const { totalFeesBase, totalTaxBase } = sumTransferCosts(rows ?? []);

  return { year, baseCurrency, totalFeesBase, totalTaxBase };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `lib/insights/queries.ts`

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npx vitest run`
Expected: PASS, same test count as before plus the 4 from Task 2

- [ ] **Step 4: Commit**

```bash
git add lib/insights/queries.ts
git commit -m "feat(insights): add getTransferCosts query"
```

---

### Task 4: `Tally` multi-row totals + update existing callers

**Files:**
- Modify: `app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: `Tally`'s `total` prop may now render one or more rows; each row must be individually wrapped in `<div className="flex items-baseline justify-between">…</div>` by the caller (the wrapper no longer applies that layout itself). Task 6 relies on this to render one row per cashback currency.

This is a shape change, not a visual one: the two existing callers (Card payments, Cost of carry) look identical before and after this task.

- [ ] **Step 1: Change the `Tally` total wrapper to stack rows**

In `app/(app)/insights/page.tsx`, find (inside the `Tally` function):

```tsx
      {total ? (
        <div className="mt-auto flex items-baseline justify-between border-t pt-3 text-sm font-medium">
          {total}
        </div>
      ) : null}
```

Replace with:

```tsx
      {total ? (
        <div className="mt-auto space-y-1.5 border-t pt-3 text-sm font-medium">{total}</div>
      ) : null}
```

- [ ] **Step 2: Wrap the Card payments total in its own row**

Find:

```tsx
                total={
                  <>
                    <span className="text-foreground">
                      {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                    </span>
                  </>
                }
```

Replace with:

```tsx
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                    </span>
                  </div>
                }
```

- [ ] **Step 3: Wrap the Cost of carry total in its own row**

Find:

```tsx
                total={
                  <>
                    <span className="text-foreground">
                      {t("costOfCarryTotal", { currency: carry.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(carry.totalBase, carry.baseCurrency)}
                    </span>
                  </>
                }
```

Replace with:

```tsx
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("costOfCarryTotal", { currency: carry.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(carry.totalBase, carry.baseCurrency)}
                    </span>
                  </div>
                }
```

- [ ] **Step 4: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 5: Start the dev server and confirm Card payments / Cost of carry look unchanged**

Run: `npm run dev`, open `/insights`, check the "Card payments this month" and "Cost of carry" cards render their total row exactly as before (label left, amount right, divider above). Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/insights/page.tsx
git commit -m "refactor(insights): let Tally's total slot hold multiple rows"
```

---

### Task 5: `ChartCard` icon prop + icons on all existing cards

**Files:**
- Modify: `app/(app)/insights/page.tsx`

**Interfaces:**
- Produces: `ChartCard` now requires an `icon: LucideIcon` prop. Every `<ChartCard>` call site in the file must pass one.

- [ ] **Step 1: Import the icons**

Find:

```tsx
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
```

Replace with:

```tsx
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  PiggyBank,
  Gauge,
  PieChart,
  BarChart3,
  CreditCard,
  HeartPulse,
  Landmark,
  Gift,
  type LucideIcon,
} from "lucide-react";
```

(`Receipt` is added in Task 7, alongside the card that uses it.)

- [ ] **Step 2: Add the `icon` prop to `ChartCard`**

Find:

```tsx
function ChartCard({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `h-full` + a flex body so a card fills its grid cell and its content can
    // decide how to use the leftover height. `gap-0` because the heading
    // already carries its own `mb-4`; with Card's default gap on top of it the
    // titles floated a full 2rem clear of their content.
    <Card className={`h-full gap-0 p-6 ${className ?? ""}`}>
      {/* h3, not h2: the section headings are this page's h2s. */}
      <h3 className="mb-4 text-lg font-medium text-foreground">{title}</h3>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}
```

Replace with:

```tsx
function ChartCard({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `h-full` + a flex body so a card fills its grid cell and its content can
    // decide how to use the leftover height. `gap-0` because the heading
    // already carries its own `mb-4`; with Card's default gap on top of it the
    // titles floated a full 2rem clear of their content.
    <Card className={`h-full gap-0 p-6 ${className ?? ""}`}>
      {/* h3, not h2: the section headings are this page's h2s. */}
      <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h3>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}
```

- [ ] **Step 3: Add `icon` to each of the 10 existing `<ChartCard>` call sites**

Make these 10 replacements (each `old` string is unique in the file):

1. Find `<ChartCard title={t("cardNetWorth")} className="@[34rem]:col-span-2">`
   Replace `<ChartCard title={t("cardNetWorth")} icon={TrendingUp} className="@[34rem]:col-span-2">`

2. Find `<ChartCard title={t("cardCashFlow")} className="@[34rem]:col-span-2">`
   Replace `<ChartCard title={t("cardCashFlow")} icon={ArrowLeftRight} className="@[34rem]:col-span-2">`

3. Find `<ChartCard title={t("cardSavingsGoals")} className="@[34rem]:col-span-2">`
   Replace `<ChartCard title={t("cardSavingsGoals")} icon={PiggyBank} className="@[34rem]:col-span-2">`

4. Find `<ChartCard title={t("cardSpendingPace")} className="@[34rem]:col-span-2">`
   Replace `<ChartCard title={t("cardSpendingPace")} icon={Gauge} className="@[34rem]:col-span-2">`

5. Find `<ChartCard title={t("cardSpendDistribution")} className="@[34rem]:col-span-2">`
   Replace `<ChartCard title={t("cardSpendDistribution")} icon={PieChart} className="@[34rem]:col-span-2">`

6. Find `<ChartCard title={t("cardExpensesVsBudget")}>`
   Replace `<ChartCard title={t("cardExpensesVsBudget")} icon={BarChart3}>`

7. Find `<ChartCard title={t("cardCardPayments")}>`
   Replace `<ChartCard title={t("cardCardPayments")} icon={CreditCard}>`

8. Find `<ChartCard title={t("cardDebtHealth")}>`
   Replace `<ChartCard title={t("cardDebtHealth")} icon={HeartPulse}>`

9. Find `<ChartCard title={t("costOfCarryTitle")}>`
   Replace `<ChartCard title={t("costOfCarryTitle")} icon={Landmark}>`

10. Find `<ChartCard title={t("cashbackTitle", { year: String(cashback.year) })}>`
    Replace `<ChartCard title={t("cashbackTitle", { year: String(cashback.year) })} icon={Gift}>`

- [ ] **Step 4: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (a missing `icon` prop on any `ChartCard` would fail the type check here)

- [ ] **Step 5: Start the dev server and visually confirm every card has a leading icon**

Run: `npm run dev`, open `/insights` in both light and dark theme, confirm each of the 10 cards shows a small muted icon before its title, sized consistently, no layout shift or wrapping.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/insights/page.tsx
git commit -m "feat(insights): add a leading icon to every card title"
```

---

### Task 6: Cashback per-currency total rows

**Files:**
- Modify: `app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes: `Tally`'s multi-row `total` slot (Task 4); `cashbackTotal` i18n key (Task 1).

- [ ] **Step 1: Compute per-currency totals alongside the other derived values**

Find:

```tsx
  const carryLines = carry.lines.filter(
    (l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null,
  );
```

Replace with:

```tsx
  const carryLines = carry.lines.filter(
    (l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null,
  );
  const cashbackTotalsByCurrency = Object.entries(
    cashback.lines.reduce<Record<string, number>>((acc, l) => {
      acc[l.currency] = (acc[l.currency] ?? 0) + l.total;
      return acc;
    }, {}),
  );
```

- [ ] **Step 2: Render one total row per currency on the Cashback card**

Find:

```tsx
          <ChartCard title={t("cashbackTitle", { year: String(cashback.year) })} icon={Gift}>
            {cashback.lines.length > 0 ? (
              <Tally
                rows={cashback.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.total, l.currency)}
                    </span>
                  </div>
                ))}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cashbackEmpty")}</p>
            )}
          </ChartCard>
```

Replace with:

```tsx
          <ChartCard title={t("cashbackTitle", { year: String(cashback.year) })} icon={Gift}>
            {cashback.lines.length > 0 ? (
              <Tally
                rows={cashback.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.total, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <>
                    {cashbackTotalsByCurrency.map(([currency, total]) => (
                      <div key={currency} className="flex items-baseline justify-between">
                        <span className="text-foreground">{t("cashbackTotal", { currency })}</span>
                        <span className="tabular-nums text-foreground">
                          {formatMoney(total, currency)}
                        </span>
                      </div>
                    ))}
                  </>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cashbackEmpty")}</p>
            )}
          </ChartCard>
```

- [ ] **Step 3: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 4: Start the dev server and confirm the totals**

Run: `npm run dev`, open `/insights`. If your data has cashback on cards in more than one currency, confirm you see one total row per currency, each correctly summed and labelled. If all cashback is in a single currency, confirm exactly one total row appears. Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/insights/page.tsx
git commit -m "feat(insights): show a per-currency total on the cashback card"
```

---

### Task 7: New "Transfer costs" card

**Files:**
- Modify: `app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes: `getTransferCosts` and `TransferCosts` (Task 3); `MoneyDisplay` from `@/components/ui/money-display`; `transferCostsTitle`/`transferFeesLabel`/`transferTaxLabel` i18n keys (Task 1); `Receipt` icon.

- [ ] **Step 1: Import `Receipt` and `MoneyDisplay`, and pull in `getTransferCosts`**

Find:

```tsx
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  PiggyBank,
  Gauge,
  PieChart,
  BarChart3,
  CreditCard,
  HeartPulse,
  Landmark,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  getInsights,
  getCostOfCarry,
  getCardPayments,
  getCashbackByCard,
} from "@/lib/insights/queries";
```

Replace with:

```tsx
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  PiggyBank,
  Gauge,
  PieChart,
  BarChart3,
  CreditCard,
  Receipt,
  HeartPulse,
  Landmark,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import {
  getInsights,
  getCostOfCarry,
  getCardPayments,
  getCashbackByCard,
  getTransferCosts,
} from "@/lib/insights/queries";
```

- [ ] **Step 2: Fetch `transferCosts` alongside the page's other data**

Find:

```tsx
  const [insights, carry, cardPayments, netWorth, goals, cashback] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getCardPayments(month),
    getNetWorthHistory(),
    getGoalsOverview(),
    getCashbackByCard(),
  ]);
```

Replace with:

```tsx
  const [insights, carry, cardPayments, netWorth, goals, cashback, transferCosts] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getCardPayments(month),
    getNetWorthHistory(),
    getGoalsOverview(),
    getCashbackByCard(),
    getTransferCosts(),
  ]);
```

- [ ] **Step 3: Add the new card after Card payments**

Find (this is the end of the Card payments `ChartCard`, immediately before the "This month" `</Section>` closing tag):

```tsx
          <ChartCard title={t("cardCardPayments")} icon={CreditCard}>
            {cardPayments.lines.length > 0 ? (
              <Tally
                rows={cardPayments.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.amount, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                    </span>
                  </div>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cardPaymentsEmpty")}</p>
            )}
          </ChartCard>
        </Section>
```

Replace with:

```tsx
          <ChartCard title={t("cardCardPayments")} icon={CreditCard}>
            {cardPayments.lines.length > 0 ? (
              <Tally
                rows={cardPayments.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.amount, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                    </span>
                  </div>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cardPaymentsEmpty")}</p>
            )}
          </ChartCard>

          {/* Year-to-date, not month-scoped — the "YTD" in the title is what
              tells the reader this card ignores the month picker in this
              section's heading, the same disambiguation the Cashback card
              uses for its own year-scoped title. */}
          <ChartCard
            title={t("transferCostsTitle", { year: String(transferCosts.year) })}
            icon={Receipt}
          >
            <div className="flex flex-1 items-center justify-around gap-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("transferFeesLabel")}
                </span>
                <MoneyDisplay
                  amount={transferCosts.totalFeesBase}
                  currency={transferCosts.baseCurrency}
                  size="stat"
                  animate
                />
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("transferTaxLabel")}
                </span>
                <MoneyDisplay
                  amount={transferCosts.totalTaxBase}
                  currency={transferCosts.baseCurrency}
                  size="stat"
                  animate
                />
              </div>
            </div>
          </ChartCard>
        </Section>
```

- [ ] **Step 4: Verify it type-checks and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors

- [ ] **Step 5: Start the dev server and confirm the new card**

Run: `npm run dev`, open `/insights`. Confirm a new "Transfer costs (2026 YTD)" card appears in the "This month" section next to Card payments, showing two numbers (Fees, Tax) that count up on load. If you have no `payment`-type transactions with a fee or tax this year, confirm it shows $0.00 for both rather than an empty state (this is intentional — see the plan's parent spec).

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/insights/page.tsx
git commit -m "feat(insights): add year-to-date transfer costs card"
```

---

### Task 8: Full-page manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: all PASS, no type or lint errors

- [ ] **Step 2: Full walkthrough in the browser**

Run: `npm run dev`, open `/insights`:
- Every card (all 11, including the new Transfer costs card) shows a leading icon, aligned consistently with its title.
- Toggle light/dark theme — icons stay legible (muted-foreground color) in both.
- Cashback card shows a total row per currency present in the data.
- Card payments and Cost of carry totals are visually unchanged from before this plan.
- Transfer costs card's two numbers animate on first load and read correctly against the raw data (spot-check one `payment` transaction's `fee_amount`/`tax_amount` in Supabase against the displayed total).
- Resize the window across the `@[34rem]` container breakpoint — confirm no card's icon+title wraps awkwardly at the narrow width.
- Click the month picker in "This month" — confirm Transfer costs does *not* change (it's YTD), while Spending pace / Spend distribution / Card payments do.

- [ ] **Step 3: Stop the dev server**

No commit for this task — it's verification only. If anything fails, fix it in the task that introduced the issue and re-run this task's checks.
