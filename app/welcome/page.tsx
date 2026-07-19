import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies } from "@/lib/accounts/queries";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { Logo, Wordmark } from "@/components/brand/logo";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency, onboarded_at")
    .maybeSingle();

  // Already set up: never show the flow again.
  if (profile?.onboarded_at) redirect("/");

  const [currencies, t] = await Promise.all([
    getCurrencies(),
    getTranslations("Welcome"),
  ]);

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2.5 px-6">
        <Logo />
        <Wordmark />
      </header>

      <div className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:items-center sm:pt-0">
        <WelcomeFlow
          currencies={currencies}
          initialName={profile?.display_name ?? ""}
          initialCurrency={profile?.base_currency ?? "USD"}
          email={user.email ?? ""}
          stepLabels={[t("stepName"), t("stepCurrency"), t("stepAccount")]}
        />
      </div>
    </main>
  );
}
