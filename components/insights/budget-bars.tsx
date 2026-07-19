import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function BudgetBars({
  data,
  currency,
}: {
  data: Insights["budgetBars"];
  currency: string;
}) {
  const t = useTranslations("Insights");
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("budgetBarsEmpty")}</p>;
  }

  return (
    <div className="space-y-4">
      {data.map((row) => {
        const over = row.budget > 0 && row.used > row.budget;
        const pct = row.budget > 0 ? Math.min((row.used / row.budget) * 100, 100) : row.used > 0 ? 100 : 0;
        return (
          <div key={row.name}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">{row.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatMoney(row.used, currency)}
                {row.budget > 0 ? ` / ${formatMoney(row.budget, currency)}` : ""}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: over ? "var(--destructive)" : "var(--chart-1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
