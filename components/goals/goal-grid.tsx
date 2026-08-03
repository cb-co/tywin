"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { Plus, Trash2, Pencil, PiggyBank } from "lucide-react";
import { deleteGoal } from "@/app/(app)/budgets/goal-actions";
import { colorCardStyle } from "@/lib/palette";
import { formatMoney } from "@/lib/format";
import type { GoalCardRow, GoalsOverview } from "@/lib/goals/queries";
import type { Pace } from "@/lib/goals/pace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const t = useTranslations("Goals");
  const { playDelete, playError } = useUiSound();
  const { goals, totalSaved, totalTarget, totalBacked, totalShortfall, baseCurrency, accounts } =
    overview;

  function onDelete(id: string) {
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
            <Card key={goal.id} className="gap-0 p-5" style={colorCardStyle(goal.color)}>
              <div className="flex items-center gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: goal.color
                      ? `color-mix(in oklab, ${goal.color} 16%, transparent)`
                      : "var(--accent)",
                    color: goal.color ?? "var(--accent-foreground)",
                  }}
                >
                  {goal.emoji ? <span className="text-sm">{goal.emoji}</span> : goal.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("amountOfTarget", {
                      saved: formatMoney(goal.saved, baseCurrency),
                      target: formatMoney(goal.target_amount, baseCurrency),
                    })}
                  </p>
                </div>
              </div>

              <GoalBar goal={goal} />

              <p className="mt-2 min-h-8 text-xs text-muted-foreground">
                <PaceLine pace={goal.pace} currency={baseCurrency} />
              </p>

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
                  onClick={() => onDelete(goal.id)}
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
    </section>
  );
}

/**
 * Two segments: what is actually there in the goal's own colour, then what has
 * been borrowed back in a warning tint. A goal spent into looks visibly
 * hollowed out rather than merely reporting a smaller number.
 */
function GoalBar({ goal }: { goal: GoalCardRow }) {
  const target = goal.target_amount;
  // Clamped at the bottom because net withdrawals can drive `saved` negative.
  const filled = target > 0 ? Math.min(Math.max(goal.saved / target, 0), 1) * 100 : 0;
  const backedShare = goal.saved > 0 ? Math.min(goal.backed / goal.saved, 1) : 0;

  return (
    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * backedShare}%`,
          backgroundColor: goal.color ?? "var(--brand)",
        }}
      />
      <div
        className="h-full transition-all"
        style={{
          width: `${filled * (1 - backedShare)}%`,
          backgroundColor: "color-mix(in oklab, var(--warning) 45%, var(--muted))",
        }}
      />
    </div>
  );
}

function PaceLine({ pace, currency }: { pace: Pace; currency: string }) {
  const t = useTranslations("Goals");
  switch (pace.kind) {
    case "shortfall":
      return (
        <span className="text-destructive">
          {t("paceShortfall", { amount: formatMoney(pace.amount, currency) })}
        </span>
      );
    case "complete":
      return <span className="text-success">{t("paceComplete")}</span>;
    case "overdue":
      return <span className="text-destructive">{t("paceOverdue")}</span>;
    case "no-pace":
      return <>{t("paceNone")}</>;
    case "on-track":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-success">{t("paceOnTrack")}</span>
        </>
      );
    case "behind":
      return (
        <>
          {t("paceNeedVsActual", {
            required: formatMoney(pace.required, currency),
            actual: formatMoney(pace.actual, currency),
          })}{" "}
          <span className="text-warning">{t("paceBehind")}</span>
        </>
      );
    case "projection":
      return (
        <>
          {t("paceProjection", {
            actual: formatMoney(pace.actual, currency),
            months: pace.months,
          })}
        </>
      );
  }
}
