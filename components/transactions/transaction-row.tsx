import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Pencil, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { amountDisplay, isStatementCredit, transactionTitle } from "@/lib/transactions/display";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "@/components/ui/button";
import { LedgerRow } from "@/components/papel/ledger-row";
import { Stamp } from "@/components/papel/stamp";
import { Mark } from "./mark";
import { MaskedMoney } from "@/components/figure-mask/masked-money";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  payment: ArrowLeftRight,
} as const;

/* Edit and delete are always visible, at every width. They used to be
 * opacity-0 until row hover, which left them unreachable on touch (no hover)
 * and invisible to keyboard focus, while still occupying layout and staying
 * tappable — a stray tap beside the amount could land on delete. */

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export function TransactionRow({
  txn,
  data,
  onDelete,
  pending,
  viewAccountId,
}: {
  txn: TransactionWithRefs;
  data: QuickAddData;
  onDelete: (id: string) => void;
  pending: boolean;
  /** Account whose page this row renders on. A payment lands here as its
   *  destination leg, so the figure switches to to_amount/to_account.currency
   *  instead of the source leg — otherwise a cross-currency payment shows the
   *  wrong currency's number on the receiving account's page. */
  viewAccountId?: string;
}) {
  const t = useTranslations("Transactions");
  const tType = useTranslations("TransactionTypes");
  const Icon = TYPE_ICON[txn.type];
  const category = txn.category;
  const account = txn.account;
  const toAccount = txn.to_account;

  const title = transactionTitle(txn, tType("income"), t("transactionFallbackTitle"));

  const subtitle =
    txn.type === "payment" && toAccount
      ? `${account?.name ?? "—"} → ${toAccount.name}`
      : (account?.name ?? "—");

  const statementCredit = isStatementCredit(txn);

  const amt = amountDisplay(txn, viewAccountId);
  const hasExtras = txn.tax_amount > 0 || txn.fee_amount > 0;

  const figure = (
    <span className={cn("text-sm font-semibold", amt.income ? "text-(--teal)" : "text-foreground")}>
      {amt.sign}
      {amt.income ? (
        <MaskedMoney amount={amt.value} currency={amt.currency} />
      ) : (
        formatMoney(amt.value, amt.currency)
      )}
    </span>
  );

  return (
    <LedgerRow
      className="px-0 py-2"
      lead={
        <Stamp color={category?.color ?? null} emoji={category?.emoji} name={category?.name} icon={Icon} size="sm" />
      }
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{title}</span>
          {txn.exclude_from_budget ? <Mark>{t("excludeFromBudgetBadge")}</Mark> : null}
          {txn.statement_line_id ? <Mark>{t("statementBadge")}</Mark> : null}
          {statementCredit ? (
            <Mark>{txn.credit_kind === "cashback" ? t("cashbackBadge") : t("refundBadge")}</Mark>
          ) : null}
          {txn.fx_fallback ? (
            <Mark title={t("fxFallbackWarning")}>
              <TriangleAlert aria-hidden className="size-2.5" />
              {t("fxFallbackBadge")}
            </Mark>
          ) : null}
        </span>
      }
      subtitle={
        hasExtras
          ? `${subtitle} · ${t("inclFees", { amount: formatMoney(txn.tax_amount + txn.fee_amount, txn.currency) })}`
          : subtitle
      }
      amount={figure}
      trailing={
        <>
          <TransactionDialog
            mode="edit"
            transaction={txn}
            data={data}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("editAria")}
                className={cn("text-muted-foreground", TOUCH_TARGET)}
              >
                <Pencil className="size-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("deleteAria")}
            className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
            onClick={() => onDelete(txn.id)}
            disabled={pending}
            isLoading={pending}
          >
            {pending ? null : <Trash2 className="size-4" />}
          </Button>
        </>
      }
    />
  );
}
