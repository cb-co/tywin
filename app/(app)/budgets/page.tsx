import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BudgetGrid } from "@/components/budgets/budget-grid";
import { GoalGrid } from "@/components/goals/goal-grid";
import { Separator } from "@/components/ui/separator";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { getGoalsOverview } from "@/lib/goals/queries";
import { normalizeMonth, monthEnd } from "@/lib/budgets/month";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod, payCycleOf, payAnchorOf } from "@/lib/period/profile";
import { localDate, isWholeMonth, type Period } from "@/lib/period/cycle";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const { month: monthParam, from, to } = await searchParams;

  // Read once, up front — both the default period (a monthly profile's
  // period IS the calendar month, so it looks unchanged) and the picker's
  // labels depend on the cycle, and getBudgetOverview below needs the
  // resolved period before it can run.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("pay_cycle,pay_anchor_day")
    .maybeSingle();
  const payCycle = payCycleOf(profile);
  const payAnchor = payAnchorOf(profile);

  // Resolution order: explicit from/to (the picker's own "Quincena" /
  // "Semana" / "Mi período" side) → month, normalised to that calendar
  // month (the picker's "Mes" side, and every pre-existing bookmark or
  // link) → the profile's own current period. Keeping `month` alive after
  // `from`/`to` shipped is what stops every old /budgets?month=... link
  // from breaking.
  const hasRange = !!from && !!to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to;
  const period: Period = hasRange
    ? { start: from!, end: to! }
    : monthParam
      ? { start: normalizeMonth(monthParam), end: monthEnd(normalizeMonth(monthParam)) }
      : currentPeriod(profile, localDate());
  // Which side of the toggle is active. NOT `payCycle === "monthly"`: an
  // anchored monthly profile's own period (Task 8's Settings UI lets someone
  // choose e.g. pay_anchor_day: 25) is not the calendar month, so landing
  // with no params should show THAT — same as a quincenal profile landing on
  // its own quincena — with `isWholeMonth` deciding it, exactly as
  // PeriodPicker's own toggle-visibility gate does.
  const mode: "month" | "native" = hasRange
    ? "native"
    : monthParam
      ? "month"
      : isWholeMonth(period)
        ? "month"
        : "native";

  const [overview, goals] = await Promise.all([
    getBudgetOverview(period),
    getGoalsOverview(),
  ]);
  const t = await getTranslations("Budgets");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {/* Two bands, because they answer to different clocks. Budgets are scoped
          to a period and goals are cumulative, so an unlabelled picker at
          the top of the page would appear to scope both. Inside a labelled band
          it visibly belongs to budgets alone — the same fix /insights uses by
          putting its picker in one section's heading.

          Each band renders its own heading, the way GoalGrid always has: the
          budgets heading doubles as an overflow slot for the "add category"
          button on narrow screens, and that placement only makes sense next to
          the toolbar it moves out of. */}
      <BudgetGrid
        overview={overview}
        mode={mode}
        payCycle={payCycle}
        payAnchor={payAnchor}
      />

      <Separator />

      <GoalGrid overview={goals} />
    </div>
  );
}
