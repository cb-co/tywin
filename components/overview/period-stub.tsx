"use client";

import { ArrowDownLeft, ArrowUpRight, PieChart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { ProofMark } from "@/components/papel/proof-mark";
import { formatPercent } from "@/lib/format";

const glyph = "size-4 shrink-0 text-muted-foreground";

/** The stub torn from the Disponible note: the period's three figures as one
 *  ruled table. The dashed rule on top is the perforation; it is plain CSS on
 *  purpose (a new primitive would need a DESIGN.md change). */
export function PeriodStub({
  income, spending, used, budget, currency,
}: { income: number; spending: number; used: number; budget: number; currency: string }) {
  const t = useTranslations("Overview");
  const over = budget > 0 && used > budget;
  // The true percent prints; RuleMeter clamps its own fill, so a 160% spend
  // reads "160%" instead of a capped "100%".
  const pct = budget > 0 ? Math.max((used / budget) * 100, 0) : 0;

  return (
    <div>
      <div aria-hidden className="mx-2 border-t-2 border-dashed border-(--ink-soft)" />
      <Card className="gap-0 rounded-t-none border-t-0 p-0">
        <h2 className="legend px-4 pt-3 pb-1 text-[11px] text-muted-foreground">{t("thisPeriod")}</h2>
        <LedgerRow
          lead={<ArrowDownLeft aria-hidden className={glyph} />}
          title={t("incomeThisPeriod")}
          amount={<MoneyDisplay amount={income} currency={currency} size="inline" animate className="text-foreground" />}
        />
        <LedgerRow
          lead={<ArrowUpRight aria-hidden className={glyph} />}
          title={t("spendingThisPeriod")}
          amount={<MoneyDisplay amount={spending} currency={currency} size="inline" animate className="text-foreground" />}
        />
        <LedgerRow
          className="border-b-0 pb-2"
          lead={<PieChart aria-hidden className={glyph} />}
          title={t("budgetUsed")}
          amount={
            <>
              <MoneyDisplay amount={used} currency={currency} size="inline" animate className="text-foreground" />
              <p className="figure text-xs text-muted-foreground">{budget > 0 ? formatPercent(pct) : "—"}</p>
            </>
          }
        />
        {/* The meter is a block element, so it sits in its own row rather than
            inside LedgerRow's subtitle <p>. */}
        <div className="px-4 pb-3">
          <RuleMeter used={used} total={budget} label={t("budgetUsed")} overLabel={t("budgetOverLabel")} />
          {over ? <ProofMark tone="flag" className="mt-1.5">{t("budgetOverBy", { pct: formatPercent(pct) })}</ProofMark> : null}
        </div>
      </Card>
    </div>
  );
}
