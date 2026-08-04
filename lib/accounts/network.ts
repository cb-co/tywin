/**
 * Card identity, inferred.
 *
 * `card_groups` stores `brand` and `last4`; a standalone credit-card account
 * has neither column, so for those the network and last four digits are
 * inferred from the account name. Inference is deliberately conservative: a
 * wrong network mark on someone's card is worse than a generic one.
 */

export type CardNetwork =
  | "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay";

/**
 * Ordered because the first match wins. Each pattern is anchored on word
 * boundaries — "mc" in particular must not match inside "McDonald".
 */
const PATTERNS: ReadonlyArray<readonly [CardNetwork, RegExp]> = [
  ["visa", /\bvisa\b/],
  ["mastercard", /\b(?:mastercard|master\s+card|mc)\b/],
  ["amex", /\b(?:amex|american\s+express)\b/],
  ["discover", /\bdiscover\b/],
  ["diners", /\bdiners(?:\s+club)?\b/],
  ["jcb", /\bjcb\b/],
  ["unionpay", /\b(?:unionpay|union\s+pay)\b/],
];

function match(value: string | null | undefined): CardNetwork | null {
  const s = (value ?? "").toLowerCase().trim();
  if (!s) return null;
  for (const [network, pattern] of PATTERNS) {
    if (pattern.test(s)) return network;
  }
  return null;
}

export function inferNetwork(
  name: string | null,
  brand?: string | null,
): CardNetwork | null {
  const fromBrand = match(brand);
  if (fromBrand) return fromBrand;
  return match(name);
}

/** Four consecutive digits, not part of a longer run. */
const FOUR_DIGITS = /(?<!\d)(\d{4})(?!\d)/g;

export function inferLast4(
  name: string | null,
  last4?: string | null,
): string | null {
  if (last4 && /^\d{4}$/.test(last4)) return last4;
  if (!name) return null;
  for (const match of name.matchAll(FOUR_DIGITS)) {
    const value = match[1];
    const n = Number(value);
    // A plausible year is far more likely to be a vintage than a card number.
    if (n >= 1900 && n <= 2099) continue;
    return value;
  }
  return null;
}
