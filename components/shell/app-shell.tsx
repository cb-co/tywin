import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { MobileHeader } from "./mobile-header";
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { SoundProvider } from "@/components/sound/sound-provider";
import { FigureMaskProvider } from "@/components/figure-mask/figure-mask-provider";
import { QuickAddButton } from "@/components/quick-add/quick-add-button";
import { QuickAddDialogLazy } from "@/components/quick-add/quick-add-dialog-lazy";
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
    <FigureMaskProvider>
      <SoundProvider>
        <QuickAddProvider>
          <Splash />
          <div className="flex min-h-dvh md:h-dvh md:overflow-hidden">
            <Sidebar
              email={user?.email ?? ""}
              displayName={profile?.display_name ?? null}
              avatarUrl={profileAvatarUrl(user?.user_metadata)}
            />
            {/* min-w-0: without it this flex item refuses to shrink below its
                content's intrinsic width — a single nowrap line (e.g. a long
                imported statement merchant name under `truncate`) propagates
                its full min-content width up here and the whole page scrolls
                horizontally on mobile. */}
            <div className="flex min-w-0 flex-1 flex-col md:h-dvh md:overflow-y-auto">
              <MobileHeader />
              {/* Bottom padding clears both floating elements above the
                  content. The nav pill floats `bottom-4` (16px) off the
                  screen edge with ~56px of its own content height, so its
                  top edge sits ~72px up. The FAB (now 60px, up from 56px)
                  keeps its `bottom-[5rem]` (80px) offset, so its top edge
                  sits at 80 + 60 = 140px — the taller of the two, and the
                  binding constraint. 9.5rem (152px) clears the FAB's 140px
                  with a 12px buffer; `env(safe-area-inset-bottom)` stays in
                  the calc so notched phones get the same buffer on top of
                  their inset. */}
              <main className="flex-1 p-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
                {children}
              </main>
            </div>
            <BottomNav />
            <QuickAddButton />
            <QuickAddDialogLazy data={quickAddData} />
          </div>
        </QuickAddProvider>
      </SoundProvider>
    </FigureMaskProvider>
  );
}
