"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { GoalCardRow } from "@/lib/goals/queries";
import type { Pace } from "@/lib/goals/pace";

/**
 * Two segments: what is actually there in the goal's own colour, then what has
 * been borrowed back in a warning tint. A goal spent into looks visibly
 * hollowed out rather than merely reporting a smaller number.
 *
 * Shared by the grid card (goal-grid.tsx) and the goal detail page — extracted
 * here rather than duplicated, since that duplication was already flagged in
 * review once.
 */
export function GoalBar({ goal }: { goal: GoalCardRow }) {
  const target = goal.target_amount;
  // Clamped at the bottom because net withdrawals can drive `saved` negative.
  const filled = target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;

  return (
    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * backedShare}%`,
          backgroundColor: goal.color ?? "var(--brand)",
        }}
      />
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * (1 - backedShare)}%`,
          backgroundColor: "color-mix(in oklab, var(--warning) 45%, var(--muted))",
        }}
      />
    </div>
  );
}

/** All seven `Pace` variants must be handled here — the type has no fallback member. */
export function PaceLine({ pace, currency }: { pace: Pace; currency: string }) {
  const t = useTranslations("Goals");
  switch (pace.kind) {
    case "shortfall":
      return (
        <span className="text-destructive">
          {t("paceShortfall", { amount: formatMoney(pace.amount, currency) })}
        </span>
      );
    case "complete":
      return <span className="text-success">{t("paceComplete")}</span>;
    case "overdue":
      return <span className="text-destructive">{t("paceOverdue")}</span>;
    case "no-pace":
      return <>{t("paceNone")}</>;
    case "on-track":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-success">{t("paceOnTrack")}</span>
        </>
      );
    case "behind":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-warning">{t("paceBehind")}</span>
        </>
      );
    case "projection":
      return (
        <>
          {t("paceProjection", {
            actual: formatMoney(pace.actual, currency),
            months: pace.months,
          })}
        </>
      );
  }
}
