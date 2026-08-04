"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CopyPlus,
  Pencil,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { setBudget, deleteCategory, copyPreviousMonth } from "@/app/(app)/budgets/actions";
import { addMonths, monthLabel } from "@/lib/budgets/month";
import { formatMoney, formatPercent } from "@/lib/format";
import type { BudgetOverview, BudgetRow } from "@/lib/budgets/queries";
import { CategoryDialog } from "./category-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ColorTile } from "@/components/ui/color-tile";
import { MoneyDisplay } from "@/components/ui/money-display";
import { StatPill } from "@/components/ui/stat-pill";
import { useMaskedFormatMoney } from "@/components/figure-mask/figure-mask-provider";
import { EmptyState } from "@/components/empty-state";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

// Three states, escalating in loudness. `within` used to be `--primary`, which
// drew a comfortable budget as the heaviest black bar on the screen and made
// every row look urgent; the calm state should be the quietest mark here, and
// only `over` should shout.
const STATUS_COLOR: Record<BudgetRow["status"], string> = {
  within: "var(--brand)",
  approaching: "var(--warning)",
  over: "var(--destructive)",
};

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

function barPct(used: number, budget: number) {
  if (budget > 0) return Math.min(Math.max((used / budget) * 100, 0), 100);
  return used > 0 ? 100 : 0;
}

export function BudgetGrid({ month, overview }: { month: string; overview: BudgetOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [navPending, startNavTransition] = useTransition();
  const [view, setView] = useState<"grid" | "table">("grid");
  // Tracks which row's delete is in flight, separate from the shared `pending`
  // above — that one also covers the budget-amount save and "Copy last month",
  // so keying delete off it would disable every row's Trash2 button the
  // moment any one of them starts deleting.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useTranslations("Budgets");
  const locale = useLocale();
  const maskedFormatMoney = useMaskedFormatMoney();
  const { playSuccess, playDelete, playError } = useUiSound();
  const { rows, totalBudget, totalUsed, baseCurrency } = overview;
  const remaining = totalBudget - totalUsed;

  function go(delta: number) {
    startNavTransition(() => {
      // Same reason as the Insights picker: changing month is a re-scope, not a
      // new page, and jumping to the top loses the row being looked at.
      router.push(`/budgets?month=${addMonths(month, delta)}`, { scroll: false });
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
    <div className="space-y-6">
      {/* Month switcher + totals */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("prevMonth")}
            onClick={() => go(-1)}
            disabled={navPending}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-lg font-medium">
            {monthLabel(month, locale)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("nextMonth")}
            onClick={() => go(1)}
            disabled={navPending}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {navPending ? (
          <div className="flex gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3 w-14 rounded" />
                <div className="skeleton h-4 w-20 rounded" />
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopy}
          disabled={pending || navPending}
          isLoading={pending}
        >
          <CopyPlus className="size-4" />
          {t("copyLastMonth")}
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label={t("gridViewAria")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label={t("tableViewAria")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <TableIcon className="size-4" />
            </button>
          </div>
          <CategoryDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                {t("addCategory")}
              </Button>
            }
          />
        </div>
      </div>

      {navPending ? (
        view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-36 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        )
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PieChart className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.category_id} className="gap-0 p-5">
              <div className="flex items-center gap-3">
                <ColorTile color={row.color} emoji={row.emoji} name={row.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("amountOfBudget", {
                      used: maskedFormatMoney(row.used, baseCurrency),
                      budget: maskedFormatMoney(row.budget, baseCurrency),
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <MoneyDisplay amount={row.used} currency={baseCurrency} size="stat" />
                <StatPill tone={row.status === "over" ? "destructive" : "neutral"}>
                  {formatPercent(barPct(row.used, row.budget))}
                </StatPill>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barPct(row.used, row.budget)}%`,
                    backgroundColor: STATUS_COLOR[row.status],
                  }}
                />
              </div>
              <div className="mt-4 flex items-center gap-1">
                <Input
                  key={`${row.category_id}-${row.budget}`}
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={row.budget || ""}
                  placeholder={t("amountPlaceholder")}
                  aria-label={t("budgetForAria", { name: row.name })}
                  className="h-8 flex-1 tabular-nums"
                  onBlur={(e) => onSaveBudget(row.category_id, e.target.value, row.budget)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
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
                  disabled={deletingId === row.category_id}
                  isLoading={deletingId === row.category_id}
                >
                  {deletingId === row.category_id ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="divide-y">
          {rows.map((row) => (
            <div
              key={row.category_id}
              className="group -mx-3 flex items-center gap-4 rounded-lg px-3 py-4"
            >
              <ColorTile color={row.color} emoji={row.emoji} name={row.name} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <StatPill tone={row.status === "over" ? "destructive" : "neutral"}>
                    {formatPercent(barPct(row.used, row.budget))}
                  </StatPill>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <MoneyDisplay amount={row.used} currency={baseCurrency} size="stat" />
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t("amountOfBudget", {
                      used: maskedFormatMoney(row.used, baseCurrency),
                      budget: maskedFormatMoney(row.budget, baseCurrency),
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
                  key={`${row.category_id}-${row.budget}`}
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
                    disabled={deletingId === row.category_id}
                    isLoading={deletingId === row.category_id}
                  >
                    {deletingId === row.category_id ? null : <Trash2 className="size-4" />}
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
