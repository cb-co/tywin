"use client";

import { useTranslations } from "next-intl";
import { Note } from "@/components/papel/note";
import { MoneyDisplay } from "@/components/ui/money-display";
import { periodSerial } from "@/lib/overview/period-serial";
import { fitFigureClass } from "@/lib/papel/fit";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The period's budget total, printed on the screen's one (peso) note. Used and
 * remaining sit under it as ruled lines. Overspend is the minus sign and the
 * heading it reads under, never a red figure: red on peso fails contrast, and
 * state must not ride on colour.
 */
export function BudgetNote({
  totalBudget,
  totalUsed,
  currency,
  periodStart,
}: {
  totalBudget: number;
  totalUsed: number;
  currency: string;
  periodStart: string;
}) {
  const t = useTranslations("Budgets");
  const tm = useTranslations("Marketing");
  const remaining = totalBudget - totalUsed;
  const figureClass = cn(fitFigureClass(formatMoney(totalBudget, currency)), "[font-stretch:125%] font-extrabold");
  return (
    <Note tone="peso" label={t("budgetLabel")} serial={periodSerial(periodStart)} microprint={tm("microprint")}>
      <MoneyDisplay amount={totalBudget} currency={currency} size="hero" className={figureClass} />
      <div className="mt-5 space-y-1.5 border-t border-current/30 pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="opacity-90">{t("usedLabel")}</span>
          <MoneyDisplay amount={totalUsed} currency={currency} size="inline" />
        </div>
        <div className="flex items-baseline justify-between gap-4 font-semibold">
          <span>{t("remainingLabel")}</span>
          <MoneyDisplay amount={remaining} currency={currency} size="inline" />
        </div>
      </div>
    </Note>
  );
}
