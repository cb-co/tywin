import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  Gauge,
  PieChart,
  BarChart3,
  HeartPulse,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { Card } from "@/components/ui/card";
import { getInsights, getCostOfCarry, getLoanInterest } from "@/lib/insights/queries";
import { buildDebtCost } from "@/lib/insights/debt-cost";
import { getNetWorthHistory } from "@/lib/insights/net-worth-history";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import {
  SpendDonut,
  CashflowChart,
  SpendingPace,
  NetWorthChart,
} from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { DebtCostList } from "@/components/insights/debt-cost";

function ChartCard({
  title,
  basis,
  icon: Icon,
  className,
  children,
}: {
  title: string;
  /** How this card counts money — "when charged" or "when paid". Set on the
   *  three cards where it is load-bearing, because this page deliberately shows
   *  both bases at once: the donut and the pace line count a purchase the day
   *  it is made, while Expenses vs budget counts it the day it leaves an
   *  account. Two of those figures can land within a few dollars of each other
   *  in a given month by pure coincidence, which reads as a rounding bug unless
   *  the cards say what they are. Its own prop rather than a longer title so
   *  the qualifier stays visually subordinate to the name. */
  basis?: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `h-full` + a flex body so a card fills its grid cell and its content can
    // decide how to use the leftover height. `gap-0` because the heading
    // already carries its own `mb-4`; with Card's default gap on top of it the
    // titles floated a full 2rem clear of their content.
    <Card className={`h-full gap-0 p-6 ${className ?? ""}`}>
      {/* h3, not h2: the section headings are this page's h2s. */}
      <h3 className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-lg font-medium text-foreground">
        <Icon className="size-4 text-muted-foreground" />
        {title}
        {basis ? (
          <span className="text-xs font-normal text-muted-foreground">· {basis}</span>
        ) : null}
      </h3>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

/**
 * A band of cards under a quiet label. The cards carry the page's weight, so
 * the heading is deliberately the smallest type here — a word marking where one
 * question ends and the next begins, rather than a title competing with the
 * eight it sits above.
 *
 * No rule under the label: the first band opens directly beneath PageHeader's
 * own `border-b`, and the two hairlines a few pixels apart read as a mistake.
 * The 2.5rem between bands separates them on its own.
 *
 * `actions` is how the month picker ends up scoped: it belongs to one band, not
 * to the page, and putting it in that band's heading is what says so.
 */
function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {actions}
      </div>
      <div className="grid gap-6 @[34rem]:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [insights, carry, netWorth, loanInterest] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getNetWorthHistory(),
    getLoanInterest(),
  ]);
  const cur = insights.baseCurrency;
  const t = await getTranslations("Insights");
  const locale = await getLocale();
  const debtCost = buildDebtCost(carry, loanInterest);

  const navLink =
    "flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  // `scroll={false}` because the picker sits mid-page: the default jump to the
  // top would throw the reader away from the very cards they just re-scoped.
  const monthNav = (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href={`/insights?month=${addMonths(month, -1)}`}
        aria-label={t("prevMonthAria")}
        className={navLink}
        scroll={false}
      >
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium text-foreground">{monthLabel(month, locale)}</span>
      <Link
        href={`/insights?month=${addMonths(month, 1)}`}
        aria-label={t("nextMonthAria")}
        className={navLink}
        scroll={false}
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      {/* Page level, not chart level: the same missing rates skew net worth
          and the debt cost subtotals below. */}
      <FxDegradedNotice currencies={netWorth.fxUnconverted} base={cur} />

      {/* Four questions, three clocks, one band per clock: is my net worth
          moving (trend), where did this month's money go and am I on pace (the
          picked month — every card in that band obeys the picker in its
          heading, which is why the picker lives there and not at the top of the
          page), and what does my debt cost (now). Anything that answered a
          different question moved to the account it belongs to: per-card
          figures to the card's Boleta, transfer fees and tax to the bank
          account's page.

          Container query, not a viewport one, because the shell around these
          grids changes width: the sidebar takes 256px from `md` up and `main`
          adds 48px of padding, so a viewport number means two different card
          widths depending on whether the rail is showing. 34rem is that 304px
          of chrome subtracted from the ~850px viewport where the split is
          wanted.

          The plotted charts and the budget bars run full bleed because they
          are read along an axis and lose their shape when halved. The debt
          band is two lists of rows, which pair up fine at half width. */}
      <div className="@container space-y-10">
        <Section title={t("sectionPosition")}>
          <ChartCard title={t("cardNetWorth")} icon={TrendingUp} className="@[34rem]:col-span-2">
            <NetWorthChart data={netWorth.points} currency={netWorth.baseCurrency} />
          </ChartCard>

          <ChartCard title={t("cardCashFlow")} icon={ArrowLeftRight} className="@[34rem]:col-span-2">
            <CashflowChart data={insights.trend} currency={cur} />
          </ChartCard>
        </Section>

        <Section title={t("sectionThisMonth")} actions={monthNav}>
          <ChartCard title={t("cardSpendingPace")} basis={t("basisWhenCharged")} icon={Gauge} className="@[34rem]:col-span-2">
            <SpendingPace data={insights.pace} currency={cur} />
          </ChartCard>

          <ChartCard title={t("cardSpendDistribution")} basis={t("basisWhenCharged")} icon={PieChart} className="@[34rem]:col-span-2">
            <SpendDonut data={insights.distribution} total={insights.totalSpend} currency={cur} />
          </ChartCard>

          <ChartCard
            title={
              insights.budgetBarsBy === "group"
                ? t("cardExpensesVsBudgetGroups")
                : t("cardExpensesVsBudget")
            }
            basis={t("basisWhenPaid")}
            icon={BarChart3}
            className="@[34rem]:col-span-2"
          >
            <BudgetBars data={insights.budgetBars} currency={cur} />
          </ChartCard>
        </Section>

        <Section title={t("sectionDebt")}>
          <ChartCard title={t("cardDebtHealth")} icon={HeartPulse}>
            <DebtHealth utilization={insights.utilization} loans={insights.loans} />
          </ChartCard>

          <ChartCard title={t("debtCostTitle")} icon={Landmark}>
            <DebtCostList data={debtCost} locale={locale} />
          </ChartCard>
        </Section>
      </div>
    </div>
  );
}
