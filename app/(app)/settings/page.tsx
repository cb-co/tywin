import { PageHeader } from "@/components/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getCurrencies } from "@/lib/accounts/queries";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: userData }, currencies] = await Promise.all([
    supabase.auth.getUser(),
    getCurrencies(),
  ]);
  const user = userData.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Your base currency, categories, and theme." />
      <SettingsPanel
        email={user?.email ?? ""}
        baseCurrency={profile?.base_currency ?? "USD"}
        currencies={currencies}
      />
    </div>
  );
}
