"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PlateDefs, PLATE_AXIS, PLATE_GRID, PLATE_TOOLTIP_STYLE } from "@/components/papel/plate-defs";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import type { Insights } from "@/lib/insights/queries";

export function CashflowChart({
  data,
  currency,
}: {
  data: Insights["trend"];
  currency: string;
}) {
  const t = useTranslations("Insights");
  const maskedFormat = useMaskedFormatMoney();
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("cashflowEmpty")}</p>;
  }

  return (
    // A number, not "100%": with both dimensions in percent, ResponsiveContainer
    // logs a width(-1)/height(-1) warning on the render before its
    // ResizeObserver measures. One fixed dimension satisfies the check.
    <ResponsiveContainer width="100%" height={256}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <PlateDefs />
        <CartesianGrid {...PLATE_GRID} />
        <XAxis dataKey="month" {...PLATE_AXIS} />
        <YAxis
          {...PLATE_AXIS}
          width={44}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip
          contentStyle={PLATE_TOOLTIP_STYLE}
          // Expense stays legible even when figures are masked; income and
          // the net line derive from it and mask along with the rest.
          formatter={(value, _name, item) =>
            item?.dataKey === "expense"
              ? formatMoney(Number(value), currency)
              : maskedFormat(Number(value), currency)
          }
        />
        <Bar dataKey="income" name={t("seriesIncome")} fill="url(#plate-1)" stroke="var(--chart-1)" strokeWidth={1.25} maxBarSize={28} />
        <Bar dataKey="expense" name={t("seriesExpense")} fill="url(#plate-4)" stroke="var(--chart-4)" strokeWidth={1.25} maxBarSize={28} />
        <Line dataKey="net" name={t("seriesNet")} stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: "var(--foreground)", strokeWidth: 0 }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
