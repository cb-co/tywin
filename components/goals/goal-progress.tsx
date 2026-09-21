"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { ProofMark } from "@/components/papel/proof-mark";
import { cn } from "@/lib/utils";
import type { GoalCardRow } from "@/lib/goals/queries";
import type { Pace } from "@/lib/goals/pace";

/**
 * Share of the target that is saved, 0–100.
 *
 * Clamped at both ends: net withdrawals can drive `saved` negative, and a goal
 * overshot past its target has still only filled the strip once. Exported so the
 * strip and the percentage beside it are the same number by construction.
 */
export function goalProgressPct(goal: Pick<GoalCardRow, "saved" | "target_amount">) {
  const target = goal.target_amount;
  return target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
}

const PACE_TONE = { success: "ok", warning: "flag", destructive: "flag" } as const;

/**
 * The pace, read as two objects instead of one sentence: the arithmetic stays
 * muted body text, the verdict prints as a proof mark; the glyph and the label
 * carry the state, colour only reinforces it.
 *
 * They used to run together — "Need $1,212.50/mo · saving $300.00/mo Behind" —
 * where the verdict was nothing but a coloured word at the end of the same
 * line, which reads as the tail of the sentence rather than as a status. Colour
 * alone was carrying it, and colour alone is the one signal some readers do not
 * get. The proof mark gives it a shape, a border and its own place on the line.
 *
 * Kinds that are ALREADY only a verdict (complete, overdue) render as the proof mark
 * with no text beside it; kinds that are only arithmetic (no-pace, projection,
 * shortfall) render as text with no mark. Nothing is stated twice.
 */
type PaceParts = {
  detail: string | null;
  status: { label: string; tone: "success" | "warning" | "destructive" } | null;
};

/** All seven `Pace` variants must be handled here — the type has no fallback member. */
function usePaceParts(pace: Pace, currency: string): PaceParts {
  const t = useTranslations("Goals");

  const needVsActual = (required: number, actual: number) =>
    t("paceNeedVsActual", {
      required: formatMoney(required, currency),
      actual: formatMoney(actual, currency),
    });

  switch (pace.kind) {
    case "shortfall":
      return {
        detail: t("paceShortfall", { amount: formatMoney(pace.amount, currency) }),
        status: null,
      };
    case "complete":
      return { detail: null, status: { label: t("paceComplete"), tone: "success" } };
    case "overdue":
      return { detail: null, status: { label: t("paceOverdue"), tone: "destructive" } };
    case "no-pace":
      return { detail: t("paceNone"), status: null };
    case "on-track":
      return {
        detail: needVsActual(pace.required, pace.actual),
        status: { label: t("paceOnTrack"), tone: "success" },
      };
    case "behind":
      return {
        detail: needVsActual(pace.required, pace.actual),
        status: { label: t("paceBehind"), tone: "warning" },
      };
    case "projection":
      return {
        detail: t("paceProjection", {
          actual: formatMoney(pace.actual, currency),
          months: pace.months,
        }),
        status: null,
      };
  }
}

/**
 * One line, two objects: the arithmetic on the left taking whatever the mark
 * leaves and wrapping inside it, the verdict pinned right.
 *
 * The row never wraps as a row — the mark holds its corner and the text reflows
 * around it — so the verdict is in the same place on every block regardless of
 * how long the sentence beside it runs.
 *
 * Either half can be absent, and the ones that are absent are the ones that
 * would repeat: "Target reached" and "Overdue" are the whole reading, with no
 * arithmetic to show beneath them, while a projection or a borrowed-back
 * shortfall is arithmetic with no verdict to give. `ms-auto` is what keeps a
 * lone mark in its corner, where `justify-between` alone would drop it to the
 * left; with both halves present it changes nothing.
 */
export function PaceSummary({
  pace,
  currency,
  className,
}: {
  pace: Pace;
  currency: string;
  className?: string;
}) {
  const { detail, status } = usePaceParts(pace, currency);

  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      {detail ? (
        <p
          className={cn(
            "min-w-0 tabular-nums",
            // A shortfall is the one detail that is itself the bad news.
            pace.kind === "shortfall" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {detail}
        </p>
      ) : null}
      {status ? (
        <ProofMark tone={PACE_TONE[status.tone]} className="ms-auto shrink-0">
          {status.label}
        </ProofMark>
      ) : null}
    </div>
  );
}
