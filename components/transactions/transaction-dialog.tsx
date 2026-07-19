"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";
import type { QuickAddData, TransactionWithRefs } from "@/lib/transactions/queries";

export function TransactionDialog({
  mode = "create",
  transaction,
  defaultAccountId,
  data,
  trigger,
}: {
  mode?: "create" | "edit";
  transaction?: TransactionWithRefs;
  defaultAccountId?: string;
  data: QuickAddData;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
        </DialogHeader>
        {/* Mount the form only while open so its defaults reflect the latest data. */}
        {open ? (
          <TransactionForm
            data={data}
            mode={mode}
            transaction={transaction}
            defaultAccountId={defaultAccountId}
            onSuccess={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
