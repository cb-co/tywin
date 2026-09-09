"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { monthLabel, monthEnd, normalizeMonth } from "@/lib/budgets/month";
import { periodFor, shiftPeriod, type Period, type PayCycle } from "@/lib/period/cycle";
import { cn } from "@/lib/utils";

type Mode = "month" | "native";

/**
 * The month switcher — now also the period switcher. For a `monthly`
 * profile this renders exactly what budget-grid.tsx used to inline at
 * :174 (same arrows, same label, same aria) and nothing else, because a
 * `monthly` profile's period IS the calendar month and a toggle between two
 * identical views would just be a control that does nothing.
 *
 * For a `semimonthly` or `weekly` profile it grows a two-way toggle: "Mes"
 * still means the plain calendar month (not the profile's own cycle — the
 * two only coincide for `monthly`), and the other side is the profile's own
 * quincena or week. Whichever side is active decides what the arrows step
 * by, so the label and the arrows never disagree about what "next" means.
 */
export function PeriodPicker({
  period,
  mode,
  payCycle,
  payAnchor,
  locale,
  pending,
  onNavigate,
}: {
  period: Period;
  mode: Mode;
  payCycle: PayCycle;
  payAnchor: number | null;
  locale: string;
  pending: boolean;
  onNavigate: (period: Period, mode: Mode) => void;
}) {
  const t = useTranslations("Budgets");

  function shift(delta: number) {
    // "Mes" always steps by the plain calendar month — cycle "monthly" with
    // anchor 1 is exactly that, regardless of the profile's own cycle, which
    // is the same reason the toggle hard-codes it below rather than reusing
    // payCycle/payAnchor for this side.
    const next =
      mode === "month" ? shiftPeriod(period, "monthly", 1, delta) : shiftPeriod(period, payCycle, payAnchor, delta);
    onNavigate(next, mode);
  }

  function toggle(next: Mode) {
    if (next === mode) return;
    // Re-anchored on the period currently on screen, not on today — flipping
    // the toggle while looking at last quincena should land on last month,
    // not jump back to the present.
    const target: Period =
      next === "month"
        ? { start: normalizeMonth(period.start), end: monthEnd(normalizeMonth(period.start)) }
        : periodFor(period.start, payCycle, payAnchor);
    onNavigate(target, next);
  }

  const label =
    mode === "month"
      ? monthLabel(normalizeMonth(period.start), locale)
      : t("periodRange", {
          start: formatDate(period.start, locale, { day: "numeric", month: "short" }),
          end: formatDate(period.end, locale, { day: "numeric", month: "short" }),
        });

  const cycleLabel = payCycle === "weekly" ? t("periodWeekly") : t("periodSemimonthly");

  const arrows = (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={mode === "month" ? t("prevMonth") : t("prevPeriod")}
        onClick={() => shift(-1)}
        disabled={pending}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium text-foreground">{label}</span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={mode === "month" ? t("nextMonth") : t("nextPeriod")}
        onClick={() => shift(1)}
        disabled={pending}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );

  // No wrapping element and no toggle here at all, not just a hidden one —
  // for a `monthly` profile this must be the exact node budget-grid.tsx used
  // to inline, or the "unchanged for monthly" constraint is only true by eye.
  if (payCycle === "monthly") return arrows;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {arrows}
      <div className="flex rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => toggle("month")}
          aria-pressed={mode === "month"}
          disabled={pending}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {t("periodMonth")}
        </button>
        <button
          type="button"
          onClick={() => toggle("native")}
          aria-pressed={mode === "native"}
          disabled={pending}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === "native" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {cycleLabel}
        </button>
      </div>
    </div>
  );
}
