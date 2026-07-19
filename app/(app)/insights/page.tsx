import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getInsights } from "@/lib/insights/queries";
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
  const insights = await getInsights(month);
  const cur = insights.baseCurrency;
  const t = await getTranslations("Insights");

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
    </div>
  );
}
