"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { CategoryTransactionsSheet } from "./category-transactions-sheet";
import { shareRows } from "@/lib/insights/share";
import { monthEnd } from "@/lib/budgets/month";
import type { Insights } from "@/lib/insights/queries";
import type { TransactionWithRefs } from "@/lib/transactions/queries";
import { loadTransactions } from "@/app/(app)/transactions/actions";
import { loadInsightsSpendTransactions } from "@/app/(app)/insights/actions";

/** Where a row's drilldown transactions come from — the two current
 *  SpendLedger call sites need different queries (see lib/insights/spend-rule.ts
 *  for why "insights" can't just reuse "account"'s plain category+type filter). */
export type SpendLedgerScope = { kind: "account"; accountId: string } | { kind: "insights" };

type SelectedCategory = { name: string; value: number };

export function SpendLedger({
  data,
  total,
  currency,
  month,
  scope,
}: {
  data: Insights["distribution"];
  total: number;
  currency: string;
  /** First-of-month string the drilldown fetch is windowed to. */
  month: string;
  scope: SpendLedgerScope;
}) {
  const t = useTranslations("Insights");
  const maskedFormat = useMaskedFormatMoney();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedCategory | null>(null);
  const [rows, setRows] = useState<TransactionWithRefs[] | null>(null);
  const [, startTransition] = useTransition();
  // Guards against a slower first fetch overwriting a faster second one when
  // two rows are tapped in quick succession.
  const requestId = useRef(0);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendDonutEmpty")}</p>;
  }
  const rowsData = shareRows(data, total);
  const largest = Math.max(...rowsData.map((r) => r.value), 1);

  function openCategory(r: (typeof rowsData)[number]) {
    const name = r.rest ? t("spendOther") : r.name;
    setSelected({ name, value: r.value });
    setRows(null);
    setOpen(true);

    const id = ++requestId.current;
    startTransition(async () => {
      const fetched =
        scope.kind === "account"
          ? (
              await loadTransactions({
                accountId: scope.accountId,
                categoryIds: r.categoryIds,
                type: "expense",
                from: month,
                to: monthEnd(month),
              })
            ).rows
          : await loadInsightsSpendTransactions(month, r.categoryIds);
      if (id === requestId.current) setRows(fetched);
    });
  }

  return (
    <div className="-mx-4 -mb-4">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-3">
        <span className="legend text-[11px] text-muted-foreground">{t("thisMonth")}</span>
        <MoneyDisplay amount={total} currency={currency} size="stat" />
      </div>
      <ul className="border-t border-(--paper-line)">
        {rowsData.map((r) => {
          const name = r.rest ? t("spendOther") : r.name;
          const body = (
            <>
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
            </>
          );
          return (
            <li key={r.rest ? "rest" : r.name} className="border-b border-(--paper-line) last:border-b-0">
              <button type="button" className="block w-full text-left" onClick={() => openCategory(r)}>
                {body}
              </button>
            </li>
          );
        })}
      </ul>
      <CategoryTransactionsSheet
        open={open}
        onOpenChange={setOpen}
        name={selected?.name ?? ""}
        month={month}
        amount={selected ? maskedFormat(selected.value, currency) : null}
        rows={rows}
      />
    </div>
  );
}
