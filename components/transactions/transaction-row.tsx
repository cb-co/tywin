import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { TransactionDialog } from "./transaction-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  expense: ArrowUpRight,
  income: ArrowDownLeft,
  payment: ArrowLeftRight,
} as const;

export function TransactionRow({
  txn,
  data,
  onDelete,
  pending,
}: {
  txn: TransactionWithRefs;
  data: QuickAddData;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const Icon = TYPE_ICON[txn.type];
  const category = txn.category;
  const account = txn.account;
  const toAccount = txn.to_account;

  const title =
    txn.description || category?.name || (txn.type === "income" ? "Income" : account?.name) || "Transaction";

  const subtitle =
    txn.type === "payment" && toAccount
      ? `${account?.name ?? "—"} → ${toAccount.name}`
      : (account?.name ?? "—");

  const amount =
    txn.type === "income"
      ? { value: txn.amount, signed: true, tone: "text-success" }
      : txn.type === "expense"
        ? { value: -txn.total_amount, signed: false, tone: "text-destructive" }
        : { value: txn.total_amount, signed: false, tone: "text-foreground" };

  const hasExtras = txn.tax_amount > 0 || txn.fee_amount > 0;

  return (
    <div className="group flex items-center gap-3 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: category?.color
            ? `color-mix(in oklab, ${category.color} 16%, transparent)`
            : "var(--accent)",
          color: category?.color ?? "var(--accent-foreground)",
        }}
      >
        {category?.emoji ? <span className="text-sm">{category.emoji}</span> : <Icon className="size-[18px]" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
          {txn.budget_only ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              budget only
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="text-right">
        <p className={cn("figure text-sm tabular-nums", amount.tone)}>
          {formatMoney(amount.value, txn.currency, { signed: amount.signed })}
        </p>
        {hasExtras ? (
          <p className="text-[11px] text-muted-foreground">
            incl. {formatMoney(txn.tax_amount + txn.fee_amount, txn.currency)} fees
          </p>
        ) : null}
      </div>

      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
        <TransactionDialog
          mode="edit"
          transaction={txn}
          data={data}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Edit transaction" className="text-muted-foreground">
              <Pencil className="size-4" />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete transaction"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(txn.id)}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
