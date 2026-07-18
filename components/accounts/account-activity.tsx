"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ArrowLeftRight } from "lucide-react";
import { deleteTransaction } from "@/app/(app)/transactions/actions";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import type { TransactionWithRefs, QuickAddData } from "@/lib/transactions/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export function AccountActivity({
  accountId,
  transactions,
  data,
}: {
  accountId: string;
  transactions: TransactionWithRefs[];
  data: QuickAddData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Transaction deleted");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-medium text-foreground">Recent activity</h2>
        <TransactionDialog
          mode="create"
          defaultAccountId={accountId}
          data={data}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Add transaction
            </Button>
          }
        />
      </div>
      {transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title="No activity yet"
          description="Log an expense, income, or payment for this account to see it here."
        />
      ) : (
        <Card className="divide-y px-5 py-0">
          {transactions.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} data={data} onDelete={onDelete} pending={pending} />
          ))}
        </Card>
      )}
    </div>
  );
}
