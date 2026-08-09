# Insights page polish: card icons, cashback total, transfer costs

## Context

Three small additions to `app/(app)/insights/page.tsx`, requested together as
visual/informational polish rather than a new feature area:

1. Every insight card gets a small leading icon.
2. The Cashback card gets a total row (currently omitted on purpose).
3. A new "Transfer costs" card shows year-to-date transfer fees and transfer
   tax as two animated stat numbers.

## 1. Icons on every card title

`ChartCard` (defined locally in `page.tsx`) gains an `icon` prop:

```ts
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
    <Card className={`h-full gap-0 p-6 ${className ?? ""}`}>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h3>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}
```

Every existing `<ChartCard>` call site passes an `icon`. Assignments (all from
`lucide-react`, already a project dependency):

| Card | Icon |
|---|---|
| Net worth | `TrendingUp` |
| Cash flow | `ArrowLeftRight` |
| Savings goals | `PiggyBank` |
| Spending pace | `Gauge` |
| Spend distribution | `PieChart` |
| Expenses vs budget | `BarChart3` |
| Card payments | `CreditCard` |
| Transfer costs (new) | `Receipt` |
| Credit & debt health | `HeartPulse` |
| Cost of carry | `Landmark` |
| Cashback | `Gift` |

No new translation keys needed — icons carry no text.

## 2. Cashback total row(s)

Cashback intentionally prints no total today: each line is a card's own
currency (DOP, USD, …) and converting through today's FX rate would state a
number no statement ever printed (see the doc comment on
`getCashbackByCard` in `lib/insights/queries.ts`). That reasoning stands, so
the fix is a total **per currency**, not one grand total.

### `Tally` shape change

`Tally`'s `total` slot currently assumes a single row — the wrapper itself
carries `flex items-baseline justify-between`:

```tsx
{total ? (
  <div className="mt-auto flex items-baseline justify-between border-t pt-3 text-sm font-medium">
    {total}
  </div>
) : null}
```

This can't hold one row per currency. Change the wrapper to stack rows and
push the `flex items-baseline justify-between` onto each row the caller
supplies:

```tsx
{total ? (
  <div className="mt-auto space-y-1.5 border-t pt-3 text-sm font-medium">
    {total}
  </div>
) : null}
```

The two existing callers (`Card payments`, `Cost of carry`) each wrap their
single total in a `<div className="flex items-baseline justify-between">…</div>`
— no visual change, just the row markup moving from the wrapper to the
caller.

### Cashback rendering

In `getCashbackByCard`'s consumer (`page.tsx`), group `cashback.lines` by
`currency`, sum `total` per group, and render one row per currency using the
existing `cardPaymentsTotal`/`costOfCarryTotal` label shape:
`t("cashbackTotal", { currency })`. Grouping happens in the page component,
not in `lib/insights/queries.ts` — `getCashbackByCard` keeps returning flat
lines; the page already does per-card currency-aware rendering, so the
group-by is local view logic, not a data-layer concern.

New i18n key: `cashbackTotal: "Total ({currency})"` (en) /
`"Total ({currency})"` (es) — identical wording to the two existing total
keys.

## 3. Transfer costs card (fees + tax, year to date)

### Data

`transactions` has `fee_amount` and `tax_amount`, populated only on
`payment`-type rows (inter-account transfers) from the source account's
`network_fee_amount` / `transfer_tax_rate` (see
`transactions_compute_amounts()` in
`supabase/migrations/20260717234227_transactions.sql`). Both are stored in
the transaction's native currency; there's no `base_fee_amount` /
`base_tax_amount` column, but every row stores the `exchange_rate` it was
entered with — the same rate `base_amount` is derived from. Multiplying
`fee_amount * exchange_rate` and `tax_amount * exchange_rate` per row gives a
base-currency figure using each transaction's own historical rate, not
today's — so this doesn't reintroduce the "invented number" problem the
cashback card avoids.

New function in `lib/insights/queries.ts`:

```ts
export type TransferCosts = {
  year: number;
  baseCurrency: string;
  totalFeesBase: number;
  totalTaxBase: number;
};

export async function getTransferCosts(): Promise<TransferCosts> {
  // profiles.base_currency, same fallback pattern as getCashbackByCard
  // select fee_amount, tax_amount, exchange_rate from transactions
  //   where type = 'payment'
  //     and occurred_at >= `${year}-01-01` and occurred_at < `${year + 1}-01-01`
  // sum fee_amount * exchange_rate -> totalFeesBase
  // sum tax_amount * exchange_rate -> totalTaxBase
}
```

Called alongside the other `Promise.all` queries in `InsightsPage`.

### Card placement and rendering

New `ChartCard` in the **This month** section, next to Card payments:

```
title={t("transferCostsTitle", { year: String(transferCosts.year) })}
icon={Receipt}
```

Title reads "Transfer costs ({year} YTD)" — the "YTD" flags that, unlike its
section-mates, this card ignores the month picker. This is the same
disambiguation the Cashback card already uses (its title states the year
because it's the one card in the Debt section not scoped to a month).

Body: two stat numbers side by side, reusing `MoneyDisplay` (`size="stat"`,
`animate`) the same way `SpendDonut` already renders its center total —
established pattern for "the one number a card is about":

```tsx
<div className="flex flex-1 items-center justify-around gap-6">
  <div className="flex flex-col items-center gap-1">
    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {t("transferFeesLabel")}
    </span>
    <MoneyDisplay amount={transferCosts.totalFeesBase} currency={transferCosts.baseCurrency} size="stat" animate />
  </div>
  <div className="h-10 w-px bg-border" />
  <div className="flex flex-col items-center gap-1">
    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {t("transferTaxLabel")}
    </span>
    <MoneyDisplay amount={transferCosts.totalTaxBase} currency={transferCosts.baseCurrency} size="stat" animate />
  </div>
</div>
```

No empty state needed: $0.00 fees/tax is a meaningful, honest answer (unlike
Cashback's per-card omission, which hides a genuine data gap — a card whose
statements never reported a figure — rather than a true zero).

New i18n keys (en / es):
- `transferCostsTitle`: "Transfer costs ({year} YTD)" / "Costos de transferencia ({year} AAF)"
- `transferFeesLabel`: "Fees" / "Comisiones"
- `transferTaxLabel`: "Tax" / "Impuesto"

## Testing

- `lib/insights/queries.test.ts` (new): `getTransferCosts` — only `payment`
  rows count, correct Jan 1–Dec 31 window for the current year, correct
  `fee_amount * exchange_rate` / `tax_amount * exchange_rate` summation
  across mixed currencies/rates.
- Manual: run the dev server, view `/insights` with seeded data covering
  multi-currency cashback and at least one fee/tax-bearing transfer; confirm
  the Tally refactor doesn't regress Card payments / Cost of carry, icons
  render at a sane size across both themes, and the new card's numbers
  count up on load.

## Non-goals

- No change to how `getCashbackByCard` sums or returns data — grouping for
  the total is view-only.
- No "all-time" or per-month toggle for transfer costs; year-to-date only,
  per the approved scope.
- No icon added to the three section headings (Position / This month /
  Debt) — only card titles, per the approved scope.
