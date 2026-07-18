"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { archiveAccount, deleteAccount } from "@/app/(app)/accounts/actions";
import { AccountFormDialog } from "./account-form-dialog";
import type { AccountWithStatus, CurrencyRow } from "@/lib/accounts/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AccountDetailActions({
  account,
  currencies,
  baseCurrency,
}: {
  account: AccountWithStatus;
  currencies: CurrencyRow[];
  baseCurrency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onArchive() {
    startTransition(async () => {
      const result = await archiveAccount(account.id, !account.is_archived);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(account.is_archived ? "Account restored" : "Account archived");
      router.push("/accounts");
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Account deleted");
      router.push("/accounts");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AccountFormDialog
        mode="edit"
        account={account}
        currencies={currencies}
        baseCurrency={baseCurrency}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <Button variant="ghost" size="sm" onClick={onArchive} disabled={pending}>
        {account.is_archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {account.is_archived ? "Restore" : "Archive"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              This permanently removes the account and its transactions. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
