import Link from "next/link";
import { Wallet, PieChart, Repeat, ArrowUpRight, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOverview } from "@/lib/overview/queries";
import { formatMoney, formatPercent } from "@/lib/format";

const STARTERS = [
  {
    href: "/accounts",
    icon: Wallet,
    tint: "var(--chart-1)",
    title: "Accounts & cards",
    body: "Add bank accounts, credit cards, and loans to see balances and utilization.",
  },
  {
    href: "/budgets",
    icon: PieChart,
    tint: "var(--chart-2)",
    title: "Budgets",
    body: "Set a monthly budget per category and watch what's used and what's left.",
  },
  {
    href: "/subscriptions",
    icon: Repeat,
    tint: "var(--chart-3)",
    title: "Subscriptions",
    body: "Track recurring charges and their next payment dates in one place.",
  },
];

const upcomingFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function OverviewPage() {
  const o = await getOverview();

  if (!o.hasAccounts) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader title="Good to see you" description="Your money at a glance, once your accounts are set up." />
        <Card className="relative overflow-hidden p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5"
          />
          <p className="text-sm font-medium text-muted-foreground">Net worth</p>
          <p className="figure mt-2 text-5xl leading-none text-foreground">
            {formatMoney(0, o.baseCurrency)}
          </p>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Add your first account and every balance, in any currency, rolls up here in your base currency.
          </p>
          <Button className="mt-5" nativeButton={false} render={<Link href="/accounts" />}>
            Add an account
            <ArrowUpRight className="size-4" />
          </Button>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {STARTERS.map(({ href, icon: Icon, tint, title, body }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/40">
                <span
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}
                >
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 text-lg font-medium text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const budgetPct = o.totalBudget > 0 ? Math.min((o.totalUsed / o.totalBudget) * 100, 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title="Overview" description="Your money at a glance." />

      {/* Net worth hero */}
      <Card className="relative overflow-hidden p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5"
        />
        <p className="text-sm font-medium text-muted-foreground">Net worth</p>
        <p className="figure mt-2 text-5xl leading-none text-foreground">
          {formatMoney(o.netWorth, o.baseCurrency)}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Assets minus cards and loans, in {o.baseCurrency}.</p>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Income this month</p>
          <p className="figure mt-1.5 text-2xl text-success">{formatMoney(o.monthIncome, o.baseCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Spending this month</p>
          <p className="figure mt-1.5 text-2xl text-foreground">{formatMoney(o.monthExpense, o.baseCurrency)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Budget used</p>
          <p className="figure mt-1.5 text-2xl text-foreground">
            {o.totalBudget > 0 ? formatPercent(budgetPct) : "—"}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Upcoming rail */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">Upcoming</h2>
        {o.upcoming.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No card due dates, loan installments, or subscription charges scheduled.
          </Card>
        ) : (
          <Card className="divide-y p-0">
            {o.upcoming.map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <CalendarClock className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <div className="text-right">
                  <p className="figure text-sm tabular-nums text-foreground">
                    {formatMoney(item.amount, item.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">{upcomingFmt.format(new Date(item.date))}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
