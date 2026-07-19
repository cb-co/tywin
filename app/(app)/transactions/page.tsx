import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Ledger } from "@/components/transactions/ledger";
import { getTransactions, getQuickAddData } from "@/lib/transactions/queries";

export default async function TransactionsPage() {
  const [transactions, data] = await Promise.all([getTransactions(), getQuickAddData()]);
  const t = await getTranslations("Transactions");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <Ledger transactions={transactions} data={data} />
    </div>
  );
}
