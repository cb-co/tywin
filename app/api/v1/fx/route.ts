import { apiUser, unauthorized } from "@/lib/api/respond";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/fx";
import { baseCurrencyOf } from "@/lib/profile";

/**
 * Live rates into the caller's base currency, for the balances the phone converts itself
 * (net worth, card totals). Served from here and not fetched from the FX provider by the
 * phone, so every client shares lib/fx.ts's 12-hour cache and its "never cache an empty
 * table" rule.
 *
 * Authenticated even though rates are public, so this cannot become a free open proxy.
 */
export async function GET() {
  if (!(await apiUser())) return unauthorized();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("base_currency").maybeSingle();
  const base = baseCurrencyOf(profile);
  return Response.json({ base, rates: await getExchangeRates(base) });
}
