"use client";

import dynamic from "next/dynamic";

export const SpendDonut = dynamic(
  () => import("./spend-donut").then((m) => m.SpendDonut),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-center">
        <div className="skeleton h-56 rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-5 rounded" />
          ))}
        </div>
      </div>
    ),
  },
);

export const CashflowChart = dynamic(
  () => import("./cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);

export const SpendingPace = dynamic(
  () => import("./spending-pace").then((m) => m.SpendingPace),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);
