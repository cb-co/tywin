"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/lib/format";
import type { TransactionWithRefs } from "@/lib/transactions/queries";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function delta(txn: TransactionWithRefs, accountId: string): number {
  if (txn.budget_only) return 0;
  if (txn.account_id === accountId) {
    return txn.type === "income" ? txn.amount : -txn.total_amount;
  }
  if (txn.to_account_id === accountId && txn.type === "payment") return txn.amount;
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
  const series = useMemo(() => {
    const asc = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    let running = startingBalance;
    const points = asc.map((t) => {
      running += delta(t, accountId);
      return { date: dateFmt.format(new Date(t.occurred_at)), balance: Math.round(running * 100) / 100 };
    });
    return [{ date: "Start", balance: startingBalance }, ...points];
  }, [transactions, accountId, startingBalance]);

  if (series.length <= 1) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No movement to chart yet.</p>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => formatMoney(Number(value), currency)}
          />
          <Area
            dataKey="balance"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#balanceFill)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
