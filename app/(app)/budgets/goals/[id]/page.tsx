import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getGoalDetail } from "@/lib/goals/queries";
import { formatMoney } from "@/lib/format";
import { GoalBar, PaceSummary } from "@/components/goals/goal-progress";
import { GoalBalanceChart } from "@/components/goals/goal-balance-chart-lazy";
import { ContributionsList } from "@/components/goals/contributions-list";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getGoalDetail(id);
  if (!detail) notFound();

  const { goal, contributions, history, baseCurrency, accounts } = detail;

  const t = await getTranslations("GoalDetail");
  const tg = await getTranslations("Goals");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/budgets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backLink")}
      </Link>

      <div className="space-y-3 border-b pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ColorTile color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{goal.name}</h1>
          </div>
          <p className="figure text-lg font-medium tabular-nums text-foreground">
            {tg("amountOfTarget", {
              saved: formatMoney(goal.saved, baseCurrency),
              target: formatMoney(goal.target_amount, baseCurrency),
            })}
          </p>
        </div>
        <GoalBar goal={goal} />
        <PaceSummary pace={goal.pace} currency={baseCurrency} className="text-sm" />
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-medium text-foreground">{t("balanceOverTime")}</h2>
        <GoalBalanceChart data={history} currency={baseCurrency} />
      </Card>

      <ContributionsList
        goal={goal}
        contributions={contributions}
        accounts={accounts}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
