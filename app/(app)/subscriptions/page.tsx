import { PageHeader } from "@/components/page-header";
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view";
import { getSubscriptions } from "@/lib/subscriptions/queries";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function SubscriptionsPage() {
  const [subscriptions, data] = await Promise.all([getSubscriptions(), getQuickAddData()]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Subscriptions"
        description="Recurring charges, their next dates, and your monthly total."
      />
      <SubscriptionsView subscriptions={subscriptions} data={data} />
    </div>
  );
}
