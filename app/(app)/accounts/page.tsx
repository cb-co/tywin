import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AccountGallery } from "@/components/accounts/account-gallery";
import { CardArtBackfill } from "@/components/accounts/card-art-backfill";
import {
  getAccountsWithStatus,
  getCurrencies,
  getCardGroups,
  getBanks,
} from "@/lib/accounts/queries";
import { hasCardAccent } from "@/lib/accounts/card-art";
import { baseCurrencyOf, profileLabel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AccountsPage() {
  const [accounts, currencies, cardGroups, banks] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
  ]);
  const t = await getTranslations("Accounts");

  const supabase = await createClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("base_currency, display_name").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const baseCurrency = baseCurrencyOf(profile);

  // The name embossed on every card face. Falls back through the same chain the
  // rest of the shell uses, then to a neutral label — a card face with an empty
  // name line looks broken, and an email address there looks worse.
  const holder = profileLabel(profile?.display_name, auth.user?.email) || t("cardholder");

  // Counted here rather than inside the client component so the backfill stays
  // inert on every visit after the first successful pass.
  const pendingArt =
    accounts.filter(
      (a) => a.type === "credit_card" && !a.card_group_id && !hasCardAccent(a.color),
    ).length + cardGroups.filter((g) => !hasCardAccent(g.art_color)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <AccountGallery
        accounts={accounts}
        currencies={currencies}
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
        holder={holder}
      />
      <CardArtBackfill pending={pendingArt} />
    </div>
  );
}
