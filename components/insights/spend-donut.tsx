"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { MoneyDisplay } from "@/components/ui/money-display";
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
  const maskedFormat = useMaskedFormatMoney();
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendDonutEmpty")}</p>;
  }

  return (
    // Ring and legend side by side at every width above mobile. This card is
    // laid out full-bleed on the insights page precisely so this split always
    // has room; stacking is only for phones.
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      {/* No height class: the ring's 256px sets it, and the centred total below
          overlays this box. A number rather than "100%" on the container because
          with both dimensions in percent it logs a width(-1)/height(-1) warning
          on the render before its ResizeObserver measures. */}
      <div className="relative mx-auto w-full max-w-[17rem]">
        <ResponsiveContainer width="100%" height={256}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              // A heavier band than the hairline ring this replaced: at 40% of
              // the radius the arcs are objects in their own right rather than
              // an outline around the total. The hole still clears the centred
              // figure below — a `stat` money figure is 24px with a shrunk
              // tail, and 58% of a 128px radius leaves ~148px of clear width.
              innerRadius="58%"
              outerRadius="98%"
              // A 2px gap in the surface colour between segments, plus rounded
              // ends. The previous flat ring was one continuous band of colour
              // with hairline wedges cut out of it; separating the arcs is what
              // makes them read as distinct quantities rather than a pie chart
              // texture. The radius is well under half the new band width, so
              // the caps read as softened rather than turning thin slices into
              // lozenges.
              cornerRadius={10}
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
              formatter={(value) => maskedFormat(Number(value), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Inset so a long total wraps inside the hole instead of running out
            over the arcs. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-14 text-center">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("thisMonth")}
          </span>
          <MoneyDisplay
            amount={total}
            currency={currency}
            size="stat"
            className="leading-none"
          />
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
                  {maskedFormat(d.value, currency)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
