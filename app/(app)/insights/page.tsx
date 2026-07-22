import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getInsights, getCostOfCarry } from "@/lib/insights/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import { SpendDonut } from "@/components/insights/spend-donut";
import { CashflowChart } from "@/components/insights/cashflow-chart";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { SpendingPace } from "@/components/insights/spending-pace";

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
    <Card className={`p-6 ${className ?? ""}`}>
      <h2 className="mb-4 text-lg font-medium text-foreground">{title}</h2>
      {children}
    </Card>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [insights, carry] = await Promise.all([getInsights(month), getCostOfCarry()]);
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

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={t("cardSpendDistribution")}>
          <SpendDonut data={insights.distribution} total={insights.totalSpend} currency={cur} />
        </ChartCard>
        <ChartCard title={t("cardDebtHealth")}>
          <DebtHealth utilization={insights.utilization} loans={insights.loans} />
        </ChartCard>
        <ChartCard title={t("cardCashFlow")} className="lg:col-span-2">
          <CashflowChart data={insights.trend} currency={cur} />
        </ChartCard>
        <ChartCard title={t("cardSpendingPace")} className="lg:col-span-2">
          <SpendingPace data={insights.pace} currency={cur} />
        </ChartCard>
        <ChartCard title={t("cardExpensesVsBudget")} className="lg:col-span-2">
          <BudgetBars data={insights.budgetBars} currency={cur} />
        </ChartCard>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-medium text-foreground">{t("costOfCarryTitle")}</h2>
        {carryLines.length > 0 ? (
          <div className="space-y-4">
            {carryLines.map((l) => (
              <div key={l.accountId} className="flex items-baseline justify-between text-sm">
                <div>
                  <p className="text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.apr !== null ? `${t("costOfCarryApr", { rate: l.apr })} · ` : ""}
                    {t("costOfCarryAsOf", { date: formatDate(l.periodEnd, locale) })}
                  </p>
                </div>
                <span className="tabular-nums text-foreground">{formatMoney(l.costOfCarry, l.currency)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t pt-3 text-sm font-medium">
              <span className="text-foreground">{t("costOfCarryTotal", { currency: carry.baseCurrency })}</span>
              <span className="tabular-nums text-foreground">{formatMoney(carry.totalBase, carry.baseCurrency)}</span>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("costOfCarryEmpty")}</p>
        )}
      </Card>
    </div>
  );
}
