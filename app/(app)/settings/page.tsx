import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Settings"
        description="Your base currency, categories, and default fees."
      />
      <EmptyState
        icon={<SettingsIcon className="size-6" />}
        title="Settings arrive with your data"
        description="Base currency, category management, and default tax/fee settings will live here as the app fills in."
      />
    </div>
  );
}
