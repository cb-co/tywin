"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { monthLabel, monthEnd, normalizeMonth } from "@/lib/budgets/month";
import { periodFor, shiftPeriod, isWholeMonth, type Period, type PayCycle } from "@/lib/period/cycle";
import { cn } from "@/lib/utils";

type Mode = "month" | "native";

/**
 * The month switcher — now also the period switcher. It grows a two-way
 * toggle ("Mes" vs. the profile's own cycle) except when both sides would
 * render the exact same thing, in which case the toggle would be a control
 * that does nothing and is omitted instead.
 *
 * "Both sides identical" is NOT the same predicate as `payCycle === "monthly"`
 * — a `monthly` profile can still be anchored off the 1st (e.g. paid on the
 * 25th, `pay_anchor_day: 25`), whose own period straddles two calendar
 * months and genuinely differs from "Mes". The gate below is
 * `isWholeMonth` applied to what the profile's OWN cycle would show right
 * now — computed fresh from payCycle/payAnchor, not read off whichever side
 * of the toggle happens to be on screen. That distinction matters: if the
 * gate instead read the `period` prop directly, a `semimonthly` user who had
 * just toggled onto "Mes" would find the toggle vanish out from under them
 * (their currently-displayed period being, in that moment, a whole month)
 * with no way back to their quincena. Computing it from the cycle instead
 * means the toggle's presence never depends on which side is active.
 */
export function showsPeriodToggle(period: Period, payCycle: PayCycle, payAnchor: number | null): boolean {
  return !isWholeMonth(periodFor(period.start, payCycle, payAnchor));
}

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

  const cycleLabel =
    payCycle === "weekly"
      ? t("periodWeekly")
      : payCycle === "monthly"
        ? // An anchored monthly profile's own period is a month's length but
          // not calendar-aligned — "Quincena"/"Semana" would both be wrong,
          // and "Mes" is already taken by the other side of this toggle.
          t("periodOwnCycle")
        : t("periodSemimonthly");

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
  // for a `monthly` profile with a null/1 anchor this must be the exact node
  // budget-grid.tsx used to inline, or the "unchanged for monthly" constraint
  // is only true by eye.
  if (!showsPeriodToggle(period, payCycle, payAnchor)) return arrows;

  /* `justify-between` below `sm`, where the parent card stretches this row to
     its full width: the toggle goes to the right edge, under the thumb, instead
     of sitting packed against the month arrows with dead space beside it. From
     `sm` up the row is one flex item among several and packs left as before. */
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
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
