import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getInsights, getCostOfCarry, getCardPayments } from "@/lib/insights/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import { SpendDonut, CashflowChart, SpendingPace } from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";

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
      <h2 className="mb-4 text-lg font-medium text-foreground">{title}</h2>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

/**
 * A list of amounts closed by a total. The rows sit at the top and the total is
 * pushed to the bottom edge, so when this card is paired with a taller one the
 * extra height opens up between them instead of leaving the card short. Reads
 * like a receipt, which is what it is.
 */
function Tally({ rows, total }: { rows: React.ReactNode; total: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* `pb-4` rather than a margin on the total: `mt-auto` collapses to zero
          whenever the card has no spare height, and then the rule sits flush
          against the last row. The padding guarantees the gap either way. */}
      <div className="space-y-3 pb-4">{rows}</div>
      <div className="mt-auto flex items-baseline justify-between border-t pt-3 text-sm font-medium">
        {total}
      </div>
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [insights, carry, cardPayments] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getCardPayments(month),
  ]);
  const cur = insights.baseCurrency;
  const t = await getTranslations("Insights");
  const locale = await getLocale();
  const carryLines = carry.lines.filter(
    (l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null,
  );

  const navLink =
    "flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <div className="flex items-center gap-2">
        <Link href={`/insights?month=${addMonths(month, -1)}`} aria-label={t("prevMonthAria")} className={navLink}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="min-w-40 text-center text-lg font-medium">{monthLabel(month)}</span>
        <Link href={`/insights?month=${addMonths(month, 1)}`} aria-label={t("nextMonthAria")} className={navLink}>
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Container query, not a viewport one, because the shell around this
          grid changes width: the sidebar takes 256px from `md` up and `main`
          adds 48px of padding, so a viewport number means two different card
          widths depending on whether the rail is showing.

          34rem is that 304px of chrome subtracted from the ~850px viewport
          where the split is wanted. Stated as container width it stays true
          when the rail is not there — on a tablet with no sidebar the columns
          come in earlier in viewport terms, at the same actual width.

          The three plotted charts run full bleed because they are read along
          the x-axis and lose their shape when halved; everything else is a list
          of rows and pairs up fine at half width.

          Pairings are by subject, not by leftover space: budget against the
          card payments it has to cover, and debt health against what that debt
          costs to carry. */}
      <div className="@container">
        <div className="grid gap-6 @[34rem]:grid-cols-2">
        <ChartCard title={t("cardSpendDistribution")} className="@[34rem]:col-span-2">
          <SpendDonut data={insights.distribution} total={insights.totalSpend} currency={cur} />
        </ChartCard>

        <ChartCard title={t("cardCashFlow")} className="@[34rem]:col-span-2">
          <CashflowChart data={insights.trend} currency={cur} />
        </ChartCard>

        <ChartCard title={t("cardSpendingPace")} className="@[34rem]:col-span-2">
          <SpendingPace data={insights.pace} currency={cur} />
        </ChartCard>

        <ChartCard title={t("cardExpensesVsBudget")}>
          <BudgetBars data={insights.budgetBars} currency={cur} />
        </ChartCard>

        <ChartCard title={t("cardCardPayments")}>
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
                <>
                  <span className="text-foreground">
                    {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                  </span>
                </>
              }
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("cardPaymentsEmpty")}</p>
          )}
        </ChartCard>

        <ChartCard title={t("cardDebtHealth")}>
          <DebtHealth utilization={insights.utilization} loans={insights.loans} />
        </ChartCard>

        <ChartCard title={t("costOfCarryTitle")}>
          {carryLines.length > 0 ? (
            <Tally
              rows={carryLines.map((l) => (
                <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.currency} ·{" "}
                      {l.apr !== null ? `${t("costOfCarryApr", { rate: l.apr })} · ` : ""}
                      {t("costOfCarryAsOf", { date: formatDate(l.periodEnd, locale) })}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatMoney(l.costOfCarry, l.currency)}
                  </span>
                </div>
              ))}
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
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("costOfCarryEmpty")}</p>
          )}
        </ChartCard>
        </div>
      </div>
    </div>
  );
}
