import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { QuickAddButton } from "@/components/quick-add/quick-add-button";
import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog";
import { getQuickAddData } from "@/lib/transactions/queries";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const quickAddData = await getQuickAddData();

  return (
    <QuickAddProvider>
      <div className="flex min-h-dvh">
        <Sidebar email={user?.email ?? ""} />
        <div className="flex flex-1 flex-col">
          <MobileHeader />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        </div>
        <BottomNav />
        <QuickAddButton />
        <QuickAddDialog data={quickAddData} />
      </div>
    </QuickAddProvider>
  );
}
