import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  PiggyBank,
  Gauge,
  PieChart,
  BarChart3,
  CreditCard,
  Receipt,
  HeartPulse,
  Landmark,
  Gift,
  Percent,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { ImportButton } from "@/components/statements/import-button";
import { PageHeader } from "@/components/page-header";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import {
  getInsights,
  getCostOfCarry,
  getCardPayments,
  getCashbackByCard,
  getTransferCosts,
  getLoanInterest,
  getCardFees,
  sumCashbackByCurrency,
} from "@/lib/insights/queries";
import { getNetWorthHistory } from "@/lib/insights/net-worth-history";
import { getGoalsOverview } from "@/lib/goals/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { normalizeMonth, addMonths, monthLabel } from "@/lib/budgets/month";
import {
  SpendDonut,
  CashflowChart,
  SpendingPace,
  NetWorthChart,
} from "@/components/insights/lazy-charts";
import { BudgetBars } from "@/components/insights/budget-bars";
import { DebtHealth } from "@/components/insights/debt-health";
import { SavingsGoals } from "@/components/insights/savings-goals";

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

/**
 * A list of amounts closed by a total. The rows sit at the top and the total is
 * pushed to the bottom edge, so when this card is paired with a taller one the
 * extra height opens up between them instead of leaving the card short. Reads
 * like a receipt, which is what it is.
 */
function Tally({ rows, total }: { rows: React.ReactNode; total?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* `pb-4` rather than a margin on the total: `mt-auto` collapses to zero
          whenever the card has no spare height, and then the rule sits flush
          against the last row. The padding guarantees the gap either way. */}
      <div className="space-y-3 pb-4">{rows}</div>
      {/* A tally can legitimately have nothing to close with: cashback is held
          per currency and never converted, so there is no one figure to sum to.
          Omitting the rule beats drawing an empty one. */}
      {total ? (
        <div className="mt-auto space-y-1.5 border-t pt-3 text-sm font-medium">{total}</div>
      ) : null}
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = normalizeMonth(monthParam);
  const [
    insights,
    carry,
    cardPayments,
    netWorth,
    goals,
    cashback,
    transferCosts,
    loanInterest,
    cardFees,
  ] = await Promise.all([
    getInsights(month),
    getCostOfCarry(),
    getCardPayments(month),
    getNetWorthHistory(),
    getGoalsOverview(),
    getCashbackByCard(),
    getTransferCosts(),
    getLoanInterest(),
    getCardFees(),
  ]);
  const cur = insights.baseCurrency;
  const t = await getTranslations("Insights");
  const locale = await getLocale();
  const carryLines = carry.lines.filter(
    (l): l is typeof l & { costOfCarry: number } => l.costOfCarry !== null,
  );
  const cashbackTotalsByCurrency = sumCashbackByCurrency(cashback.lines);

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

      {/* Page level, not chart level: the same missing rates skew net worth,
          cost of carry and the cashback totals below. */}
      <FxDegradedNotice currencies={netWorth.fxUnconverted} base={cur} />

      {/* Ordered widest question to narrowest: what you're worth, then what
          moved this month, then what the debt behind it costs. The bands also
          sort the cards by what they answer to — only the middle one is driven
          by a month, which is why the picker lives in its heading rather than
          at the top of the page promising to move charts it can't.

          Container query, not a viewport one, because the shell around these
          grids changes width: the sidebar takes 256px from `md` up and `main`
          adds 48px of padding, so a viewport number means two different card
          widths depending on whether the rail is showing.

          34rem is that 304px of chrome subtracted from the ~850px viewport
          where the split is wanted. Stated as container width it stays true
          when the rail is not there — on a tablet with no sidebar the columns
          come in earlier in viewport terms, at the same actual width.

          The four plotted charts run full bleed because they are read along
          the x-axis and lose their shape when halved; everything else is a list
          of rows and pairs up fine at half width.

          Pairings are by subject, not by leftover space: budget against the
          card payments it has to cover, and debt health against what that debt
          costs to carry. */}
      <div className="@container space-y-10">
        <Section title={t("sectionPosition")}>
          <ChartCard title={t("cardNetWorth")} icon={TrendingUp} className="@[34rem]:col-span-2">
            <NetWorthChart data={netWorth.points} currency={netWorth.baseCurrency} />
          </ChartCard>

          <ChartCard title={t("cardCashFlow")} icon={ArrowLeftRight} className="@[34rem]:col-span-2">
            <CashflowChart data={insights.trend} currency={cur} />
          </ChartCard>

          <ChartCard title={t("cardSavingsGoals")} icon={PiggyBank} className="@[34rem]:col-span-2">
            <SavingsGoals
              goals={goals.goals}
              totalSaved={goals.totalSaved}
              totalTarget={goals.totalTarget}
              currency={goals.baseCurrency}
            />
          </ChartCard>
        </Section>

        <Section title={t("sectionThisMonth")} actions={monthNav}>
          <ChartCard title={t("cardSpendingPace")} basis={t("basisWhenCharged")} icon={Gauge} className="@[34rem]:col-span-2">
            <SpendingPace data={insights.pace} currency={cur} />
          </ChartCard>

          <ChartCard title={t("cardSpendDistribution")} basis={t("basisWhenCharged")} icon={PieChart} className="@[34rem]:col-span-2">
            <SpendDonut data={insights.distribution} total={insights.totalSpend} currency={cur} />
          </ChartCard>

          <ChartCard title={t("cardExpensesVsBudget")} basis={t("basisWhenPaid")} icon={BarChart3}>
            <BudgetBars data={insights.budgetBars} currency={cur} />
          </ChartCard>

          <ChartCard title={t("cardCardPayments")} icon={CreditCard}>
            {cardPayments.lines.length > 0 ? (
              <Tally
                rows={cardPayments.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.amount, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("cardPaymentsTotal", { currency: cardPayments.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(cardPayments.totalBase, cardPayments.baseCurrency)}
                    </span>
                  </div>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("cardPaymentsEmpty")}</p>
            )}
          </ChartCard>

          {/* Year-to-date, not month-scoped — the "YTD" in the title is what
              tells the reader this card ignores the month picker in this
              section's heading. Cashback's title states its year for a
              similar reason, but that's not quite the same disambiguation:
              Cashback lives in the Debt section, which has no month picker
              to disambiguate against. This card, unlike its section-mates,
              sits right under a live one and silently doesn't respond to it. */}
          <ChartCard
            title={t("transferCostsTitle", { year: String(transferCosts.year) })}
            icon={Receipt}
          >
            <div className="flex flex-1 items-center justify-around gap-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("transferFeesLabel")}
                </span>
                <MoneyDisplay
                  amount={transferCosts.totalFeesBase}
                  currency={transferCosts.baseCurrency}
                  size="stat"
                  animate
                />
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("transferTaxLabel")}
                </span>
                <MoneyDisplay
                  amount={transferCosts.totalTaxBase}
                  currency={transferCosts.baseCurrency}
                  size="stat"
                  animate
                />
              </div>
            </div>
          </ChartCard>
        </Section>

        <Section title={t("sectionDebt")}>
          <ChartCard title={t("cardDebtHealth")} icon={HeartPulse}>
            <DebtHealth utilization={insights.utilization} loans={insights.loans} />
          </ChartCard>

          <ChartCard title={t("costOfCarryTitle")} icon={Landmark}>
            {carryLines.length > 0 ? (
              <Tally
                rows={carryLines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.currency} ·{" "}
                        {l.apr !== null ? `${t("costOfCarryApr", { rate: l.apr })} · ` : ""}
                        {t("costOfCarryAsOf", { date: formatDate(l.periodEnd, locale) })}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.costOfCarry, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <div className="flex items-baseline justify-between">
                    <span className="text-foreground">
                      {t("costOfCarryTotal", { currency: carry.baseCurrency })}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatMoney(carry.totalBase, carry.baseCurrency)}
                    </span>
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("costOfCarryEmpty")}</p>
                <ImportButton size="sm" />
              </div>
            )}
          </ChartCard>

          {/* The loan counterpart to cost of carry, and deliberately not folded
              into it: that card's figure is what a card *would* charge you to
              finance ("Interés si Opta Por Financiar" on the statement), while
              every number here is interest already paid. One total cannot close
              over a projection and a charge.

              Sits under Debt health — the card whose loan bars these rows put a
              price on — leaving Cost of carry and Cashback stacked in the other
              column as the two halves of the card ledger.

              Rows are per loan and monthly, so the run-rate total sums like
              terms. The year figure is a grand total only: each loan has been
              tracked for however long it has been in the app, so the per-loan
              windows differ and comparing them would mislead in a way that
              summing real payments into one figure does not. */}
          <ChartCard title={t("loanInterestTitle")} icon={Percent}>
            {loanInterest.lines.length > 0 ? (
              <Tally
                rows={loanInterest.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.currency} ·{" "}
                        {l.apr !== null ? `${t("costOfCarryApr", { rate: l.apr })} · ` : ""}
                        {t("costOfCarryAsOf", { date: formatDate(l.lastPaymentDate, locale) })}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.lastInterest, l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground">
                        {t("loanInterestMonthly", { currency: loanInterest.baseCurrency })}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {formatMoney(loanInterest.monthlyBase, loanInterest.baseCurrency)}
                      </span>
                    </div>
                    {/* "Recorded in", not "Paid in": payments made before the
                        loan was added to the app were never transactions, so
                        this counts the tracked part of the year, not the year. */}
                    <div className="flex items-baseline justify-between text-muted-foreground">
                      <span>
                        {t("loanInterestRecorded", {
                          year: String(loanInterest.year),
                          currency: loanInterest.baseCurrency,
                        })}
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(loanInterest.yearBase, loanInterest.baseCurrency)}
                      </span>
                    </div>
                  </>
                }
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loanInterestEmpty")}
              </p>
            )}
          </ChartCard>

          {/* The other side of the same ledger as cost of carry: what the card
              charges you to carry a balance, and what it pays you back for
              spending. Each row stays in its own card's currency — see
              getCashbackByCard — so there is no closing total. */}
          {/* String year — a numeric ICU argument goes through Intl.NumberFormat
              and would render "2,026". */}
          <ChartCard title={t("cashbackTitle", { year: String(cashback.year) })} icon={Gift}>
            {cashback.lines.length > 0 ? (
              <Tally
                rows={cashback.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.currency}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(l.total, l.currency)}
                    </span>
                  </div>
                ))}
                total={cashbackTotalsByCurrency.map(([currency, total]) => (
                  <div key={currency} className="flex items-baseline justify-between">
                    <span className="text-foreground">{t("cashbackTotal", { currency })}</span>
                    <span className="tabular-nums text-foreground">{formatMoney(total, currency)}</span>
                  </div>
                ))}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("cashbackEmpty")}</p>
                <ImportButton size="sm" />
              </div>
            )}
          </ChartCard>

          {/* The third column of the card ledger, and deliberately never netted
              against the second. Lounge access, travel insurance and purchase
              protection never reach a statement, so a cost-minus-benefit figure
              would be built from the costs the app can see and a blank where the
              benefits are — authoritative-looking and wrong in one direction.
              Cost and return sit side by side; the reader nets them against the
              benefits they know about and the app does not.

              Rows carry the recurring figure, because that is the cost of
              OWNING the card — a standing charge you decide about. Incidents
              are things that happened and ride along in the subtitle, so a card
              whose only charge was an overdraft still shows why it is listed.

              "Cost of ownership in {year}", never an annualized run rate:
              statement history is months old, and the charges are irregular
              enough that any per-month figure times twelve would be fiction.
              Same honesty as the loan interest card's "Recorded in". */}
          <ChartCard title={t("cardFeesTitle", { year: String(cardFees.year) })} icon={ShieldAlert}>
            {cardFees.lines.length > 0 ? (
              <Tally
                rows={cardFees.lines.map((l) => (
                  <div key={l.accountId} className="flex items-baseline justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{l.name}</p>
                      {/* Negative recurring/incidents figures are reversals of a
                          PRIOR year's charge, netted in by summarizeCardFees — see
                          getCardFees. `formatMoney` would otherwise print a bare
                          minus sign, which reads backwards under a cost heading, so
                          the sign is reworded as "refunded" here in the subtitle
                          rather than in the tabular-nums value slot to its right:
                          words there would break that column's alignment across
                          rows. The value slot always shows the magnitude; this line
                          is what tells the reader which direction it points. */}
                      <p className="text-xs text-muted-foreground">
                        {l.currency}
                        {l.recurring < 0
                          ? ` · ${t("cardFeesRefundedRow", { amount: formatMoney(Math.abs(l.recurring), l.currency) })}`
                          : ""}
                        {l.incidents !== 0
                          ? ` · ${t(l.incidents > 0 ? "cardFeesIncidentsRow" : "cardFeesRefundedRow", { amount: formatMoney(Math.abs(l.incidents), l.currency) })}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatMoney(Math.abs(l.recurring), l.currency)}
                    </span>
                  </div>
                ))}
                total={
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-foreground">
                        {t(
                          cardFees.recurringBase < 0
                            ? "cardFeesRecurringRefunded"
                            : "cardFeesRecurring",
                          { currency: cardFees.baseCurrency },
                        )}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {formatMoney(Math.abs(cardFees.recurringBase), cardFees.baseCurrency)}
                      </span>
                    </div>
                    {cardFees.incidentsBase !== 0 ? (
                      <div className="flex items-baseline justify-between text-muted-foreground">
                        <span>
                          {t(
                            cardFees.incidentsBase < 0
                              ? "cardFeesIncidentsRefunded"
                              : "cardFeesIncidents",
                            { currency: cardFees.baseCurrency },
                          )}
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(Math.abs(cardFees.incidentsBase), cardFees.baseCurrency)}
                        </span>
                      </div>
                    ) : null}
                  </>
                }
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("cardFeesEmpty")}</p>
                <ImportButton size="sm" />
              </div>
            )}
          </ChartCard>
        </Section>
      </div>
    </div>
  );
}
