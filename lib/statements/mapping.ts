export interface CardAccountOption {
  id: string;
  name: string;
  currency: string;
  credit_limit: number | null;
}

/** Heuristic pre-fill only — the user confirms in the mapping dialog.
 *  Never trusted to route money silently (spec §2.2). */
export function suggestAccountId(
  section: { currency: string; creditLimitCents: number | null },
  options: CardAccountOption[],
): string | null {
  const sameCurrency = options.filter((o) => o.currency === section.currency);
  if (sameCurrency.length === 0) return null;
  if (sameCurrency.length === 1) return sameCurrency[0].id;
  if (section.creditLimitCents === null) return null;
  const target = section.creditLimitCents / 100;
  return sameCurrency
    .slice()
    .sort(
      (a, b) =>
        Math.abs((a.credit_limit ?? Infinity) - target) -
        Math.abs((b.credit_limit ?? Infinity) - target),
    )[0].id;
}
