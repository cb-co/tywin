"use client";

import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MaskedMoney } from "@/components/figure-mask/masked-money";
import { amountDisplay, transactionTitle } from "@/lib/transactions/display";
import { formatMoney } from "@/lib/format";
import { monthLabel } from "@/lib/budgets/month";
import type { TransactionWithRefs } from "@/lib/transactions/queries";
import { cn } from "@/lib/utils";

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** `DD/MM`, the same locale-independent slash date the statement-import
 *  preview prints — this sheet is deliberately styled after that one. */
function slashDate(occurredAt: string) {
  const iso = occurredAt.slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * "What makes up this number" — the transactions behind one spend-ledger
 * row, styled as a dense read-only ledger (date / description / amount),
 * the same compact card the statement-import preview uses rather than the
 * richer per-row Stamp treatment the rest of the app edits from.
 *
 * Fetching is the caller's job (SpendLedger): this component only ever shows
 * what it's handed, including `rows === null` while that fetch is in flight
 * — nothing here fetches on its own or before the sheet opens.
 */
export function CategoryTransactionsSheet({
  open,
  onOpenChange,
  name,
  month,
  amount,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** First-of-month string the drilldown was windowed to, for the summary line. */
  month: string;
  amount: React.ReactNode;
  /** Null while the transactions for `name` are still loading. */
  rows: TransactionWithRefs[] | null;
}) {
  const t = useTranslations("Insights");
  const tTxn = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const locale = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="legend text-sm">{name}</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">{monthLabel(month, locale)}</p>
            <p className="text-xs text-muted-foreground">
              {rows === null ? null : t("categorySheetCount", { count: rows.length })}
            </p>
          </div>

          {rows === null ? (
            <div className="divide-y divide-(--paper-line) border-y border-(--paper-line)" aria-hidden>
              {SKELETON_ROWS.map((i) => (
                <div key={i} className="skeleton h-7 rounded-none border-none" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("categorySheetEmpty")}</p>
          ) : (
            <>
              <ol aria-label={name} className="border-t border-(--paper-line)">
                {rows.map((txn) => {
                  const amt = amountDisplay(txn);
                  const title = transactionTitle(txn, tType("income"), tTxn("transactionFallbackTitle"));
                  return (
                    <li
                      key={txn.id}
                      className="grid grid-cols-[2.6rem_1fr_auto] items-baseline gap-2 border-b border-(--paper-line) px-1 py-1.5 text-xs last:border-b-0"
                    >
                      <span className="figure text-muted-foreground">{slashDate(txn.occurred_at)}</span>
                      <span className="truncate uppercase tracking-wide">{title}</span>
                      <span className={cn("figure font-semibold", amt.income && "text-(--teal)")}>
                        {amt.sign}
                        {amt.income ? <MaskedMoney amount={amt.value} currency={amt.currency} /> : formatMoney(amt.value, amt.currency)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-baseline justify-between border-t border-(--rule) pt-2">
                <span className="legend text-[11px] text-muted-foreground">{t("categorySheetTotal")}</span>
                <span className="figure text-sm font-semibold">{amount}</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
