import Link from "next/link";
import { Wallet, PieChart, Repeat, CalendarClock } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "@/components/ui/money-display";
import { LedgerRow } from "@/components/papel/ledger-row";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { AvailableHero } from "@/components/overview/available-hero";
import { PeriodStub } from "@/components/overview/period-stub";
import { RecommendationCard } from "@/components/overview/recommendation-card";
import { AskEntry } from "@/components/overview/ask-entry";
import { ImportCallout, EmptyOverviewNote } from "@/components/overview/import-callout";
import { ImportButton } from "@/components/statements/import-button";
import { FxDegradedNotice } from "@/components/fx/fx-degraded-notice";
import { createClient } from "@/lib/supabase/server";
import { getOverview } from "@/lib/overview/queries";
import { getRecommendation } from "@/lib/overview/recommendation/queries";
import { localDate } from "@/lib/period/cycle";
import { greetingName } from "@/lib/profile";

const STARTER_LINKS = [
  { href: "/accounts", icon: Wallet, key: "Accounts" as const },
  { href: "/budgets", icon: PieChart, key: "Budgets" as const },
  { href: "/recurring", icon: Repeat, key: "Recurring" as const },
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
              own, and the empty note below carries the import action itself
              (importPromptState returns "never" on an empty card list), so the
              action is one scroll-free tap away regardless. */}
          <PageHeader
            title={emptyHeading}
            description={t("greetingDescription")}
            actions={<ImportButton className="max-sm:hidden" />}
          />
        </div>
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <EmptyOverviewNote currency={o.baseCurrency} />
        </div>
        <Card className="rise gap-0 p-0" style={{ "--i": 2 } as React.CSSProperties}>
          {STARTER_LINKS.map(({ href, icon: Icon, key }) => (
            <Link key={href} href={href} className="block outline-offset-[-2px] hover:bg-accent/40">
              <LedgerRow
                lead={<Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                title={t(`starter${key}Title`)}
                subtitle={t(`starter${key}Body`)}
                wrapSubtitle
              />
            </Link>
          ))}
        </Card>
      </div>
    );
  }

  // Read after the empty-state return, not before it: a user with no accounts
  // never renders the card, so the query would be pure waste on the one page
  // view where speed matters most.
  const { rec, stale } = await getRecommendation(locale);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rise">
        {/* Icon-only below `sm` so it shares the title row instead of taking its own. */}
        <PageHeader
          title={heading}
          description={t("description")}
          actions={<ImportButton iconOnlyOnMobile />}
        />
      </div>

      {/* One issued document: the note, then the stub torn along the
          perforation, with nothing between them but the FX notice. */}
      <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <AvailableHero
          available={o.available}
          netWorth={o.netWorth}
          currency={o.baseCurrency}
          period={o.period}
          today={localDate()}
        />
        <FxDegradedNotice currencies={o.fxUnconverted} base={o.baseCurrency} className="my-3" />
        <PeriodStub
          income={o.monthIncome}
          spending={o.monthExpense}
          used={o.totalUsed}
          budget={o.totalBudget}
          currency={o.baseCurrency}
        />
      </div>

      {o.importPrompt !== "none" ? (
        <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
          <ImportCallout state={o.importPrompt} />
        </div>
      ) : null}

      <div className="rise" style={{ "--i": 4 } as React.CSSProperties}>
        <RecommendationCard rec={rec} stale={stale} />
      </div>
      <div className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <AskEntry />
      </div>

      <div className="rise space-y-2" style={{ "--i": 6 } as React.CSSProperties}>
        <h2 className="legend text-[11px] text-muted-foreground">{t("upcoming")}</h2>
        {o.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("upcomingEmpty")}</p>
        ) : (
          <Card className="gap-0 p-0">
            {o.upcoming.map((item) => (
              <LedgerRow
                key={item.key}
                lead={<CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
                title={item.title}
                subtitle={item.subtitle}
                amount={<MoneyDisplay amount={item.amount} currency={item.currency} size="inline" className="text-foreground" />}
                meta={upcomingFmt.format(new Date(item.date))}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
