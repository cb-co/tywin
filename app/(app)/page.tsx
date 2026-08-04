import Link from "next/link";
import { Wallet, PieChart, Repeat, ArrowUpRight, ArrowDownLeft, CalendarClock } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SpotIllustration } from "@/components/brand/spot-illustration";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HeroCard } from "@/components/ui/hero-card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { ColorTile } from "@/components/ui/color-tile";
import { StatPill } from "@/components/ui/stat-pill";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { createClient } from "@/lib/supabase/server";
import { getOverview } from "@/lib/overview/queries";
import { formatPercent } from "@/lib/format";
import { greetingName } from "@/lib/profile";

const STARTER_CARDS = [
  { href: "/accounts", icon: Wallet, tint: "var(--chart-1)", key: "Accounts" as const },
  { href: "/budgets", icon: PieChart, tint: "var(--chart-2)", key: "Budgets" as const },
  { href: "/subscriptions", icon: Repeat, tint: "var(--chart-3)", key: "Subscriptions" as const },
];

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <MarketingHome />;

  const o = await getOverview();
  const t = await getTranslations("Overview");
  const locale = await getLocale();
  const upcomingFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  // A name turns the page header into a greeting. Without one we keep the
  // plain section title rather than greeting an email address.
  const name = greetingName(o.displayName, null);
  const heading = name ? t("welcomeNamed", { name }) : t("title");
  const emptyHeading = name ? t("welcomeNamed", { name }) : t("greetingTitle");

  if (!o.hasAccounts) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rise">
          <PageHeader title={emptyHeading} description={t("greetingDescription")} />
        </div>
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <HeroCard
            label={t("netWorth")}
            action={
              <Button nativeButton={false} render={<Link href="/accounts" />}>
                {t("addAccount")}
                <ArrowUpRight className="size-4" />
              </Button>
            }
          >
            <MoneyDisplay amount={0} currency={o.baseCurrency} size="hero" />
            <p className="mt-3 max-w-md text-sm opacity-80">{t("netWorthEmptyBody")}</p>
            {/* Anchored to HeroCard's inner content wrapper, which is the
                nearest positioned ancestor, and clipped by the card's own
                overflow-hidden. Painted in the inherited hero foreground —
                `--brand` would be violet on the violet gradient. */}
            <SpotIllustration
              scene="chart"
              className="pointer-events-none absolute -right-2 -top-12 size-40 text-current opacity-25"
            />
          </HeroCard>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {STARTER_CARDS.map(({ href, icon: Icon, tint, key }, i) => (
            <Link
              key={href}
              href={href}
              className="group rise"
              style={{ "--i": i + 2 } as React.CSSProperties}
            >
              <Card className="lift h-full p-5 group-hover:shadow-(--shadow-card-hover)">
                <span
                  className="flex size-10 items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover:scale-110"
                  style={{ backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`, color: tint }}
                >
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 text-lg font-medium text-foreground">{t(`starter${key}Title`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`starter${key}Body`)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const budgetPct = o.totalBudget > 0 ? Math.min(Math.max((o.totalUsed / o.totalBudget) * 100, 0), 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rise">
        <PageHeader title={heading} description={t("description")} />
      </div>

      {/* Net worth hero */}
      <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <HeroCard label={t("netWorth")}>
          <MoneyDisplay amount={o.netWorth} currency={o.baseCurrency} size="hero" />
          <p className="mt-3 text-sm opacity-80">{t("netWorthBody", { currency: o.baseCurrency })}</p>
        </HeroCard>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rise p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <ColorTile color="var(--success)" icon={ArrowDownLeft} />
            <p className="text-xs text-muted-foreground">{t("incomeThisMonth")}</p>
          </div>
          <MoneyDisplay amount={o.monthIncome} currency={o.baseCurrency} size="stat" className="mt-2 text-success" />
        </Card>
        <Card className="rise p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <ColorTile color={null} icon={ArrowUpRight} />
            <p className="text-xs text-muted-foreground">{t("spendingThisMonth")}</p>
          </div>
          <MoneyDisplay amount={o.monthExpense} currency={o.baseCurrency} size="stat" className="mt-2 text-foreground" />
        </Card>
        <Card className="rise p-5" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="flex items-center gap-3">
            <ColorTile color="var(--brand)" icon={PieChart} />
            <p className="text-xs text-muted-foreground">{t("budgetUsed")}</p>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <MoneyDisplay amount={o.totalUsed} currency={o.baseCurrency} size="stat" className="text-foreground" />
            <StatPill tone={budgetPct >= 100 ? "destructive" : "neutral"}>
              {o.totalBudget > 0 ? formatPercent(budgetPct) : "—"}
            </StatPill>
          </div>
          {/* The bar grows to its measured share so the proportion registers
              as a quantity arriving rather than a pre-drawn block. */}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bar-fill h-full rounded-full bg-brand"
              style={{ width: `${budgetPct}%`, "--i": 4 } as React.CSSProperties}
            />
          </div>
        </Card>
      </div>

      {/* Upcoming rail */}
      <div className="rise space-y-3" style={{ "--i": 5 } as React.CSSProperties}>
        <h2 className="text-lg font-medium text-foreground">{t("upcoming")}</h2>
        {o.upcoming.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">{t("upcomingEmpty")}</Card>
        ) : (
          // `gap-0` because Card is a flex column with a default gap. Left on,
          // that gap sits between each row and the divider line above it, so
          // the rules float in the middle of empty bands instead of dividing
          // anything.
          <Card className="divide-y gap-0 p-0">
            {o.upcoming.map((item) => (
              <div
                key={item.key}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
              >
                <ColorTile
                  color={null}
                  icon={CalendarClock}
                  size="md"
                  className="transition-transform duration-200 ease-out group-hover:scale-105"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <div className="text-right">
                  <MoneyDisplay amount={item.amount} currency={item.currency} size="inline" className="text-foreground" />
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
