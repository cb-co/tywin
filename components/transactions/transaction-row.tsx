import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Pencil, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ColorTile } from "@/components/ui/color-tile";
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

  const title =
    txn.description ||
    category?.name ||
    (txn.type === "income" ? tType("income") : account?.name) ||
    t("transactionFallbackTitle");

  const subtitle =
    txn.type === "payment" && toAccount
      ? `${account?.name ?? "—"} → ${toAccount.name}`
      : (account?.name ?? "—");

  // A statement-sourced expense row can carry a negative amount (refund,
  // rebate, reversal — spec §2.3). "-total_amount" would then be positive
  // and render as an ordinary red charge, backwards from what happened.
  const isStatementCredit =
    txn.type === "expense" && !!txn.statement_line_id && Number(txn.total_amount) < 0;

  const isDestinationLeg =
    txn.type === "payment" && viewAccountId != null && txn.to_account_id === viewAccountId;

  const amount = isStatementCredit
    ? { value: -txn.total_amount, signed: true, tone: "text-success" }
    : txn.type === "income"
      ? { value: txn.amount, signed: true, tone: "text-success" }
      : txn.type === "expense"
        ? { value: -txn.total_amount, signed: false, tone: "text-destructive" }
        : {
            value: isDestinationLeg ? (txn.to_amount ?? txn.amount) : txn.total_amount,
            signed: false,
            tone: "text-foreground",
          };

  const currency = isDestinationLeg ? (toAccount?.currency ?? txn.currency) : txn.currency;

  const hasExtras = txn.tax_amount > 0 || txn.fee_amount > 0;

  return (
    <div className="group flex items-center gap-3 py-3">
      <ColorTile
        color={category?.color ?? null}
        emoji={category?.emoji}
        name={category?.name}
        icon={Icon}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
          {txn.exclude_from_budget ? (
            <Badge className="ml-2 bg-muted text-muted-foreground">
              {t("excludeFromBudgetBadge")}
            </Badge>
          ) : null}
          {txn.statement_line_id ? (
            <Badge className="ml-2 bg-muted uppercase tracking-wide text-muted-foreground">
              {t("statementBadge")}
            </Badge>
          ) : null}
          {isStatementCredit ? (
            <Badge className="ml-2 bg-success/10 uppercase tracking-wide text-success">
              {t("refundBadge")}
            </Badge>
          ) : null}
          {txn.fx_fallback ? (
            <Badge
              className="ml-2 bg-warning/10 uppercase tracking-wide text-warning"
              title={t("fxFallbackWarning")}
            >
              <TriangleAlert className="size-3" />
              {t("fxFallbackBadge")}
            </Badge>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="text-right">
        <p className={cn("figure text-sm tabular-nums", amount.tone)}>
          {txn.type === "income" ? (
            <MaskedMoney amount={amount.value} currency={currency} opts={{ signed: amount.signed }} />
          ) : (
            formatMoney(amount.value, currency, { signed: amount.signed })
          )}
        </p>
        {hasExtras ? (
          <p className="text-[11px] text-muted-foreground">
            {t("inclFees", { amount: formatMoney(txn.tax_amount + txn.fee_amount, txn.currency) })}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
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
      </div>
    </div>
  );
}
