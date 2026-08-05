"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { Plus, Trash2, Pencil, PiggyBank } from "lucide-react";
import { deleteGoal } from "@/app/(app)/budgets/goal-actions";
import { formatMoney, formatPercent } from "@/lib/format";
import type { GoalCardRow, GoalsOverview } from "@/lib/goals/queries";
import { GoalBar, PaceSummary, goalProgressPct } from "./goal-progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";
import { MoneyDisplay } from "@/components/ui/money-display";
import { StatPill } from "@/components/ui/stat-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { GoalDialog } from "./goal-dialog";
import { ContributeDialog } from "./contribute-dialog";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export function GoalGrid({ overview }: { overview: GoalsOverview }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Tracks which goal's delete is in flight, not a page-level boolean — a
  // shared `pending` would disable every card's Trash2 button the moment any
  // one of them starts deleting.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // The goal pending confirmation, not just its id — the dialog needs the
  // name to state what is being lost, and holding the row avoids a lookup
  // back into `goals` while it is closing.
  const [confirmGoal, setConfirmGoal] = useState<GoalCardRow | null>(null);
  const t = useTranslations("Goals");
  const tc = useTranslations("Common");
  const { playDelete, playError } = useUiSound();
  const { goals, totalSaved, totalTarget, totalBacked, totalShortfall, baseCurrency, accounts } =
    overview;

  function onDelete(id: string) {
    setConfirmGoal(null);
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteGoal(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("goalDeleted"));
        playDelete();
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("sectionTitle")}
        </h2>
        <GoalDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t("addGoal")}
            </Button>
          }
        />
      </div>

      {goals.length > 0 && (
        /* The aggregate honesty check. The clamp makes per-account
           over-commitment impossible, so the only ways the totals drift are
           goals hollowed out by spending and an overdrawn account — and this
           line covers both. Targets exceeding assets is deliberately not
           flagged: that is the ordinary condition of having goals. */
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("totals", {
            saved: formatMoney(totalSaved, baseCurrency),
            target: formatMoney(totalTarget, baseCurrency),
            backed: formatMoney(totalBacked, baseCurrency),
          })}
          {totalShortfall > 0 && (
            <span className="text-destructive">
              {" · "}
              {t("totalsBorrowed", { amount: formatMoney(totalShortfall, baseCurrency) })}
            </span>
          )}
        </p>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="gap-0 p-5">
              {/* Only this chip+name block is a Link, not the whole card — the
                  card also holds Contribute/edit/delete buttons below, and
                  nesting those inside an anchor would be an invalid,
                  inaccessible interactive-in-interactive structure. */}
              <Link
                href={`/budgets/goals/${goal.id}`}
                className="-m-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-foreground/[0.03]"
              >
                <ColorTile color={goal.color} emoji={goal.emoji} name={goal.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("amountOfTarget", {
                      saved: formatMoney(goal.saved, baseCurrency),
                      target: formatMoney(goal.target_amount, baseCurrency),
                    })}
                  </p>
                </div>
              </Link>

              {/* The same body a budget card has: the figure, its share, then
                  the bar — figure left, percentage right, one line that never
                  wraps. The share stays neutral in tone, because being 3% of
                  the way to a house is not itself good or bad news.

                  The verdict rides below the bar instead. It is a phrase, not
                  a percentage, so up here it would either overflow the row or
                  wrap it, and down there it sits with the arithmetic that
                  explains it. */}
              <div className="mt-3 flex items-end justify-between gap-2">
                <MoneyDisplay amount={goal.saved} currency={baseCurrency} size="stat" />
                <StatPill className="shrink-0">{formatPercent(goalProgressPct(goal))}</StatPill>
              </div>

              <GoalBar goal={goal} />

              {/* The arithmetic and the verdict share this line — text taking
                  whatever the chip leaves and wrapping inside it, chip pinned
                  right. The min-height is what keeps the action rows level
                  across a row of cards whose pace lines run to one line, two,
                  or none at all. */}
              <PaceSummary
                pace={goal.pace}
                currency={baseCurrency}
                className="mt-2 min-h-8 text-xs"
              />

              <div className="mt-3 flex items-center gap-1">
                <ContributeDialog
                  goal={goal}
                  accounts={accounts}
                  baseCurrency={baseCurrency}
                  trigger={
                    <Button size="sm" variant="outline" className="flex-1">
                      {t("contribute")}
                    </Button>
                  }
                />
                <GoalDialog
                  mode="edit"
                  goal={goal}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("editAria", { name: goal.name })}
                      className={cn("text-muted-foreground", TOUCH_TARGET)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteAria", { name: goal.name })}
                  className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
                  onClick={() => setConfirmGoal(goal)}
                  disabled={deletingId === goal.id}
                  isLoading={deletingId === goal.id}
                >
                  {deletingId === goal.id ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Same confirmation pattern as account deletion (account-detail-actions)
          and statement deletion (statements-panel): a single controlled
          dialog outside the loop, keyed off the row pending confirmation
          rather than one Dialog per card. Deleting the goal takes its whole
          contribution history with it (the detail page has no undo either),
          so — unlike category deletion on /budgets — this cannot be a bare
          click. */}
      <Dialog open={confirmGoal !== null} onOpenChange={(open) => !open && setConfirmGoal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle", { name: confirmGoal?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmDescription", { name: confirmGoal?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmGoal(null)}
              disabled={deletingId === confirmGoal?.id}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmGoal && onDelete(confirmGoal.id)}
              disabled={deletingId === confirmGoal?.id}
              isLoading={deletingId === confirmGoal?.id}
            >
              {deletingId === confirmGoal?.id ? t("deleting") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
