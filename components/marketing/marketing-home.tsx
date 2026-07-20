import Link from "next/link";
import { ArrowUpRight, PieChart, Repeat, TrendingUp, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo, Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";

const FEATURES = [
  { icon: Wallet, tint: "var(--chart-1)", key: "Accounts" as const },
  { icon: PieChart, tint: "var(--chart-2)", key: "Budgets" as const },
  { icon: Repeat, tint: "var(--chart-3)", key: "Subscriptions" as const },
  { icon: TrendingUp, tint: "var(--chart-4)", key: "Insights" as const },
];

/** Public, unauthenticated home page. Google's OAuth verification and any
 *  signed-out visitor land here, so it has to explain what Cashly does on
 *  its own — it can't assume the reader already knows. */
export async function MarketingHome() {
  const t = await getTranslations("Marketing");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
            {t("logIn")}
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div className="rise max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            {t("heroBody")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/login" />}>
              {t("getStarted")}
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* A real slice of the app's own dashboard components, not a fake
            screenshot: same Card primitives, illustrative numbers. */}
        <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <Card className="relative overflow-hidden p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/5"
            />
            <p className="text-sm font-medium text-muted-foreground">{t("netWorth")}</p>
            <p className="figure mt-2 text-5xl leading-none text-foreground">
              $48,213.62
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{t("netWorthCaption")}</p>
          </Card>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("incomeLabel")}</p>
              <p className="figure mt-1 text-lg text-success">$6,140</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("spendingLabel")}</p>
              <p className="figure mt-1 text-lg text-foreground">$3,872</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t("budgetUsedLabel")}</p>
              <p className="figure mt-1 text-lg text-foreground">64%</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, tint, key }, i) => (
            <Card
              key={key}
              className="rise p-6"
              style={{ "--i": i + 2 } as React.CSSProperties}
            >
              <span
                className="flex size-10 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `color-mix(in oklab, ${tint} 16%, transparent)`,
                  color: tint,
                }}
              >
                <Icon className="size-5" />
              </span>
              <p className="mt-4 text-lg font-medium text-foreground">
                {t(`feature${key}Title`)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`feature${key}Body`)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("ctaBody")}</p>
          <Button size="lg" nativeButton={false} render={<Link href="/login" />}>
            {t("getStarted")}
            <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <span>Cashly</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-foreground">
              {t("termsLink")}
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              {t("privacyLink")}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
