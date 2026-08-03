import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BudgetGrid } from "@/components/budgets/budget-grid";
import { GoalGrid } from "@/components/goals/goal-grid";
import { Separator } from "@/components/ui/separator";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { getGoalsOverview } from "@/lib/goals/queries";
import { normalizeMonth } from "@/lib/budgets/month";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [overview, goals] = await Promise.all([
    getBudgetOverview(month),
    getGoalsOverview(),
  ]);
  const t = await getTranslations("Budgets");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {/* Two bands, because they answer to different clocks. Budgets are scoped
          to a month and goals are cumulative, so an unlabelled month picker at
          the top of the page would appear to scope both. Inside a labelled band
          it visibly belongs to budgets alone — the same fix /insights uses by
          putting its picker in one section's heading. */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("sectionTitle")}
        </h2>
        <BudgetGrid month={month} overview={overview} />
      </section>

      <Separator />

      <GoalGrid overview={goals} />
    </div>
  );
}
