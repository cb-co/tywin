import { Repeat } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function SubscriptionsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Subscriptions"
        description="Recurring charges and their next payment dates."
        actions={<Button>Add subscription</Button>}
      />
      <EmptyState
        icon={<Repeat className="size-6" />}
        title="No subscriptions yet"
        description="Add recurring services to see your monthly total and never be surprised by a charge."
        action={<Button>Add a subscription</Button>}
      />
    </div>
  );
}
