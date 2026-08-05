"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { formatMoney } from "@/lib/format";
import { StatPill } from "@/components/ui/stat-pill";
import { cn } from "@/lib/utils";
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
/**
 * Share of the target that is saved, 0–100.
 *
 * Clamped at both ends: net withdrawals can drive `saved` negative, and a goal
 * overshot past its target has still only filled the bar once. Exported so the
 * bar and the percentage chip beside it are the same number by construction.
 */
export function goalProgressPct(goal: Pick<GoalCardRow, "saved" | "target_amount">) {
  const target = goal.target_amount;
  return target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
}

export function GoalBar({ goal }: { goal: GoalCardRow }) {
  const target = goal.target_amount;
  const filled = goalProgressPct(goal);
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;
  const reached = target > 0 && goal.saved >= target;

  // Seeded with the value at mount, so a goal that was ALREADY complete when
  // the page loaded does not replay its celebration on every visit. Only a
  // transition into completion counts as an arrival.
  const wasReached = useRef(reached);
  const burstRef = useRef<HTMLSpanElement>(null);

  // SoundProvider redeclares playSuccess on every one of its renders, so the
  // function identity is not stable. Putting it in the dependency array below
  // would re-run the effect on unrelated parent renders and fire the burst
  // repeatedly — exactly the once-per-arrival rule it is here to keep. Reading
  // it through a ref synced in its own effect keeps the burst's dependencies
  // down to the one boolean that actually means something.
  const sound = useUiSound();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  });

  useEffect(() => {
    if (reached === wasReached.current) return;
    wasReached.current = reached;
    if (!reached) return;

    const el = burstRef.current;
    if (!el) return;

    // Driven straight at the DOM rather than through state. A fire-and-forget
    // animation is exactly the "external system" an effect is meant to talk to,
    // and toggling React state here would cascade a render for something that
    // never affects the tree. Removing the class, forcing a reflow, then adding
    // it back is what makes a SECOND arrival replay the animation instead of
    // finding it already finished.
    el.classList.remove("burst");
    void el.offsetWidth;
    el.classList.add("burst");

    soundRef.current.playSuccess();
  }, [reached]);

  return (
    // The bar itself clips its segments, so the burst cannot live inside it.
    <div className="relative mt-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
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
      {/* Always mounted and invisible until the effect adds the burst class.
          The keyframes hold their end state, so it returns to invisible on its
          own without anything having to unmount it. */}
      <span
        ref={burstRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-2 opacity-0"
        style={{ borderColor: goal.color ?? "var(--brand)" }}
      />
    </div>
  );
}

/**
 * The pace, read as two objects instead of one sentence: the arithmetic stays
 * muted body text, the verdict becomes a chip.
 *
 * They used to run together — "Need $1,212.50/mo · saving $300.00/mo Behind" —
 * where the verdict was nothing but a coloured word at the end of the same
 * line, which reads as the tail of the sentence rather than as a status. Colour
 * alone was carrying it, and colour alone is the one signal some readers do not
 * get. The chip gives it a shape, a background and its own place on the line.
 *
 * Kinds that are ALREADY only a verdict (complete, overdue) render as the chip
 * with no text beside it; kinds that are only arithmetic (no-pace, projection,
 * shortfall) render as text with no chip. Nothing is stated twice.
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
 * One line, two objects: the arithmetic on the left taking whatever the chip
 * leaves and wrapping inside it, the verdict pinned right.
 *
 * The row never wraps as a row — the chip holds its corner and the text reflows
 * around it — so the verdict is in the same place on every card regardless of
 * how long the sentence beside it runs.
 *
 * Either half can be absent, and the ones that are absent are the ones that
 * would repeat: "Target reached" and "Overdue" are the whole reading, with no
 * arithmetic to show beneath them, while a projection or a borrowed-back
 * shortfall is arithmetic with no verdict to give. `ms-auto` is what keeps a
 * lone chip in its corner, where `justify-between` alone would drop it to the
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
        <StatPill tone={status.tone} className="ms-auto shrink-0">
          {status.label}
        </StatPill>
      ) : null}
    </div>
  );
}
