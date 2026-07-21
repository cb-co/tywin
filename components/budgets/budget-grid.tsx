"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { ChevronLeft, ChevronRight, Plus, Trash2, CopyPlus, Pencil } from "lucide-react";
import { setBudget, deleteCategory, copyPreviousMonth } from "@/app/(app)/budgets/actions";
import { addMonths, monthLabel } from "@/lib/budgets/month";
import { formatMoney } from "@/lib/format";
import type { BudgetOverview, BudgetRow } from "@/lib/budgets/queries";
import { CategoryDialog } from "./category-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<BudgetRow["status"], string> = {
  within: "var(--primary)",
  approaching: "var(--warning)",
  over: "var(--destructive)",
};

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

function barPct(used: number, budget: number) {
  if (budget > 0) return Math.min((used / budget) * 100, 100);
  return used > 0 ? 100 : 0;
}

export function BudgetGrid({ month, overview }: { month: string; overview: BudgetOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Budgets");
  const { playSuccess, playDelete, playError } = useUiSound();
  const { rows, totalBudget, totalUsed, baseCurrency } = overview;
  const remaining = totalBudget - totalUsed;

  function go(delta: number) {
    router.push(`/budgets?month=${addMonths(month, delta)}`);
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
    <div className="space-y-6">
      {/* Month switcher + totals */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={t("prevMonth")} onClick={() => go(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-lg font-medium">
            {monthLabel(month)}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} onClick={() => go(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("budgetLabel")}</p>
            <p className="figure tabular-nums">{formatMoney(totalBudget, baseCurrency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("usedLabel")}</p>
            <p className="figure tabular-nums">{formatMoney(totalUsed, baseCurrency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("remainingLabel")}</p>
            <p className={`figure tabular-nums ${remaining < 0 ? "text-destructive" : ""}`}>
              {formatMoney(remaining, baseCurrency)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onCopy} disabled={pending}>
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
        <CategoryDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t("addCategory")}
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PieChart className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.category_id} className="group flex items-center gap-4 py-4">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: row.color
                    ? `color-mix(in oklab, ${row.color} 16%, transparent)`
                    : "var(--accent)",
                  color: row.color ?? "var(--accent-foreground)",
                }}
              >
                {row.emoji ? <span className="text-sm">{row.emoji}</span> : row.name[0]}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t("amountOfBudget", {
                      used: formatMoney(row.used, baseCurrency),
                      budget: formatMoney(row.budget, baseCurrency),
                    })}
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${barPct(row.used, row.budget)}%`,
                      backgroundColor: STATUS_COLOR[row.status],
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={row.budget || ""}
                  placeholder={t("amountPlaceholder")}
                  aria-label={t("budgetForAria", { name: row.name })}
                  className="h-8 w-24 text-right tabular-nums"
                  onBlur={(e) => onSaveBudget(row.category_id, e.target.value, row.budget)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <div className="flex items-center">
                  <CategoryDialog
                    mode="edit"
                    category={row}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("deleteAria", { name: row.name })}
                    className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
                    onClick={() => onDelete(row.category_id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
