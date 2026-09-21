"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { goalStripCells } from "@/lib/goals/strip";
import { goalProgressPct } from "./goal-progress";
import type { GoalCardRow } from "@/lib/goals/queries";
import { cn } from "@/lib/utils";

/** Cell looks. Solid = backed by real money; borrowed = hatched, so a goal
 *  spent into reads hollow; empty = dashed outline. All in ink: the goal's
 *  own colour lives on its Stamp, never on the strip. */
const CELL: Record<"solid" | "borrowed" | "empty", string> = {
  solid: "bg-foreground",
  borrowed: "bg-[repeating-linear-gradient(135deg,var(--ink)_0_1.5px,transparent_1.5px_4px)]",
  empty: "border-dashed opacity-60",
};

export function GoalStrip({ goal, decorative }: { goal: GoalCardRow; decorative?: boolean }) {
  const t = useTranslations("Goals");
  const pct = goalProgressPct(goal);
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;
  const cells = goalStripCells(pct, backedShare);
  const reached = goal.target_amount > 0 && goal.saved >= goal.target_amount;

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
    // The strip itself is a row of cells, so the burst sits over it as a sibling.
    <div className="relative mt-3">
      <div
        role={decorative ? undefined : "img"}
        aria-hidden={decorative ? true : undefined}
        aria-label={decorative ? undefined : t("stripLabel", { pct: Math.round(pct) })}
        className="flex gap-1"
      >
        {cells.map((kind, i) => (
          <i
            key={i}
            data-cell={kind}
            className={cn("h-3 flex-1 rounded-[1px] border border-foreground", CELL[kind])}
          />
        ))}
      </div>
      {/* Always mounted and invisible until the effect adds the burst class.
          The keyframes hold their end state, so it returns to invisible on its
          own without anything having to unmount it. */}
      <span
        ref={burstRef}
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-[2px] border-2 border-foreground opacity-0"
      />
    </div>
  );
}
