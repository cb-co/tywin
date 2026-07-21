"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { archiveAccount, deleteAccount } from "@/app/(app)/accounts/actions";
import { AccountFormDialog } from "./account-form-dialog";
import type { AccountWithStatus, CurrencyRow, CardGroupRow, BankRow } from "@/lib/accounts/queries";
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
  cardGroups,
  banks,
  baseCurrency,
}: {
  account: AccountWithStatus;
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
}) {
  const t = useTranslations("AccountDetail");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { playSuccess, playDelete, playError } = useUiSound();

  function onArchive() {
    startTransition(async () => {
      const result = await archiveAccount(account.id, !account.is_archived);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(account.is_archived ? t("accountRestored") : t("accountArchived"));
      playSuccess();
      router.push("/accounts");
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("accountDeleted"));
      playDelete();
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
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
        trigger={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            {tc("edit")}
          </Button>
        }
      />
      <Button variant="ghost" size="sm" onClick={onArchive} disabled={pending}>
        {account.is_archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
        {account.is_archived ? t("restore") : t("archive")}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              {tc("delete")}
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? t("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
