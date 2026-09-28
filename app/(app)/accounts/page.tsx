import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AccountGallery, AddAccountControl } from "@/components/accounts/account-gallery";
import { CardArtBackfill } from "@/components/accounts/card-art-backfill";
import { AttentionLedger } from "@/components/accounts/attention-ledger";
import {
  getAccountsWithStatus,
  getCurrencies,
  getCardGroups,
  getBanks,
  getAccountsAttention,
} from "@/lib/accounts/queries";
import { hasCardAccent } from "@/lib/accounts/card-art";
import { baseCurrencyOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/* The server actions this page invokes run under its segment config, and
   backfillCardArt can wait out DEFERRED_INFERENCE_BUDGET_MS (90s) on a cold
   or slow Gemini call. Must be a literal, so it is restated rather than derived. */
export const maxDuration = 120;

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .maybeSingle();
  const baseCurrency = baseCurrencyOf(profile);

  const [accounts, currencies, cardGroups, banks, attention] = await Promise.all([
    getAccountsWithStatus(),
    getCurrencies(),
    getCardGroups(),
    getBanks(),
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
