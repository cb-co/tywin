import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view";
import { getSubscriptions } from "@/lib/subscriptions/queries";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function SubscriptionsPage() {
  const [subscriptions, data] = await Promise.all([getSubscriptions(), getQuickAddData()]);
  const t = await getTranslations("Subscriptions");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <SubscriptionsView subscriptions={subscriptions} data={data} />
    </div>
  );
}
