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
    // Ring and legend side by side at every width above mobile. This card is
    // laid out full-bleed on the insights page precisely so this split always
    // has room; stacking is only for phones.
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto h-64 w-full max-w-[17rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="98%"
              // A 2px gap in the surface colour between segments, plus rounded
              // ends. The previous flat ring was one continuous band of colour
              // with hairline wedges cut out of it; separating the arcs is what
              // makes them read as distinct quantities rather than a pie chart
              // texture.
              cornerRadius={5}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
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
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("thisMonth")}
          </span>
          <span className="figure text-2xl leading-none text-foreground">
            {formatMoney(total, currency)}
          </span>
        </div>
      </div>
      {/* Each row carries its share as well as its amount. The ring shows
          proportion but cannot be measured by eye past the largest two or
          three slices, so the number does that job instead. */}
      <ul className="divide-y divide-border/70">
        {data.slice(0, 7).map((d) => {
          const share = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li key={d.name} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate text-foreground">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2.5">
                <span className="figure text-xs text-muted-foreground">
                  {share.toFixed(share < 10 ? 1 : 0)}%
                </span>
                <span className="figure tabular-nums text-foreground">
                  {formatMoney(d.value, currency)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
