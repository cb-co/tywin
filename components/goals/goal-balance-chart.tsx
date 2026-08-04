"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { useTranslations } from "next-intl";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import type { GoalPoint } from "@/lib/goals/history";

export function GoalBalanceChart({ data, currency }: { data: GoalPoint[]; currency: string }) {
  const t = useTranslations("GoalDetail");
  const maskedFormat = useMaskedFormatMoney();
  if (data.length === 0 || data.every((d) => d.balance === 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("historyEmpty")}</p>;
  }

  // Zero only earns a line when the series actually crosses it; on an
  // all-positive run it would just sit on the axis and read as a second
  // baseline. Same rule as net-worth-chart.tsx.
  const crossesZero = data.some((d) => d.balance < 0) && data.some((d) => d.balance > 0);

  return (
    // A number, not "100%": with both dimensions in percent, ResponsiveContainer
    // logs a width(-1)/height(-1) warning on the render before its
    // ResizeObserver measures. One fixed dimension satisfies the check.
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="goalBalanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="var(--muted-foreground)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={48}
          // Not the default [0, auto]: a goal balance can go negative via a
          // withdrawal that outpaces its contributions, and a run of large
          // positive months reads as a flat line when the axis is pinned to
          // zero.
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => maskedFormat(v, currency, { compact: true })}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => maskedFormat(Number(value), currency)}
        />
        {crossesZero && <ReferenceLine y={0} stroke="var(--border)" />}
        <Area
          dataKey="balance"
          name={t("seriesBalance")}
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#goalBalanceFill)"
          // Six points is few enough that each one is worth marking — the
          // reader is comparing months, not following a curve.
          dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
