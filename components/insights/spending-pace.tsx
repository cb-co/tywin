"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function SpendingPace({
  data,
  currency,
}: {
  data: Insights["pace"];
  currency: string;
}) {
  const hasData = data.some((d) => (d.thisMonth ?? 0) > 0 || (d.lastMonth ?? 0) > 0);
  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No spending to pace yet.</p>;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} minTickGap={20} />
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
            labelFormatter={(label) => `Day ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            dataKey="lastMonth"
            name="Last month"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
          <Line
            dataKey="thisMonth"
            name="This month"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
