/**
 * Live exchange rates for converting point-in-time balances (net worth, upcoming
 * subscription totals) into the user's base currency. Transactions are deliberately
 * excluded from this — they lock in the rate at the time they occurred
 * (see `transactions.exchange_rate` / `base_amount`) and must not be re-converted here.
 *
 * Uses open.er-api.com (free, no API key, no rate limit) rather than frankfurter.dev —
 * frankfurter only covers the ~30 currencies in the ECB reference rates and is missing
 * DOP, which this app seeds by default.
 */

import { unstable_cache } from "next/cache";

const FX_ENDPOINT = "https://open.er-api.com/v6/latest";

/** How long a fetched rate table is reused. Rates move slowly enough that
 *  twice a day is plenty for balances and totals, and every caller shares the
 *  same entry, so this is the app's whole FX request budget. */
const TTL_SECONDS = 43200; // 12 hours

/**
 * Cached across requests by `unstable_cache`, not by `fetch`'s own
 * `next: { revalidate }`.
 *
 * The Data Cache that fetch option relies on is documented for Server
 * Components; whether it also applies inside a Server Action is not, and half
 * the callers here ARE Server Actions (createTransaction, addCharge, statement
 * import). `unstable_cache` caches on its own terms regardless of where it is
 * called from, so one entry per base currency per TTL is a guarantee rather
 * than an inference.
 *
 * It throws instead of returning {} on failure, and that is the point: whatever
 * this returns gets stored for the full TTL, so a cached {} would silently
 * convert every foreign amount at 1:1 for twelve hours. A rejection is not
 * cached, so a failed request is simply retried on the next call.
 */
const fetchRates = unstable_cache(
  async (base: string): Promise<Record<string, number>> => {
    const res = await fetch(`${FX_ENDPOINT}/${base}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`FX request failed: ${res.status}`);
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("FX response malformed");
    // The API already echoes the base back at 1.0; asserting it makes that an
    // invariant callers (crossRate) can rely on instead of a happy accident.
    return { ...(data.rates as Record<string, number>), [base]: 1 };
  },
  ["fx-rates"],
  { revalidate: TTL_SECONDS },
);

/** Quote currency code -> units of that currency per 1 unit of `base`.
 *  Empty when the rate table is unavailable; every consumer treats a missing
 *  rate as 1:1 rather than dropping the amount. */
export async function getExchangeRates(base: string): Promise<Record<string, number>> {
  try {
    return await fetchRates(base);
  } catch {
    return {};
  }
}

/**
 * Convert `amount` from `currency` into `base` using `rates` (as returned by
 * getExchangeRates(base)). Falls back to 1:1 if a rate is missing (e.g. the FX
 * request failed) rather than dropping the amount from the total.
 */
export function convertToBase(
  amount: number,
  currency: string,
  base: string,
  rates: Record<string, number>,
): number {
  if (currency === base) return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
}

/**
 * Base-currency units per 1 unit of `currency` — the direction the DB stores
 * `transactions.exchange_rate` / `card_statements.exchange_rate` in.
 *
 * Falls back to 1 when the rate is missing (failed FX request), matching
 * convertToBase: a total that's off is better than a row that won't save.
 */
export function baseRate(currency: string, base: string, rates: Record<string, number>): number {
  if (currency === base) return 1;
  const rate = rates[currency];
  return rate ? 1 / rate : 1;
}

/**
 * Units of `to` per 1 unit of `from`, derived from two base-relative rates.
 * Null when either leg is unknown — callers show a market-rate hint, and a
 * wrong hint is worse than none.
 */
export function crossRate(
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  if (from === to) return 1;
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) return null;
  return t / f;
}
