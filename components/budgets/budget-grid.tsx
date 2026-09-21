"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { CopyPlus, Pencil } from "lucide-react";
import { setBudget, deleteCategory, copyPreviousMonth } from "@/app/(app)/budgets/actions";
import { normalizeMonth } from "@/lib/budgets/month";
import type { BudgetGroupRow, BudgetOverview } from "@/lib/budgets/queries";
import { budgetLabelParts } from "@/lib/budgets/label";
import type { Period, PayCycle } from "@/lib/period/cycle";
import { CategoryDialog } from "./category-dialog";
import { PeriodPicker } from "./period-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BudgetLine } from "./budget-line";
import { BudgetNote } from "./budget-note";
import { SectionLegend } from "@/components/papel/section-legend";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { EmptyState } from "@/components/empty-state";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export function BudgetGrid({
  overview,
  mode,
  payCycle,
  payAnchor,
  /* The groups a category can roll up to. Empty for a user who has never made
     one — which is the whole zero-group path through this component: the
     category dialog drops its group field, and the only trace of the feature
     left on the page is the one quiet "Add group" button beside "Add
     category". */
  groups = [],
  groupBand,
}: {
  overview: BudgetOverview;
  /** Which side of the picker's toggle is active. Meaningless (and unused)
   *  for a `monthly` profile, whose period is always the calendar month. */
  mode: "month" | "native";
  payCycle: PayCycle;
  payAnchor: number | null;
  groups?: BudgetGroupRow[];
  /** The group band, rendered by the page, so the Note leads the page and the
   *  picker still lives with the categories. */
  groupBand?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [navPending, startNavTransition] = useTransition();
  // Tracks which row's delete is in flight, separate from the shared `pending`
  // above — that one also covers the budget-amount save and "Copy last month",
  // so keying delete off it would disable every row's Trash2 button the
  // moment any one of them starts deleting.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations("Budgets");
  const locale = useLocale();
  const maskedFormatMoney = useMaskedFormatMoney();
  const { playSuccess, playDelete, playError } = useUiSound();
  const { rows, totalBudget, totalUsed, baseCurrency, period } = overview;
  // category_budgets still stores months, not periods — a quincena's own
  // "half budget" isn't a real row anywhere. Both the amount input and
  // "Copy last month" below target the month containing the active period's
  // start, which for a whole month is just that month.
  const month = normalizeMonth(period.start);

  function navigate(next: Period, nextMode: "month" | "native") {
    startNavTransition(() => {
      // Same reason as the Insights picker: changing period is a re-scope, not
      // a new page, and jumping to the top loses the row being looked at.
      const url =
        nextMode === "month"
          ? `/budgets?month=${normalizeMonth(next.start)}`
          : `/budgets?from=${next.start}&to=${next.end}`;
      router.push(url, { scroll: false });
    });
  }

  function onSaveBudget(categoryId: string, raw: string, current: number) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === current) return;
    startTransition(async () => {
      const result = await setBudget({ category_id: categoryId, month, amount });
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
      const result = await deleteCategory(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("categoryDeleted"));
        playDelete();
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  function onCopy() {
    startTransition(async () => {
      const result = await copyPreviousMonth(month);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("budgetsCopied"));
        playSuccess();
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-6">
      {/* The picker and the copy action are a plain toolbar, not a card: the
          Note below is the period's one framed object. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <PeriodPicker
          period={period}
          mode={mode}
          payCycle={payCycle}
          payAnchor={payAnchor}
          locale={locale}
          pending={navPending}
          onNavigate={navigate}
        />
        <Button variant="outline" size="sm" onClick={onCopy} disabled={pending || navPending} isLoading={pending}>
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
      </div>

      {navPending ? (
        <div className="skeleton h-44 rounded-[6px]" />
      ) : rows.length > 0 ? (
        <BudgetNote totalBudget={totalBudget} totalUsed={totalUsed} currency={baseCurrency} periodStart={period.start} />
      ) : null}

      {!navPending && overview.uncategorized > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("uncategorizedLine", {
            amount: maskedFormatMoney(overview.uncategorized, overview.baseCurrency),
          })}{" "}
          {overview.pendingTriageImportId ? (
            <a className="underline" href={`/imports/${overview.pendingTriageImportId}`}>
              {t("uncategorizedAction")}
            </a>
          ) : null}
        </p>
      ) : null}

      {groupBand}

      <div className="space-y-4">
        <SectionLegend>{t("sectionTitle")}</SectionLegend>
        {navPending ? (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<PieChart className="size-6" />} title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <Card className="gap-0 overflow-hidden p-0">
            {rows.map((row) => {
              // null `prorated` means "one figure" — a whole calendar month, or
              // nothing budgeted at all. See budgetLabelParts's own comment.
              const parts = budgetLabelParts(period, row.budget_monthly, row.budget);
              return (
                <BudgetLine
                  key={row.category_id}
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
                      ? t(payCycle === "weekly" ? "budgetProratedWeekly" : "budgetProrated", {
                          monthly: maskedFormatMoney(parts.monthly, baseCurrency),
                          prorated: maskedFormatMoney(parts.prorated, baseCurrency),
                        })
                      : null
                  }
                  inputKey={`${row.category_id}-${row.budget_monthly}`}
                  defaultAmount={row.budget_monthly}
                  placeholder={t("amountPlaceholder")}
                  budgetAria={t("budgetForAria", { name: row.name })}
                  onSave={(raw) => onSaveBudget(row.category_id, raw, row.budget_monthly)}
                  editControl={
                    <CategoryDialog
                      mode="edit"
                      category={row}
                      groups={groups}
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
                  onDelete={() => onDelete(row.category_id)}
                  deleting={deletingId === row.category_id}
                />
              );
            })}
          </Card>
        )}
      </div>
    </section>
  );
}
