import { createClient } from "@/lib/supabase/server";
import { simpleIconSlug } from "@/lib/brand/logo-uri";
import { brandIcon } from "@/lib/brand/simple-icon";

/**
 * Subscriptions, each carrying its brand mark already resolved.
 *
 * `logo_url` stores a `simple-icons:` URI, and turning that into artwork means
 * touching the whole 3,450-icon set — server-only, megabytes (see
 * lib/brand/simple-icon). Resolving it HERE, where the query already runs on the
 * server, is what keeps that cost off the wire: the list is a client component,
 * and it receives a few hundred bytes of path per subscription rather than a
 * package.
 *
 * A row whose URI names no icon we ship gets `logoPath: null` and falls back to
 * its initial, exactly like a row with no logo at all.
 */
export async function getSubscriptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "*, account:accounts!subscriptions_account_id_fkey(id,name,currency), category:categories!subscriptions_category_id_fkey(id,name,emoji,color)",
    )
    .order("is_active", { ascending: false })
    .order("name");

  return (data ?? []).map((row) => ({
    ...row,
    logoPath: brandIcon(simpleIconSlug(row.logo_url))?.path ?? null,
  }));
}

export type SubscriptionWithRefs = Awaited<ReturnType<typeof getSubscriptions>>[number];
