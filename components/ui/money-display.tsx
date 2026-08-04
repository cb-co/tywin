"use client";

import { splitMoney } from "@/lib/money-parts";
import { formatMoney, type MoneyOpts } from "@/lib/format";
import { useFigureMask } from "@/components/figure-mask/figure-mask-provider";
import { maskFigure } from "@/components/figure-mask/mask-figure";
import { cn } from "@/lib/utils";

const SIZES = {
  // Jakarta at 800 with tight tracking. This is the loudest object on a screen.
  hero: { head: "text-5xl sm:text-6xl font-extrabold tracking-[-0.03em]", cents: "text-[0.6em]" },
  stat: { head: "text-2xl font-extrabold tracking-[-0.02em]", cents: "text-[0.62em]" },
  inline: { head: "text-base font-semibold", cents: "text-[0.75em]" },
} as const;

/**
 * A money figure with de-emphasised cents — the "$8,822.⁸⁹" treatment.
 *
 * Masked figures are never split: the mask replaces digits with glyphs, and
 * shrinking the tail of a masked string just looks like a rendering fault.
 */
export function MoneyDisplay({
  amount,
  currency,
  size = "stat",
  opts,
  className,
}: {
  amount: number;
  currency: string;
  size?: keyof typeof SIZES;
  opts?: MoneyOpts;
  className?: string;
}) {
  const { masked } = useFigureMask();
  const s = SIZES[size];

  if (masked) {
    return (
      <span className={cn("figure tabular-nums", s.head, className)}>
        {maskFigure(formatMoney(amount, currency, opts))}
      </span>
    );
  }

  const { head, sep, cents } = splitMoney(amount, currency, opts);
  return (
    <span className={cn("figure tabular-nums", s.head, className)}>
      {head}
      {cents ? (
        <span className={cn(s.cents, "font-bold opacity-60")}>
          {sep}
          {cents}
        </span>
      ) : null}
    </span>
  );
}
