"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("AccountDetail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("transactionDeleted"));
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">{t("recentActivity")}</h2>
        <TransactionDialog
          mode="create"
          defaultAccountId={accountId}
          data={data}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t("addTransaction")}
            </Button>
          }
        />
      </div>
      {transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title={t("noActivityTitle")}
          description={t("noActivityDescription")}
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
