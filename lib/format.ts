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

export type MoneyOpts = {
  compact?: boolean;
  signed?: boolean;
  maximumFractionDigits?: number;
};

/**
 * The one place currency formatting is configured. `splitMoney` needs the same
 * configuration to locate the fraction digits, and a second copy would drift.
 */
export function moneyFormatter(currency: string, opts?: MoneyOpts): Intl.NumberFormat {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    // es-DO has no narrowSymbol form that keeps "RD$"; "symbol" is required
    // there. Every other currency stays on narrowSymbol as before.
    currencyDisplay: currency in CURRENCY_LOCALE ? "symbol" : "narrowSymbol",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}

export function formatMoney(amount: number, currency: string, opts?: MoneyOpts): string {
  const value = moneyFormatter(currency, opts).format(amount);
  if (opts?.signed && amount > 0) return `+${value}`;
  return value;
}

/**
 * How a currency is named wherever it appears on its own, without an amount —
 * "Credit card · RD$", a picker option, the tag beside an amount input.
 *
 * Taken from the formatter, so a label can never disagree with the symbol the
 * figures print. That only holds for the currencies CURRENCY_LOCALE formats
 * with an unambiguous symbol; every other one keeps its ISO code, because the
 * en-US narrowSymbol would be a bare "$" that could be any dollar or the peso.
 */
export function currencyLabel(currency: string): string {
  if (!(currency in CURRENCY_LOCALE)) return currency;
  const part = moneyFormatter(currency).formatToParts(0).find((p) => p.type === "currency");
  return part?.value ?? currency;
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
