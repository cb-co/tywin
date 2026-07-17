import { PieChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function BudgetsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Budgets"
        description="A monthly budget per category, with what's used and what's left."
        actions={<Button>New category</Button>}
      />
      <EmptyState
        icon={<PieChart className="size-6" />}
        title="No categories yet"
        description="Create categories like Groceries or Fuel, set a monthly budget, and track spending against it."
        action={<Button>Create a category</Button>}
      />
    </div>
  );
}
