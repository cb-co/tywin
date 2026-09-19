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
              {/* Bottom padding clears both fixed elements above the content.
                  The nav band sits on the screen edge: its content is a fixed
                  ~56px tall and the safe-area inset is interior padding, so
                  its top edge sits at 56px + inset. The FAB (60px) keeps its
                  5rem (80px) bottom offset, so its top edge sits at
                  80 + 60 = 140px, still the taller of the two and the binding
                  constraint regardless of the inset. 9.5rem (152px) clears
                  the FAB's 140px with a 12px buffer; the safe-area inset
                  stays in this calc too, so notched phones get the same
                  buffer on top of their inset.

                  From md up the nav pill and the FAB are gone, so nothing has
                  to be cleared — but 24px left the last card sitting on the
                  window edge, which reads as content cut off rather than
                  content ended. It steps up to 48px at md and 64px at lg,
                  and keeps the safe-area inset in the calc for tablets in
                  landscape, where the home indicator eats the bottom edge on
                  a layout with no nav pill to absorb it.

                  Note for future edits: don't spell out either offset's
                  Tailwind arbitrary-value syntax verbatim in this comment —
                  Tailwind's content scanner matches class-like tokens
                  anywhere in the file text, including comments, and will
                  emit a dead CSS rule for whatever you write. Describe the
                  values in prose instead. */}
              <main className="flex-1 p-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(3rem+env(safe-area-inset-bottom))] lg:pb-[calc(4rem+env(safe-area-inset-bottom))]">
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
