/** Money and number formatting for the Tywin UI. */

export function formatMoney(
  amount: number,
  currency: string,
  opts?: { compact?: boolean; signed?: boolean },
): string {
  const value = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: 2,
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
