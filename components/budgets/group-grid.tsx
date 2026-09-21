"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { Pencil } from "lucide-react";
import { setGroupBudget, deleteBudgetGroup } from "@/app/(app)/budgets/group-actions";
import { monthLabel, normalizeMonth } from "@/lib/budgets/month";
import { budgetLabelParts } from "@/lib/budgets/label";
import { isWholeMonth, type PayCycle } from "@/lib/period/cycle";
import { formatDate } from "@/lib/format";
import type { BudgetGroupOverview } from "@/lib/budgets/queries";
import { GroupDialog } from "./group-dialog";
import { BudgetLine } from "./budget-line";
import { SectionLegend } from "@/components/papel/section-legend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { cn } from "@/lib/utils";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

/**
 * The planning band, above the category band it summarises.
 *
 * Two things about it are load-bearing.
 *
 * The first is that it returns null on no rows — not an EmptyState, not a
 * heading over a hint. A user who has never made a group must see the Budgets
 * page exactly as it looked before this feature existed, and a band that
 * introduces itself is the one thing that would break that. The only affordance
 * such a user ever meets is the "Add group" button in the band below.
 *
 * The second is that it draws money exactly the way BudgetGrid does — the same
 * `BudgetLine`. These are the same quantity sliced a second way, and a second
 * visual language for it would suggest they are not.
 *
 * There is no totals row here on purpose. The band below already carries one,
 * and the two would rarely match: a category budget and a group budget are two
 * answers to two different questions, so a person can plan 40,000 across groups
 * and 35,000 across categories without either being wrong. Printing both totals
 * side by side would turn that into an error message the app cannot explain.
 *
 * No period picker either — the one in the band below re-scopes the whole page
 * URL, and a second control onto the same state would be two ways to say one
 * thing. The period is named here in plain text so this band visibly answers to
 * the same clock, and each row prorates onto it and prints the same "monthly ·
 * this period" line the category rows do.
 */
export function GroupGrid({
  overview,
  payCycle,
}: {
  overview: BudgetGroupOverview;
  payCycle: PayCycle;
}) {
  const router = useRouter();
  // The transition's own pending flag goes unread: the amount input reflects
  // its save by being re-keyed on the value that comes back, exactly as
  // BudgetGrid's does, and delete has its own flag below.
  const [, startTransition] = useTransition();
  // Which row's delete is in flight. Its own state rather than the transition's
  // pending flag for the same reason BudgetGrid keeps one: that flag also
  // covers the budget-amount save, so keying delete off it would spin every
  // row's button the moment any one of them started.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations("BudgetGroups");
  const tb = useTranslations("Budgets");
  const locale = useLocale();
  const maskedFormatMoney = useMaskedFormatMoney();
  const { playDelete, playError } = useUiSound();
  const { rows, baseCurrency, period } = overview;
  // budget_group_budgets stores months, like category_budgets — the amount
  // input writes the month containing the period's start, as BudgetGrid's does.
  const month = normalizeMonth(period.start);

  function onSaveBudget(groupId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === current) return;
    startTransition(async () => {
      const result = await setGroupBudget({ budget_group_id: groupId, month, amount });
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        router.refresh();
      }
    });
  }

  function onDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteBudgetGroup(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("groupDeleted"));
        playDelete();
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  // Named the way PeriodPicker names it, so the two bands visibly read off one
  // clock: the month's name for a whole month, the date range otherwise.
  const periodLabel = isWholeMonth(period)
    ? monthLabel(month, locale)
    : tb("periodRange", {
        start: formatDate(period.start, locale, { day: "numeric", month: "short" }),
        end: formatDate(period.end, locale, { day: "numeric", month: "short" }),
      });

  // The band does not exist until the first group does. Below every hook, so
  // the early return cannot change the hook order between renders.
  if (rows.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionLegend aside={<span>{periodLabel}</span>}>{t("sectionTitle")}</SectionLegend>
      <Card className="gap-0 overflow-hidden p-0">
        {rows.map((row) => {
          const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
          return (
            <BudgetLine
              key={row.budget_group_id}
              name={row.name}
              color={row.color}
              emoji={row.emoji}
              used={row.used}
              budget={row.budget}
              status={row.status}
              currency={baseCurrency}
              subtitle={t("amountOfBudget", {
                used: maskedFormatMoney(row.used, baseCurrency),
                budget: maskedFormatMoney(row.budget, baseCurrency),
              })}
              prorated={
                parts.prorated !== null
                  ? tb(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                      monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                      prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                    })
                  : null
              }
              inputKey={`${row.budget_group_id}-${row.budget_monthly}`}
              defaultAmount={row.budget_monthly}
              placeholder={t("amountPlaceholder")}
              budgetAria={t("budgetForAria", { name: row.name })}
              onSave={(raw) => onSaveBudget(row.budget_group_id, raw, row.budget_monthly)}
              editControl={
                <GroupDialog
                  mode="edit"
                  group={row}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("editAria", { name: row.name })}
                      className={cn("text-muted-foreground", TOUCH_TARGET)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
              }
              deleteAria={t("deleteAria", { name: row.name })}
              onDelete={() => onDelete(row.budget_group_id)}
              deleting={deletingId === row.budget_group_id}
            />
          );
        })}
      </Card>
    </section>
  );
}
