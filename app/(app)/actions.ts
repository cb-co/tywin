"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { collectSnapshot } from "@/lib/overview/recommendation/collect";
import { inferRecommendation } from "@/lib/overview/recommendation/llm";
import { isStale } from "@/lib/overview/recommendation/freshness";

/**
 * Regenerates the overview's recommendation, if it still needs regenerating.
 *
 * Called from the card on mount, never awaited by anything the user is waiting
 * on — see the `void` at the call site, which is load-bearing for the same
 * reason it is in `subscription-form-dialog.tsx`.
 *
 * Every failure is silent and returns `{ refreshed: false }`. Nothing here is
 * worth surfacing: the page has already rendered everything the person came
 * for, and a missing recommendation is a missing nicety the next visit retries.
 */
export async function refreshRecommendation(): Promise<{ refreshed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { refreshed: false };

  const locale = await getLocale();

  /* Re-read before spending a call. Two tabs opened together both mount the
     card and both see the same stale row; the second one arrives here after the
     first has written, and the cheapest place to notice is before the inference
     rather than after it. This is not a lock, and does not need to be — the
     worst case it fails to prevent is one wasted call. */
  const { data: existing } = await supabase
    .from("daily_recommendations")
    .select("locale,generated_at")
    .maybeSingle();
  if (existing && !isStale(existing.generated_at, existing.locale, locale)) {
    return { refreshed: false };
  }

  const snapshot = await collectSnapshot();
  if (!snapshot) return { refreshed: false };

  const rec = await inferRecommendation(snapshot, locale);
  if (!rec) return { refreshed: false };

  const { error } = await supabase.from("daily_recommendations").upsert(
    {
      user_id: user.id,
      headline: rec.headline,
      body: rec.body,
      tone: rec.tone,
      locale,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { refreshed: false };

  revalidatePath("/");
  return { refreshed: true };
}
