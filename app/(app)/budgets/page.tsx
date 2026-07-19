import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BudgetGrid } from "@/components/budgets/budget-grid";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { normalizeMonth } from "@/lib/budgets/month";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const overview = await getBudgetOverview(month);
  const t = await getTranslations("Budgets");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <BudgetGrid month={month} overview={overview} />
    </div>
  );
}
