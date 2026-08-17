import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Ledger } from "@/components/transactions/ledger";
import { getTransactions, getQuickAddData } from "@/lib/transactions/queries";

export default async function TransactionsPage() {
  // First page only — the rest is paged in from the client as the user
  // scrolls or changes a filter (see components/transactions/ledger).
  const [page, data] = await Promise.all([getTransactions(), getQuickAddData()]);
  const t = await getTranslations("Transactions");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <Ledger initialPage={page} data={data} />
    </div>
  );
}
