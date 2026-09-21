import { useTranslations } from "next-intl";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { LedgerRow } from "@/components/papel/ledger-row";
import { ProofMark } from "@/components/papel/proof-mark";
import { RuleMeter } from "@/components/papel/rule-meter";
import { meterArgs } from "@/lib/budgets/bar";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function BudgetBars({
  data,
  currency,
}: {
  data: Insights["budgetBars"];
  currency: string;
}) {
  const t = useTranslations("Insights");
  const overLabel = useTranslations("Budgets")("statusOver");
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("budgetBarsEmpty")}</p>;
  }

  return (
    <div className="-mx-4 -mb-4">
      {data.map((row) => {
        const over = row.budget > 0 && row.used > row.budget;
        // The true percent prints; RuleMeter clamps its own fill.
        const pct = row.budget > 0 ? Math.max((row.used / row.budget) * 100, 0) : row.used > 0 ? 100 : 0;
        const ofBudget = row.budget > 0 ? t("budgetOf", { amount: formatMoney(row.budget, currency) }) : undefined;
        return (
          <LedgerBlock
            key={row.name}
            head={
              <LedgerRow
                title={row.name}
                subtitle={ofBudget}
                amount={formatMoney(row.used, currency)}
                meta={formatPercent(pct)}
              />
            }
          >
            <RuleMeter {...meterArgs(row.used, row.budget)} pct={pct} label={row.name} overLabel={overLabel} near={pct >= 85 && !over} />
            {over ? <ProofMark tone="flag">{overLabel}</ProofMark> : null}
          </LedgerBlock>
        );
      })}
    </div>
  );
}
