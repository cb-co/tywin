import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { bearerToken } from "./bearer";
import type { Database } from "./types";

/**
 * The Supabase client for this request, authenticated as whoever made it.
 *
 * Two kinds of caller reach the same server code. The web app carries a cookie
 * session. The native app has no cookie jar and sends its access token as
 * `Authorization: Bearer`. Deciding here, once, means every server action and every
 * `lib/**\/queries.ts` serves both unchanged, and a `/api/v1` route is just a thin
 * wrapper around an existing action.
 *
 * The bearer client is still the user's own client. It sends the publishable key
 * plus the user's JWT, so RLS scopes every query exactly as it does for a
 * cookie session, and `auth.getUser()` checks the token with Supabase Auth
 * (supabase-js forwards a custom Authorization header on that call). It never
 * stores or refreshes the token: refreshing is the phone's job.
 */
export async function createClient(): Promise<ReturnType<typeof createServerClient<Database>>> {
  const token = bearerToken((await headers()).get("authorization"));
  if (token) {
    return createTokenClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    );
  }

  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; safe to ignore — middleware refreshes.
          }
        },
      },
    },
  );
}
