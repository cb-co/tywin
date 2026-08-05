/**
 * The fallback card accent: a deep, unsaturated finance blue.
 *
 * This is what a card face uses when no accent has been resolved for it — a
 * brand-new card whose inference has not run yet, one whose name the model
 * could not place, or one created before card art existed at all. It has to
 * look deliberate rather than like a missing value, because for some cards it
 * is the permanent answer.
 *
 * Deliberately NOT the brand violet. The violet is the app's own colour; a card
 * is the issuer's object, and defaulting it to the product's brand made every
 * unresolved card look like Cashly merchandise.
 */
export const DEFAULT_CARD_ACCENT = "#1B4B8F";

/** A 6-digit hex — the only shape the card-face colour maths parses correctly. */
export const HEX6 = /^#[0-9a-f]{6}$/i;

/** True when a stored accent is present and usable as-is. */
export function hasCardAccent(color: string | null | undefined): boolean {
  return !!color && HEX6.test(color);
}
