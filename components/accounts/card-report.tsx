import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ImportButton } from "@/components/statements/import-button";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { AccountCostOfCarry } from "@/lib/accounts/queries";

export type CardReportProps = {
  currency: string;
  locale: string;
  year: number;
  monthLabel: string;
  carry: AccountCostOfCarry | null;
  /** null when no statement this year reported a cashback figure. */
  cashback: number | null;
  fees: { recurring: number; incidents: number };
  paymentsThisMonth: number;
  bonus: { spent: number; goal: number; goalCurrency: string; dueDate: string } | null;
};

function Row({ label, detail, amount }: { label: string; detail?: string; amount: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="text-foreground">{label}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <span className="shrink-0 tabular-nums text-foreground">{amount}</span>
    </div>
  );
}

/**
 * Boleta de la tarjeta — the standing facts that let someone judge this card
 * against another one: what financing costs, what it pays back, what it charges
 * to hold, what went into it this month, and the welcome bonus still in play.
 *
 * Each row renders only when it has real data. A card with no statement yet
 * shows a single line instead of five confident zeros — and the section itself
 * stays, so its absence never reads as a failed load.
 *
 * Costs and cashback sit side by side and are never netted: most of a card's
 * benefits never reach a statement, so a net figure would be wrong in one
 * direction. Every amount is in the card's own currency.
 *
 * Fee subtotals can go negative (summarizeCardFees nets in reversals of a prior
 * year's charge). The figure always shows the magnitude and the label says
 * "refunded" instead — a bare minus under a cost heading reads backwards.
 */
export function CardReport({
  currency,
  locale,
  year,
  monthLabel,
  carry,
  cashback,
  fees,
  paymentsThisMonth,
  bonus,
}: CardReportProps) {
  const t = useTranslations("AccountDetail");
  // String, not the number: ICU formats a numeric argument through
  // Intl.NumberFormat, which would print "2,026".
  const y = String(year);
  const money = (n: number) => formatMoney(Math.abs(n), currency);

  const rows: React.ReactNode[] = [];
  if (carry) {
    rows.push(
      <Row
        key="carry"
        label={t("cardReportCarry")}
        detail={[
          carry.apr !== null ? t("cardReportCarryApr", { rate: carry.apr }) : null,
          t("cardReportCarryDetail", { date: formatDate(carry.periodEnd, locale) }),
        ]
          .filter(Boolean)
          .join(" · ")}
        amount={formatMoney(carry.costOfCarry, currency)}
      />,
    );
  }
  if (cashback !== null) {
    rows.push(<Row key="cashback" label={t("cardReportCashback", { year: y })} amount={money(cashback)} />);
  }
  if (fees.recurring !== 0) {
    rows.push(
      <Row
        key="ownership"
        label={t(fees.recurring < 0 ? "cardReportOwnershipRefunded" : "cardReportOwnership", { year: y })}
        amount={money(fees.recurring)}
      />,
    );
  }
  if (fees.incidents !== 0) {
    rows.push(
      <Row
        key="incidents"
        label={t(fees.incidents < 0 ? "cardReportIncidentsRefunded" : "cardReportIncidents", { year: y })}
        amount={money(fees.incidents)}
      />,
    );
  }
  if (paymentsThisMonth !== 0) {
    rows.push(
      <Row
        key="payments"
        label={t("cardReportPayments", { month: monthLabel })}
        amount={money(paymentsThisMonth)}
      />,
    );
  }

  const bonusPct = bonus ? (bonus.spent / bonus.goal) * 100 : 0;

  return (
    <Card className="gap-0 p-6">
      <h2 className="mb-4 text-lg font-medium text-foreground">{t("cardReportTitle")}</h2>
      {rows.length === 0 && !bonus ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">{t("cardReportEmpty")}</p>
          <ImportButton size="sm" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows}
          {bonus ? (
            <div className={`space-y-2 ${rows.length > 0 ? "border-t pt-3" : ""}`}>
              <div className="flex justify-between text-sm text-foreground">
                <span>{t("welcomeBonusProgress")}</span>
                <span className="tabular-nums">{formatPercent(bonusPct)}</span>
              </div>
              <Progress value={Math.min(Math.max(bonusPct, 0), 100)} />
              <p className="text-xs text-muted-foreground">
                {t("welcomeBonusDetail", {
                  spent: formatMoney(bonus.spent, bonus.goalCurrency),
                  goal: formatMoney(bonus.goal, bonus.goalCurrency),
                  date: formatDate(bonus.dueDate, locale),
                })}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
