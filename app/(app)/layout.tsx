import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* "/" is the only public path inside this group (it's the marketing home
     page for signed-out visitors). Every other route here is gated by the
     proxy, so reaching this layout without a user only happens on "/" —
     render it standalone, without the authenticated app chrome. */
  if (!user) return <>{children}</>;

  /* Onboarding gate. It lives here rather than in the proxy so it costs one
     indexed lookup on the authenticated tree instead of a second round trip
     on every matched request. `/welcome` sits outside this group, so there
     is no redirect loop. */
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .maybeSingle();

  if (profile && !profile.onboarded_at) redirect("/welcome");

  return <AppShell>{children}</AppShell>;
}
