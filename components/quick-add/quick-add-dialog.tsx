"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "./quick-add-provider";
import { TransactionForm } from "@/components/transactions/transaction-form";
import type { QuickAddData } from "@/lib/transactions/queries";

export function QuickAddDialog({ data }: { data: QuickAddData }) {
  const { open, setOpen } = useQuickAdd();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Quick add</DialogTitle>
        </DialogHeader>
        <TransactionForm data={data} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
