"use client";

import dynamic from "next/dynamic";

export const BalanceChart = dynamic(
  () => import("./balance-chart").then((m) => m.BalanceChart),
  {
    ssr: false,
    loading: () => <div className="skeleton h-56 rounded-xl" />,
  },
);
