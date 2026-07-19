"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function SpendDonut({
  data,
  total,
  currency,
}: {
  data: Insights["distribution"];
  total: number;
  currency: string;
}) {
  const t = useTranslations("Insights");
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendDonutEmpty")}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-center">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => formatMoney(Number(value), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">{t("thisMonth")}</span>
          <span className="figure text-xl text-foreground">{formatMoney(total, currency)}</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {data.slice(0, 7).map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate text-muted-foreground">{d.name}</span>
            </span>
            <span className="tabular-nums">{formatMoney(d.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
