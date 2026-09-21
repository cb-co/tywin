"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PlateDefs, PLATE_AXIS, PLATE_GRID, PLATE_TOOLTIP_STYLE } from "@/components/papel/plate-defs";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

export function SpendingPace({
  data,
  currency,
}: {
  data: Insights["pace"];
  currency: string;
}) {
  const t = useTranslations("Insights");
  const hasData = data.some((d) => (d.thisMonth ?? 0) > 0 || (d.lastMonth ?? 0) > 0);
  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("spendingPaceEmpty")}</p>;
  }

  return (
    // A number, not "100%": with both dimensions in percent, ResponsiveContainer
    // logs a width(-1)/height(-1) warning on the render before its
    // ResizeObserver measures. One fixed dimension satisfies the check.
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <PlateDefs />
        <CartesianGrid {...PLATE_GRID} />
        <XAxis dataKey="day" {...PLATE_AXIS} minTickGap={20} />
        <YAxis
          {...PLATE_AXIS}
          width={48}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip
          contentStyle={PLATE_TOOLTIP_STYLE}
          formatter={(value) => formatMoney(Number(value), currency)}
          labelFormatter={(label) => t("dayLabel", { day: label })}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* This chart's two lines are the only Insights legend that isn't
            calendar-month scoped: a semimonthly/weekly profile is comparing
            against its own equal-length previous period (spending_pace_range),
            not literally "last month". So these use dedicated paceThisPeriod/
            paceLastPeriod keys rather than the thisMonth/lastMonth keys —
            spend-ledger.tsx uses those same shared keys for its own caption,
            which must keep reading "this month" verbatim. */}
        <Line
          dataKey="lastMonth"
          name={t("paceLastPeriod")}
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          connectNulls
        />
        <Line
          dataKey="thisMonth"
          name={t("paceThisPeriod")}
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
