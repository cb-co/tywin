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
import { LedgerRow } from "@/components/papel/ledger-row";
import { SectionLegend } from "@/components/papel/section-legend";
import { ContributeDialog } from "./contribute-dialog";

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
    <section className="space-y-4">
      <SectionLegend
        aside={
          <ContributeDialog
            goal={goal}
            accounts={accounts}
            baseCurrency={baseCurrency}
            trigger={<Button size="sm">{tg("contribute")}</Button>}
          />
        }
      >
        {t("contributionsTitle")}
      </SectionLegend>

      {contributions.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title={t("contributionsEmptyTitle")}
          description={t("contributionsEmptyDescription")}
        />
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          {contributions.map((c) => (
            <LedgerRow
              key={c.id}
              lead={
                <span className="figure w-14 shrink-0 text-xs text-muted-foreground">
                  {formatDate(c.occurred_at.slice(0, 10), locale)}
                </span>
              }
              title={c.account_name}
              amount={<span className="text-sm">{formatMoney(c.amount, c.currency, { signed: true })}</span>}
              trailing={
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
              }
            />
          ))}
        </Card>
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
    </section>
  );
}
