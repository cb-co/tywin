"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
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
