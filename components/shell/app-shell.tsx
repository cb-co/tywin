import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { QuickAddButton } from "@/components/quick-add/quick-add-button";
import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog";
import { Splash } from "./splash";
import { getQuickAddData } from "@/lib/transactions/queries";
import { profileAvatarUrl } from "@/lib/profile";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [quickAddData, { data: profile }] = await Promise.all([
    getQuickAddData(),
    supabase.from("profiles").select("display_name").maybeSingle(),
  ]);

  return (
    <QuickAddProvider>
      <Splash />
      <div className="flex min-h-dvh">
        <Sidebar
          email={user?.email ?? ""}
          displayName={profile?.display_name ?? null}
          avatarUrl={profileAvatarUrl(user?.user_metadata)}
        />
        <div className="flex flex-1 flex-col">
          <MobileHeader />
          {/* Bottom padding clears the bar (~56px) *and* the FAB above it,
              which tops out at 136px. pb-24 only reserved 96px, so the last
              rows of a list scrolled under the button. */}
          <main className="flex-1 p-4 pb-[calc(9rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
            {children}
          </main>
        </div>
        <BottomNav />
        <QuickAddButton />
        <QuickAddDialog data={quickAddData} />
      </div>
    </QuickAddProvider>
  );
}
