import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AccountsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Accounts"
        description="Bank accounts, credit cards, loans, and assets."
        actions={<Button>Add account</Button>}
      />
      <EmptyState
        icon={<Wallet className="size-6" />}
        title="No accounts yet"
        description="Add your first account to start tracking balances, credit-card utilization, and loan payoff."
        action={<Button>Add your first account</Button>}
      />
    </div>
  );
}
