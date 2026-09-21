"use client";

import { useTranslations } from "next-intl";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { shareRows } from "@/lib/insights/share";
import type { Insights } from "@/lib/insights/queries";

export function SpendLedger({ data, total, currency }: { data: Insights["distribution"]; total: number; currency: string }) {
  const t = useTranslations("Insights");
  const maskedFormat = useMaskedFormatMoney();
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendDonutEmpty")}</p>;
  }
  const rows = shareRows(data, total);
  const largest = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="-mx-4 -mb-4">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3">
        <span className="legend text-[11px] text-muted-foreground">{t("thisMonth")}</span>
        <MoneyDisplay amount={total} currency={currency} size="stat" />
      </div>
      <ul className="border-t border-(--paper-line)">
        {rows.map((r) => {
          const name = r.rest ? t("spendOther") : r.name;
          return (
            <li key={r.rest ? "rest" : r.name} className="border-b border-(--paper-line) last:border-b-0">
              <LedgerRow
                className="border-b-0 pb-1.5"
                lead={<Stamp color={r.color} emoji={r.emoji} name={name} />}
                title={name}
                amount={maskedFormat(r.value, currency)}
                meta={`${r.pct.toFixed(r.pct < 10 ? 1 : 0)}%`}
              />
              <div className="px-4 pb-3">
                <RuleMeter used={r.value} total={largest} label={`${name} ${r.pct.toFixed(0)}%`} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
