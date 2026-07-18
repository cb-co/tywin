"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function CashflowChart({
  data,
  currency,
}: {
  data: Insights["trend"];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No cash flow yet.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={44}
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
          <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name="Expense" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line dataKey="net" name="Net" stroke="var(--foreground)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
