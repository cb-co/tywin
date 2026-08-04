/** Money and number formatting for the Tywin UI. */

/**
 * Locale to format each currency in. Defaults to "en-US", whose narrowSymbol
 * is what we want for nearly every currency. DOP is the exception: en-US's
 * narrowSymbol for it is just "$", indistinguishable from USD, so it's
 * formatted in es-DO instead, which renders the unambiguous "RD$".
 */
const CURRENCY_LOCALE: Record<string, string> = {
  DOP: "es-DO",
};

export function formatMoney(
  amount: number,
  currency: string,
  opts?: { compact?: boolean; signed?: boolean; maximumFractionDigits?: number },
): string {
  const value = new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    // es-DO has no narrowSymbol form that keeps "RD$"; "symbol" is required
    // there. Every other currency stays on narrowSymbol as before.
    currencyDisplay: currency in CURRENCY_LOCALE ? "symbol" : "narrowSymbol",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  }).format(amount);
  if (opts?.signed && amount > 0) return `+${value}`;
  return value;
}

export function formatPercent(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** Turn a day-of-month (1-31) into an ordinal label, e.g. "3rd". */
export function formatDayOfMonth(day: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = day % 100;
  return day + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * Formats a `yyyy-mm-dd` date string in the given locale. Always resolves in
 * UTC so a date-only value renders the same calendar day no matter the
 * viewer's local timezone (see components/accounts/balance-chart.tsx for the
 * same pattern applied ad hoc before this helper existed).
 */
export function formatDate(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
