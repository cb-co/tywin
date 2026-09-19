import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AccountGallery, AddAccountControl } from "@/components/accounts/account-gallery";
import { CardArtBackfill } from "@/components/accounts/card-art-backfill";
import { AttentionLedger } from "@/components/accounts/attention-ledger";
import { Note } from "@/components/papel/note";
import { MoneyDisplay } from "@/components/ui/money-display";
import {
  getAccountsWithStatus,
  getCurrencies,
  getCardGroups,
  getBanks,
  getNetWorth,
  getAccountsAttention,
} from "@/lib/accounts/queries";
import { hasCardAccent } from "@/lib/accounts/card-art";
import { baseCurrencyOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = baseCurrencyOf(profile);

  const [accounts, currencies, cardGroups, banks, netWorth, attention] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
    getNetWorth(baseCurrency),
    getAccountsAttention(),
  ]);
  const t = await getTranslations("Accounts");

  // Counted here rather than inside the client component so the backfill stays
  // inert on every visit after the first successful pass.
  const pendingArt =
    accounts.filter(
      (a) => a.type === "credit_card" && !a.card_group_id && !hasCardAccent(a.color),
    ).length + cardGroups.filter((g) => !hasCardAccent(g.art_color)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        actions={
          accounts.length > 0 ? (
            <AddAccountControl
              currencies={currencies}
              banks={banks}
              baseCurrency={baseCurrency}
              placeholder={t("addAccount")}
            />
          ) : undefined
        }
      />
      <AttentionLedger items={attention} />
      {accounts.length > 0 ? (
        <Note tone="violet" label={t("netWorthLabel")}>
          <MoneyDisplay amount={netWorth} currency={baseCurrency} size="hero" />
        </Note>
      ) : null}
      <AccountGallery
        accounts={accounts}
        currencies={currencies}
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
      />
      <CardArtBackfill pending={pendingArt} />
    </div>
  );
}
