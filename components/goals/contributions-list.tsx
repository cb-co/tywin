"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Receipt, Trash2 } from "lucide-react";
import { useUiSound } from "@/components/sound/sound-provider";
import { deleteContribution } from "@/app/(app)/budgets/goal-actions";
import type { ContributableAccount, ContributionDetail, GoalCardRow } from "@/lib/goals/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { ContributeDialog } from "./contribute-dialog";
import { cn } from "@/lib/utils";

export function ContributionsList({
  goal,
  contributions,
  accounts,
  baseCurrency,
}: {
  goal: GoalCardRow;
  contributions: ContributionDetail[];
  accounts: ContributableAccount[];
  baseCurrency: string;
}) {
  const t = useTranslations("GoalDetail");
  const tc = useTranslations("Common");
  const tg = useTranslations("Goals");
  const locale = useLocale();
  const router = useRouter();
  // Tracks which contribution's delete is in flight, not a page-level
  // boolean — same reasoning as GoalGrid's `deletingId`: a shared `pending`
  // would disable every row's Trash2 button the moment any one of them
  // starts deleting.
  const [, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // The contribution pending confirmation, not just its id — the dialog
  // needs the amount and date to state what is being lost, and holding the
  // row avoids a lookup back into `contributions` while it is closing.
  const [confirmTarget, setConfirmTarget] = useState<ContributionDetail | null>(null);
  const { playDelete, playError } = useUiSound();

  function onDelete(id: string) {
    setConfirmTarget(null);
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteContribution(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("contributionDeleted"));
        playDelete();
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">{t("contributionsTitle")}</h2>
        <ContributeDialog
          goal={goal}
          accounts={accounts}
          baseCurrency={baseCurrency}
          trigger={<Button size="sm">{tg("contribute")}</Button>}
        />
      </div>

      {contributions.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title={t("contributionsEmptyTitle")}
          description={t("contributionsEmptyDescription")}
          className="mt-4"
        />
      ) : (
        <ul className="mt-4 space-y-2">
          {contributions.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatDate(c.occurred_at.slice(0, 10), locale)}
                </span>
                <span className="truncate text-sm text-foreground">{c.account_name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "figure text-sm tabular-nums",
                    c.amount < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatMoney(c.amount, c.currency, { signed: true })}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteContributionAria", {
                    amount: formatMoney(c.amount, c.currency, { signed: true }),
                    date: formatDate(c.occurred_at.slice(0, 10), locale),
                  })}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmTarget(c)}
                  disabled={deletingId === c.id}
                  isLoading={deletingId === c.id}
                >
                  {deletingId === c.id ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Same confirmation pattern as goal deletion (GoalGrid) and statement
          deletion (StatementsPanel): a single controlled dialog outside the
          list, keyed by the row pending confirmation. A contribution delete
          is unrecoverable, so it cannot be a bare click — and unlike a goal,
          the row itself carries no name to reference, so the confirmation
          states the amount and date instead. */}
      <Dialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteContributionConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {confirmTarget
                ? t("deleteContributionConfirmDescription", {
                    amount: formatMoney(confirmTarget.amount, confirmTarget.currency, {
                      signed: true,
                    }),
                    date: formatDate(confirmTarget.occurred_at.slice(0, 10), locale),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={deletingId === confirmTarget?.id}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmTarget && onDelete(confirmTarget.id)}
              disabled={deletingId === confirmTarget?.id}
              isLoading={deletingId === confirmTarget?.id}
            >
              {deletingId === confirmTarget?.id ? t("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
