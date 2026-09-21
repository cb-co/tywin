"use client";

import dynamic from "next/dynamic";

export const SpendLedger = dynamic(
  () => import("./spend-ledger").then((m) => m.SpendLedger),
  {
    ssr: false,
    loading: () => (
      <div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-b border-(--paper-line) py-3">
            <div className="skeleton h-5 w-full rounded" />
          </div>
        ))}
      </div>
    ),
  },
);

export const CashflowChart = dynamic(
  () => import("./cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);

export const NetWorthChart = dynamic(
  () => import("./net-worth-chart").then((m) => m.NetWorthChart),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);

export const SpendingPace = dynamic(
  () => import("./spending-pace").then((m) => m.SpendingPace),
  { ssr: false, loading: () => <div className="skeleton h-64 rounded-xl" /> },
);
