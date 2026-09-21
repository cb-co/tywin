import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { Plate } from "@/components/papel/plate";
import { SectionLegend } from "@/components/papel/section-legend";
import { getInsights, getCostOfCarry, getLoanInterest } from "@/lib/insights/queries";
import { buildDebtCost } from "@/lib/insights/debt-cost";
import { getNetWorthHistory } from "@/lib/insights/net-worth-history";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import {
  SpendLedger,
  CashflowChart,
  SpendingPace,
  NetWorthChart,
} from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { DebtCostList } from "@/components/insights/debt-cost";

/* Bands: each is a SectionLegend over a grid of Plates. The cards carry the
   page's weight, so the legend is the smallest type here — a word marking where
   one question ends and the next begins. `actions` is how the month picker ends
   up scoped: it belongs to one band, not to the page, and putting it in that
   band's legend is what says so.

   The Plate's `basis` says how a card counts money ("when charged" / "when
   paid"). This page deliberately shows both bases at once: the spend ledger and
   the pace line count a purchase the day it is made, while Expenses vs budget
   counts it the day it leaves an account. Two of those figures can land within
   a few dollars of each other by pure coincidence, which reads as a rounding
   bug unless the plates say what they are. */
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
      <SectionLegend aside={actions}>{title}</SectionLegend>
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
    "flex size-8 items-center justify-center rounded-(--radius) border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

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
      <span className="figure min-w-36 text-center text-sm font-medium text-foreground">{monthLabel(month, locale)}</span>
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
          <Plate fig={1} title={t("cardNetWorth")} className="@[34rem]:col-span-2">
            <NetWorthChart data={netWorth.points} currency={netWorth.baseCurrency} />
          </Plate>

          <Plate fig={2} title={t("cardCashFlow")} className="@[34rem]:col-span-2">
            <CashflowChart data={insights.trend} currency={cur} />
          </Plate>
        </Section>

        <Section title={t("sectionThisMonth")} actions={monthNav}>
          <Plate fig={3} title={t("cardSpendingPace")} basis={t("basisWhenCharged")} className="@[34rem]:col-span-2">
            <SpendingPace data={insights.pace} currency={cur} />
          </Plate>

          <Plate fig={4} title={t("cardSpendDistribution")} basis={t("basisWhenCharged")} className="@[34rem]:col-span-2">
            <SpendLedger data={insights.distribution} total={insights.totalSpend} currency={cur} />
          </Plate>

          <Plate
            fig={5}
            title={
              insights.budgetBarsBy === "group"
                ? t("cardExpensesVsBudgetGroups")
                : t("cardExpensesVsBudget")
            }
            basis={t("basisWhenPaid")}
            className="@[34rem]:col-span-2"
          >
            <BudgetBars data={insights.budgetBars} currency={cur} />
          </Plate>
        </Section>

        <Section title={t("sectionDebt")}>
          <Plate fig={6} title={t("cardDebtHealth")}>
            <DebtHealth utilization={insights.utilization} loans={insights.loans} />
          </Plate>

          <Plate fig={7} title={t("debtCostTitle")}>
            <DebtCostList data={debtCost} locale={locale} />
          </Plate>
        </Section>
      </div>
    </div>
  );
}
