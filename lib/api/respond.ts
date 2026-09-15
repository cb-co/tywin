import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in caller of a `/api/v1` route, whether the route was reached with a cookie (web)
 * or a bearer token (native). Null means "answer 401".
 *
 * Checked up front even though every action behind these routes checks again. An action
 * signals "not signed in" as translated prose inside a 200, and a phone needs a status
 * code it can act on (refresh the token, or send the person to sign-in).
 */
export async function apiUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** `code` is for the client to switch on, not prose. The app owns the wording. */
export function badRequest(code: string): Response {
  return Response.json({ error: code }, { status: 400 });
}
