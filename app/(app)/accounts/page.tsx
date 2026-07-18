import { PageHeader } from "@/components/page-header";
import { AccountGallery } from "@/components/accounts/account-gallery";
import { getAccountsWithStatus, getCurrencies } from "@/lib/accounts/queries";
import { createClient } from "@/lib/supabase/server";

export default async function AccountsPage() {
  const [accounts, currencies] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
  ]);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = profile?.base_currency ?? "USD";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Accounts"
        description="Bank accounts, credit cards, loans, and assets."
      />
      <AccountGallery
        accounts={accounts}
        currencies={currencies}
        baseCurrency={baseCurrency}
      />
    </div>
  );
}
