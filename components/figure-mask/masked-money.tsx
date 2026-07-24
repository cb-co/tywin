"use client";

import { formatMoney } from "@/lib/format";
import { useFigureMask } from "./figure-mask-provider";

const MASK = "****";

/**
 * Renders a money figure, replacing it with `****` while figure masking is
 * on. Debt figures (credit card owed, loan outstanding) stay legible even
 * when masked, so callers rendering those pass `debt`.
 */
export function MaskedMoney({
  amount,
  currency,
  opts,
  debt = false,
}: {
  amount: number;
  currency: string;
  opts?: { compact?: boolean; signed?: boolean };
  debt?: boolean;
}) {
  const { masked } = useFigureMask();
  if (masked && !debt) return <>{MASK}</>;
  return <>{formatMoney(amount, currency, opts)}</>;
}
