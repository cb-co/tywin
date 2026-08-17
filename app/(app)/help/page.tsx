import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  LineChart,
  Coins,
  PieChart,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { HelpChapter, HelpCallout } from "@/components/help/chapter";
import { SectionNav, type HelpSection } from "@/components/help/section-nav";
import {
  AccountsMock,
  BudgetsMock,
  InsightsMock,
  LedgerMock,
  OnboardingMock,
  OverviewMock,
  SettingsMock,
  SubscriptionsMock,
} from "@/components/help/mocks";

export default async function HelpPage() {
  const t = await getTranslations("Help");

  const navIconClass = "size-4 shrink-0";
  const sections: HelpSection[] = [
    { id: "getting-started", label: t("gettingStartedTitle"), icon: <Sparkles className={navIconClass} /> },
    { id: "overview", label: t("overviewTitle"), icon: <LayoutDashboard className={navIconClass} /> },
    { id: "accounts", label: t("accountsTitle"), icon: <Wallet className={navIconClass} /> },
    { id: "transactions", label: t("transactionsTitle"), icon: <ArrowLeftRight className={navIconClass} /> },
    { id: "budgets", label: t("budgetsTitle"), icon: <PieChart className={navIconClass} /> },
    { id: "subscriptions", label: t("subscriptionsTitle"), icon: <Repeat className={navIconClass} /> },
    { id: "insights", label: t("insightsTitle"), icon: <LineChart className={navIconClass} /> },
    { id: "settings", label: t("settingsTitle"), icon: <Settings className={navIconClass} /> },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />

      <div className="grid gap-8 md:grid-cols-[14rem_1fr] md:items-start">
        <SectionNav sections={sections} />

        <div>
          <HelpChapter
            id="getting-started"
            icon={Sparkles}
            index={1}
            title={t("gettingStartedTitle")}
            intro={t("gettingStartedIntro")}
          >
            <ol className="space-y-3">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="figure flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(`step${n}Title`)}</p>
                    <p className="text-sm text-muted-foreground">{t(`step${n}Body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <HelpCallout icon={Landmark} title={t("bankCalloutTitle")}>
                {t("bankCalloutBody")}
              </HelpCallout>
              <div className="mt-4">
                <OnboardingMock
                  label={t("onboardingMockLabel")}
                  account={t("onboardingMockAccount")}
                  subtitle={t("onboardingMockSubtitle")}
                />
              </div>
            </div>
          </HelpChapter>

          <HelpChapter
            id="overview"
            icon={LayoutDashboard}
            index={2}
            title={t("overviewTitle")}
            intro={t("overviewIntro")}
          >
            <div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>{t("overviewNetWorth")}</li>
                <li>{t("overviewStats")}</li>
                <li>{t("overviewUpcoming")}</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">{t("overviewZeroState")}</p>

              <h3 className="mt-5 text-sm font-semibold text-foreground">{t("gettingAroundTitle")}</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("desktopNavTitle")}
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-foreground">
                    <li>{t("overviewTitle")}</li>
                    <li>{t("accountsTitle")}</li>
                    <li>{t("transactionsTitle")}</li>
                    <li>{t("budgetsTitle")}</li>
                    <li>{t("subscriptionsTitle")}</li>
                    <li>{t("insightsTitle")}</li>
                    <li>{t("settingsTitle")}</li>
                  </ul>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("mobileNavTitle")}
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-foreground">
                    <li>{t("accountsTitle")}</li>
                    <li>{t("mobileNavActivity")}</li>
                    <li>{t("overviewTitle")}</li>
                    <li>{t("budgetsTitle")}</li>
                    <li>{t("insightsTitle")}</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("navNote")}</p>
            </div>
            <OverviewMock
              netWorthLabel={t("overviewMockNetWorth")}
              incomeLabel={t("overviewMockIncome")}
              spentLabel={t("overviewMockSpent")}
              budgetUsedLabel={t("overviewMockBudgetUsed")}
              upcomingItem={t("overviewMockUpcomingItem")}
              upcomingSubtitle={t("overviewMockUpcomingSubtitle")}
            />
          </HelpChapter>

          <HelpChapter
            id="accounts"
            icon={Wallet}
            index={3}
            title={t("accountsTitle")}
            intro={t("accountsIntro")}
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("commonFieldsTitle")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["fieldName", "fieldBank", "fieldCurrency", "fieldStartingBalance", "fieldTransferTax", "fieldNetworkFee"] as const).map(
                  (k) => (
                    <Badge key={k} variant="outline">
                      {t(k)}
                    </Badge>
                  ),
                )}
              </div>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{t("cardFieldsTitle")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["fieldBalanceOwed", "fieldCreditLimit", "fieldClosingDay", "fieldDueDay", "fieldCardGroup"] as const).map((k) => (
                  <Badge key={k} variant="outline">
                    {t(k)}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("cardGroupNote")}</p>

              <h3 className="mt-5 text-sm font-semibold text-foreground">{t("cardFaceTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("cardFaceBody")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("cardFaceReroll")}</p>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{t("loanFieldsTitle")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["fieldPrincipal", "fieldInterestRate", "fieldTerm", "fieldInstallment", "fieldStartDate"] as const).map((k) => (
                  <Badge key={k} variant="outline">
                    {t(k)}
                  </Badge>
                ))}
              </div>

              <HelpCallout icon={ShieldCheck} title={t("sameBankCalloutTitle")}>
                {t("sameBankCalloutBody")}
              </HelpCallout>

              <h3 className="mt-5 text-sm font-semibold text-foreground">{t("accountPageTitle")}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                <li>{t("accountPageFace")}</li>
                <li>{t("accountPageLines")}</li>
                <li>{t("accountPageBalance")}</li>
                <li>{t("accountPageUtilization")}</li>
                <li>{t("accountPageCashback")}</li>
                <li>{t("accountPageCostOfOwnership")}</li>
                <li>{t("accountPageSpend")}</li>
                <li>{t("accountPageAmortization")}</li>
                <li>{t("accountPageActivity")}</li>
                <li>{t("accountPageActions")}</li>
              </ul>

              <h3 className="mt-5 text-sm font-semibold text-foreground">{t("statementsTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("statementsBody")}</p>
            </div>
            <AccountsMock
              checking={t("accountsMockChecking")}
              checkingType={t("accountsMockCheckingType")}
              owedLabel={t("accountsMockOwedLabel")}
              cardLimit={t("accountsMockLimit")}
              cardDue={t("accountsMockCardDue")}
              holder={t("accountsMockHolder")}
              lineCurrent={t("accountsMockLineCurrent")}
              lineOther={t("accountsMockLineOther")}
            />
          </HelpChapter>

          <HelpChapter
            id="transactions"
            icon={ArrowLeftRight}
            index={4}
            title={t("transactionsTitle")}
            intro={t("transactionsIntro")}
          >
            <div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>{t("typeExpense")}</li>
                <li>{t("typeIncome")}</li>
                <li>{t("typePayment")}</li>
              </ul>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{t("togglesTitle")}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                <li>{t("toggleTax")}</li>
                <li>{t("toggleFee")}</li>
              </ul>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{t("addingTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("addingBody")}</p>

              <h3 className="mt-4 text-sm font-semibold text-foreground">{t("findingTitle")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t("findingBody")}</p>

              <HelpCallout icon={Tags} title={t("merchantCalloutTitle")}>
                {t("merchantCalloutBody")}
              </HelpCallout>
            </div>
            <LedgerMock
              label={t("transactionsTitle")}
              groceries={t("ledgerMockGroceries")}
              groceriesAccount={t("ledgerMockGroceriesAccount")}
              groceriesBadge={t("ledgerMockGroceriesBadge")}
              paycheck={t("ledgerMockPaycheck")}
              paycheckAccount={t("ledgerMockPaycheckAccount")}
              payment={t("ledgerMockPayment")}
              paymentAccounts={t("ledgerMockPaymentAccounts")}
            />
          </HelpChapter>

          <HelpChapter
            id="budgets"
            icon={PieChart}
            index={5}
            title={t("budgetsTitle")}
            intro={t("budgetsIntro")}
          >
            <div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>{t("budgetsCategory")}</li>
                <li>{t("budgetsInline")}</li>
                <li>{t("budgetsProgress")}</li>
                <li>{t("budgetsHeader")}</li>
              </ul>
              <HelpCallout icon={Repeat} title={t("copyCalloutTitle")}>
                {t("copyCalloutBody")}
              </HelpCallout>
            </div>
            <BudgetsMock
              month={t("budgetsMockMonth")}
              food={t("budgetsMockFood")}
              transport={t("budgetsMockTransport")}
              entertainment={t("budgetsMockEntertainment")}
            />
          </HelpChapter>

          <HelpChapter
            id="subscriptions"
            icon={Repeat}
            index={6}
            title={t("subscriptionsTitle")}
            intro={t("subscriptionsIntro")}
          >
            <div>
              <ul className="space-y-2 text-sm text-foreground">
                <li>{t("subName")}</li>
                <li>{t("subCycle")}</li>
                <li>{t("subLink")}</li>
                <li>{t("subViews")}</li>
                <li>{t("subBrand")}</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">{t("subLogCharge")}</p>
            </div>
            <SubscriptionsMock
              streaming={t("subscriptionsMockStreaming")}
              streamingCycle={t("subscriptionsMockStreamingCycle")}
              streamingNext={t("subscriptionsMockStreamingNext")}
              cloud={t("subscriptionsMockCloud")}
              cloudCycle={t("subscriptionsMockCloudCycle")}
              cloudNext={t("subscriptionsMockCloudNext")}
              addCharge={t("subAddCharge")}
            />
          </HelpChapter>

          <HelpChapter
            id="insights"
            icon={LineChart}
            index={7}
            title={t("insightsTitle")}
            intro={t("insightsIntro")}
          >
            <ul className="space-y-2 text-sm text-foreground">
              <li>{t("insightsSpend")}</li>
              <li>{t("insightsDebt")}</li>
              <li>{t("insightsCashflow")}</li>
              <li>{t("insightsBudget")}</li>
              <li>{t("insightsCarry")}</li>
              <li>{t("insightsCashback")}</li>
              <li>{t("insightsCostOfOwnership")}</li>
              <li>{t("insightsLoanInterest")}</li>
            </ul>
            <InsightsMock
              label={t("insightsMockLabel")}
              thisMonth={t("insightsMockThisMonth")}
              essentials={t("legendEssentials")}
              discretionary={t("legendDiscretionary")}
              subscriptions={t("legendSubscriptions")}
              other={t("legendOther")}
            />
          </HelpChapter>

          <HelpChapter
            id="settings"
            icon={Settings}
            index={8}
            title={t("settingsTitle")}
            intro={t("settingsIntro")}
          >
            <ul className="space-y-2 text-sm text-foreground">
              <li>{t("settingsName")}</li>
              <li>{t("settingsTheme")}</li>
              <li>{t("settingsSound")}</li>
              <li>{t("settingsInstall")}</li>
              <li>{t("settingsAccount")}</li>
            </ul>
            <SettingsMock
              currencyLabel={t("settingsMockCurrency")}
              currencyValue={t("settingsMockCurrencyValue")}
              themeLabel={t("settingsMockTheme")}
              soundLabel={t("settingsMockSound")}
              installLabel={t("settingsMockInstall")}
              installButton={t("settingsMockInstallButton")}
            />
          </HelpChapter>

          <p className="flex items-center gap-2 pt-8 text-sm text-muted-foreground">
            <Coins className="size-4 shrink-0" />
            {t("footerNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
