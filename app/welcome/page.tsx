import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { baseCurrencyOf } from "@/lib/profile";
import { getCurrencies } from "@/lib/accounts/queries";
import { resumeStep, STEPS } from "@/lib/onboarding/resume";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { WelcomeFlow, type WelcomeData } from "@/components/onboarding/welcome-flow";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/brand/logo";
import { archivo } from "@/app/fonts";
import { Guilloche } from "@/components/papel/guilloche";
import { Microprint, Serial } from "@/components/papel/microprint";
import s from "@/components/marketing/papel/papel.module.css";
import { FigureMaskProvider } from "@/components/figure-mask/figure-mask-provider";
import { SoundProvider } from "@/components/sound/sound-provider";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency, onboarded_at, pay_cycle, pay_anchor_day")
    .maybeSingle();

  // Already set up: never show the flow again.
  if (profile?.onboarded_at) redirect("/");

  /* Everything the flow has already saved. Each step writes as it is passed,
     so these rows are both the resume point and the lists the optional steps
     show — which is what stops a refresh or a Back from creating a duplicate. */
  const [currencies, t, tl, tm, locale, accountsRes, statementsRes, subsRes, categoriesRes] =
    await Promise.all([
      getCurrencies(),
      getTranslations("Welcome"),
      getTranslations("Login"),
      getTranslations("Marketing"),
      getLocale(),
      supabase
        .from("accounts")
        .select("id,name,type,currency,last4,installment_amount,term_months")
        .eq("is_archived", false)
        .order("created_at"),
      supabase.from("card_statements").select("account_id"),
      supabase
        .from("subscriptions")
        .select("id,name,kind,amount,currency,billing_cycle")
        .eq("is_active", true)
        .in("kind", ["income", "expense"])
        .order("created_at"),
      supabase.from("categories").select("id,name"),
    ]);

  const accounts = accountsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const imported = new Set((statementsRes.data ?? []).map((s) => s.account_id));

  const data: WelcomeData = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      last4: a.last4,
      installment: a.installment_amount,
      remaining: a.term_months,
      imported: imported.has(a.id),
    })),
    income: subs.find((s) => s.kind === "income") ?? null,
    bills: subs.filter((s) => s.kind === "expense"),
    categories: categoriesRes.data ?? [],
    payCycle: profile?.pay_cycle ?? "semimonthly",
    payAnchorDay: profile?.pay_anchor_day ?? null,
  };

  const initialStep = resumeStep({
    hasName: !!profile?.display_name?.trim(),
    hasMainAccount: data.accounts.some((a) => a.type !== "credit_card" && a.type !== "loan"),
  });

  const stepLabelKey = {
    about: "stepAbout",
    account: "stepAccount",
    cards: "stepCards",
    income: "stepIncome",
    loans: "stepLoans",
    bills: "stepBills",
    done: "stepDone",
  } as const;

  return (
    <main className={`${s.page} ${s.authPage} ${archivo.variable}`}>
      {/* Continues the login's violet band: the same note panel, so the
          step from signing in to setting up is one continuous sheet. */}
      <section className={s.authNote} aria-labelledby="welcome-note-title">
        <Guilloche className={s.authRosette} />
        <Microprint text={tm("microprint")} />
        <Serial value="CL 2026 000417 A" className={s.serialBottom} />
        <Link href="/" className={s.brand}>
          <Logo />
          <Wordmark />
        </Link>
        <div className={s.authNoteCopy}>
          <h2 id="welcome-note-title" className={s.authNoteTitle}>
            {tl("heroTitle")}
          </h2>
          <p className={s.authNoteBody}>{tl("heroBody")}</p>
        </div>
      </section>

      <div className={s.authPaper}>
        {/* Welcome renders outside AppShell, which is where the rest of the app
            gets these contexts. The card step mounts the same statement import
            flow the app uses, which plays the success and error cues; the
            income, loans and bills steps list saved amounts through
            MoneyDisplay, which reads the figure-masking preference. */}
        <FigureMaskProvider>
          <SoundProvider>
            <WelcomeFlow
              currencies={currencies}
              initialName={profile?.display_name ?? ""}
              initialCurrency={baseCurrencyOf(profile)}
              initialStep={initialStep}
              locale={isLocale(locale) ? locale : DEFAULT_LOCALE}
              email={user.email ?? ""}
              data={data}
              stepLabels={STEPS.map((step) => t(stepLabelKey[step]))}
            />
          </SoundProvider>
        </FigureMaskProvider>
      </div>
    </main>
  );
}
