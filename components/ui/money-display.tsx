"use client";

import { splitMoney } from "@/lib/money-parts";
import { formatMoney, type MoneyOpts } from "@/lib/format";
import { useFigureMask } from "@/components/figure-mask/figure-mask-provider";
import { maskFigure } from "@/components/figure-mask/mask-figure";
import { useCountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

const SIZES = {
  // Inter with tight tracking (`.figure` sets the family). The hero is the
  // loudest object on a screen, but it is already carrying size, colour and a
  // gradient slab — at 700 the weight was the third thing shouting, so it sits
  // at 600 and lets the scale do the work.
  hero: { head: "text-5xl sm:text-6xl font-semibold tracking-[-0.03em]", cents: "text-[0.6em]" },
  // One step above `stat`, for a figure that leads a section but is not the
  // page's subject — a summary bar's total sitting above cards that each use
  // `stat`. It needs to out-rank them without reading as a hero.
  feature: { head: "text-3xl sm:text-4xl font-bold tracking-[-0.025em]", cents: "text-[0.61em]" },
  stat: { head: "text-2xl font-bold tracking-[-0.02em]", cents: "text-[0.62em]" },
  inline: { head: "text-base font-semibold", cents: "text-[0.75em]" },
} as const;

/**
 * A money figure with de-emphasised cents — the "$8,822.⁸⁹" treatment.
 *
 * Masked figures are never split: the mask replaces digits with glyphs, and
 * shrinking the tail of a masked string just looks like a rendering fault.
 *
 * `animate` counts the figure up on arrival. It is opt-in rather than the
 * default because most money on screen is reference data in a list — a table of
 * transactions all counting up at once is noise, not delight. Reserve it for
 * the one or two figures a screen is actually about.
 */
export function MoneyDisplay({
  amount,
  currency,
  size = "stat",
  opts,
  animate = false,
  className,
}: {
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  opts?: MoneyOpts;
  animate?: boolean;
  className?: string;
}) {
  const { masked } = useFigureMask();
  // Never counts while masked: the glyphs do not change as the number climbs,
  // so it would be an animation with nothing to show.
  const shown = useCountUp(amount, animate && !masked);
  const s = SIZES[size];

  if (masked) {
    return (
      <span className={cn("figure tabular-nums", s.head, className)}>
        {maskFigure(formatMoney(amount, currency, opts))}
      </span>
    );
  }

  const { head, sep, cents } = splitMoney(shown, currency, opts);
  return (
    <span className={cn("figure tabular-nums", s.head, className)}>
      {head}
      {cents ? (
        <span className={cn(s.cents, "font-semibold opacity-60")}>
          {sep}
          {cents}
        </span>
      ) : null}
    </span>
  );
}
