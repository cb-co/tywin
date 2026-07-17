import { LineChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Insights"
        description="Where your money goes: distribution, budget pace, and cash flow."
      />
      <EmptyState
        icon={<LineChart className="size-6" />}
        title="Nothing to chart yet"
        description="Log a few transactions and your spending distribution, budget progress, and trends will appear here."
      />
    </div>
  );
}
