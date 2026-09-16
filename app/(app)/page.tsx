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
import { AvailableHero } from "@/components/overview/available-hero";
import { RecommendationCard } from "@/components/overview/recommendation-card";
import { AskEntry } from "@/components/overview/ask-entry";
import { ImportCallout } from "@/components/overview/import-callout";
import { ImportButton } from "@/components/statements/import-button";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { createClient } from "@/lib/supabase/server";
import { getOverview } from "@/lib/overview/queries";
import { getRecommendation } from "@/lib/overview/recommendation/queries";
import { formatPercent } from "@/lib/format";
import { greetingName } from "@/lib/profile";

const STARTER_CARDS = [
  { href: "/accounts", icon: Wallet, tint: "var(--chart-1)", key: "Accounts" as const },
  { href: "/budgets", icon: PieChart, tint: "var(--chart-2)", key: "Budgets" as const },
  { href: "/recurring", icon: Repeat, tint: "var(--chart-3)", key: "Recurring" as const },
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
          {/* Desktop only. On a phone the greeting is most of the line on its
              own, and ImportCallout right below is always rendered for a user
              with no accounts (importPromptState returns "never" on an empty
              card list), so the action is one scroll-free tap away regardless. */}
          <PageHeader
            title={emptyHeading}
            description={t("greetingDescription")}
            actions={<ImportButton className="max-sm:hidden" />}
          />
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
        {o.importPrompt !== "none" ? (
          <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <ImportCallout state={o.importPrompt} />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-3">
          {STARTER_CARDS.map(({ href, icon: Icon, tint, key }, i) => (
            <Link
              key={href}
              href={href}
              className="group rise"
              style={{ "--i": i + 3 } as React.CSSProperties}
            >
              <Card className="lift h-full p-5 group-hover:shadow-(--shadow-card-hover)">
                <ColorTile
                  color={tint}
                  icon={Icon}
                  size="md"
                  className="transition-transform duration-200 ease-out group-hover:scale-110"
                />
                <p className="mt-4 text-lg font-medium text-foreground">{t(`starter${key}Title`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(`starter${key}Body`)}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Read after the empty-state return, not before it: a user with no accounts
  // never renders the card, so the query would be pure waste on the one page
  // view where speed matters most.
  const { rec, stale } = await getRecommendation(locale);

  const budgetPct = o.totalBudget > 0 ? Math.min(Math.max((o.totalUsed / o.totalBudget) * 100, 0), 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rise">
        {/* Desktop only — below `sm` it moves down to the "Este período"
            heading, which is a row this page now draws anyway and which is
            exactly the band a fresh statement updates. */}
        <PageHeader
          title={heading}
          description={t("description")}
          actions={<ImportButton className="max-sm:hidden" />}
        />
      </div>

      {/* "Disponible hasta el <payday>" hero — what you can spend before the
          next quincenal payday, not what you're worth. Net worth moves to a
          secondary stat inside the same card rather than disappearing. */}
      <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <AvailableHero available={o.available} netWorth={o.netWorth} currency={o.baseCurrency} />
      </div>

      {/* Directly under the hero it qualifies: the available figure above it
          is now the one a 1:1 fallback distorts most. */}
      <FxDegradedNotice currencies={o.fxUnconverted} base={o.baseCurrency} className="rise" />

      {o.importPrompt !== "none" ? (
        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <ImportCallout state={o.importPrompt} />
        </div>
      ) : null}

      {/* Stat cards.

          Labelled from `sm` down, because the three figures are all scoped to
          the current period and the hero above them is not — stacked full-width
          on a phone they read as three more facts about the hero. The heading
          row doubles as the import button's mobile home; the two share a line,
          so the band costs nothing the page was not already spending.

          Two columns below `sm`: income and spending are the same shape and
          belong side by side, which halves the scroll. Budget keeps the full
          width because it carries a percentage pill and a progress bar as well
          as its figure, and none of the three survive a half-width card. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("thisPeriod")}
          </h2>
          <ImportButton variant="outline" size="sm" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {/* The two half-width tiles below `sm` trade the inline icon/label row
            for a stacked one and drop a step of padding and a step of type
            scale: at ~130px of interior width a label like "Ingresos este
            período" beside a 36px disc has nowhere to go, and a five-figure
            amount at `stat` runs past the card's edge. Both revert at `sm`,
            where the tile is a third of a wide page and neither is tight. */}
          <Card className="rise p-4 sm:p-5" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <ColorTile color="var(--success)" icon={ArrowDownLeft} />
              <p className="text-xs text-muted-foreground">{t("incomeThisPeriod")}</p>
            </div>
            <MoneyDisplay
              amount={o.monthIncome}
              currency={o.baseCurrency}
              size="stat"
              animate
              className="mt-2 text-xl text-success sm:text-2xl"
            />
          </Card>
          <Card className="rise p-4 sm:p-5" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <ColorTile color={null} icon={ArrowUpRight} />
              <p className="text-xs text-muted-foreground">{t("spendingThisPeriod")}</p>
            </div>
            <MoneyDisplay
              amount={o.monthExpense}
              currency={o.baseCurrency}
              size="stat"
              animate
              className="mt-2 text-xl text-foreground sm:text-2xl"
            />
          </Card>
          {/* Spans the row below `sm`. It carries a percentage pill and a
              progress bar as well as a figure, and none of the three read at
              half width. */}
          <Card
            className="rise col-span-2 p-5 sm:col-span-1"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <ColorTile color="var(--brand)" icon={PieChart} />
              <p className="text-xs text-muted-foreground">{t("budgetUsed")}</p>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <MoneyDisplay amount={o.totalUsed} currency={o.baseCurrency} size="stat" animate className="text-foreground" />
              <StatPill tone={budgetPct >= 100 ? "destructive" : "neutral"}>
                {o.totalBudget > 0 ? formatPercent(budgetPct) : "—"}
              </StatPill>
            </div>
            {/* The bar grows to its measured share so the proportion registers
                as a quantity arriving rather than a pre-drawn block. */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="bar-fill h-full rounded-full bg-brand"
                style={{ width: `${budgetPct}%`, "--i": 5 } as React.CSSProperties}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Coaching, after the figures it is about. */}
      <div className="rise" style={{ "--i": 6 } as React.CSSProperties}>
        <RecommendationCard rec={rec} stale={stale} />
      </div>

      {/* And the other half of the same idea: the card says what it noticed,
          this asks what you noticed. Also the only way onto /ask from a phone —
          the bottom bar stays at five cells — so it is a box you can type in
          rather than a link you have to follow first. */}
      <div className="rise" style={{ "--i": 7 } as React.CSSProperties}>
        <AskEntry />
      </div>

      {/* Upcoming rail */}
      <div className="rise space-y-3" style={{ "--i": 8 } as React.CSSProperties}>
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
