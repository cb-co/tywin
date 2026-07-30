"use client";

import { formatMoney } from "@/lib/format";
import { useFigureMask } from "./figure-mask-provider";
import { maskFigure } from "./mask-figure";

/** Renders a money figure, masking its digits while figure masking is on. */
export function MaskedMoney({
  amount,
  currency,
  opts,
}: {
  amount: number;
  currency: string;
  opts?: { compact?: boolean; signed?: boolean };
}) {
  const { masked } = useFigureMask();
  const formatted = formatMoney(amount, currency, opts);
  return <>{masked ? maskFigure(formatted) : formatted}</>;
}
