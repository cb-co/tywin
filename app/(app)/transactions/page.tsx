import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Transactions"
        description="Every expense, income, and transfer between your accounts."
      />
      <EmptyState
        icon={<ArrowLeftRight className="size-6" />}
        title="No transactions yet"
        description="Once you add an account, use Quick Add to log expenses, income, and payments. They'll appear here."
      />
    </div>
  );
}
