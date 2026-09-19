"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { TransactionWithRefs } from "@/lib/transactions/queries";

/* occurred_at is UTC midnight of a plain calendar date — format in UTC so the
   label doesn't roll back a day for users west of UTC. */
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function delta(txn: TransactionWithRefs, accountId: string): number {
  if (txn.account_id === accountId) {
    return txn.type === "income" ? txn.amount : -txn.total_amount;
  }
  if (txn.to_account_id === accountId && txn.type === "payment") return txn.to_amount ?? txn.amount;
  return 0;
}

export function BalanceChart({
  accountId,
  startingBalance,
  currency,
  transactions,
}: {
  accountId: string;
  startingBalance: number;
  currency: string;
  transactions: TransactionWithRefs[];
}) {
  const t = useTranslations("AccountDetail");
  const series = useMemo(() => {
    const asc = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    // A plain loop, not `map` with an outer accumulator: reassigning a captured
    // variable from inside a render-phase callback is what
    // `react-hooks/immutability` rejects. `running` stays unrounded across
    // iterations and is rounded only for display, so a long run of fractional
    // movements can't compound a rounding drift into the line.
    const points: { date: string; balance: number }[] = [];
    let running = startingBalance;
    for (const txn of asc) {
      running += delta(txn, accountId);
      points.push({
        date: dateFmt.format(new Date(txn.occurred_at)),
        balance: Math.round(running * 100) / 100,
      });
    }
    return [{ date: t("chartStartLabel"), balance: startingBalance }, ...points];
  }, [transactions, accountId, startingBalance, t]);

  if (series.length <= 1) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("noMovementYet")}</p>;
  }

  return (
    // A number, not "100%": with both dimensions in percent, ResponsiveContainer
    // logs a width(-1)/height(-1) warning on the render before its
    // ResizeObserver measures. One fixed dimension satisfies the check.
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
        <XAxis dataKey="date" stroke="var(--ink-soft)" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis
          stroke="var(--ink-soft)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip
          contentStyle={{
            background: "var(--paper-2)",
            border: "1px solid var(--paper-line)",
            borderRadius: 4,
            fontSize: 12,
          }}
          formatter={(value) => formatMoney(Number(value), currency)}
        />
        <Line dataKey="balance" stroke="var(--ink)" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
