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

const FX_ENDPOINT = "https://open.er-api.com/v6/latest";

/** Quote currency code -> units of that currency per 1 unit of `base`. */
export async function getExchangeRates(base: string): Promise<Record<string, number>> {
  try {
    // Daily is plenty for balances/imports that aren't time-sensitive to the
    // rate; no reason to burn a network call every hour.
    const res = await fetch(`${FX_ENDPOINT}/${base}`, { next: { revalidate: 43200 } });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.result !== "success" || !data.rates) return {};
    return data.rates as Record<string, number>;
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
