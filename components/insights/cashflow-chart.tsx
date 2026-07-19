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
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function CashflowChart({
  data,
  currency,
}: {
  data: Insights["trend"];
  currency: string;
}) {
  const t = useTranslations("Insights");
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("cashflowEmpty")}</p>;
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
          <Bar dataKey="income" name={t("seriesIncome")} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name={t("seriesExpense")} fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line dataKey="net" name={t("seriesNet")} stroke="var(--foreground)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
