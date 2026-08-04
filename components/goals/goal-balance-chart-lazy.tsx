"use client";

import dynamic from "next/dynamic";

export const GoalBalanceChart = dynamic(
  () => import("./goal-balance-chart").then((m) => m.GoalBalanceChart),
  {
    ssr: false,
    loading: () => <div className="skeleton h-64 rounded-xl" />,
  },
);
