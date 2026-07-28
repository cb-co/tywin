import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

/* `.well-known` is excluded because the Android TWA's Digital Asset Links
 * check fetches /.well-known/assetlinks.json unauthenticated and refuses to
 * follow redirects — routing it through the auth proxy answers with a 307 to
 * /login, verification fails, and the app launches with the address bar. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
