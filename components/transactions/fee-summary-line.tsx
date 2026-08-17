"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";

/** What the row will actually cost, stated rather than asked.
 *
 *  The full form asks "apply transfer tax?" as a peer field; compact computes
 *  it and says so. The figure is a preview -- the stored one comes from the
 *  insert trigger -- so this must never be the only place a charge appears. */
export function FeeSummaryLine({
  tax,
  fee,
  currency,
  sameBank,
  onEdit,
}: {
  tax: number;
  fee: number;
  currency: string;
  sameBank: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations("TransactionForm");
  const parts = [
    tax > 0 ? t("feeLineTax", { amount: formatMoney(tax, currency) }) : null,
    fee > 0 ? t("feeLineFee", { amount: formatMoney(fee, currency) }) : null,
    fee === 0 && sameBank ? t("feeLineNoFeeSameBank") : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{parts.join(" · ")}</span>
      <button
        type="button"
        onClick={onEdit}
        className="text-primary underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {t("feeLineEdit")}
      </button>
    </p>
  );
}
