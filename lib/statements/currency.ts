/**
 * `ParsedSection.currency` is declared ISO 4217 and every consumer relies on it:
 * the import preview formats money with it through `Intl.NumberFormat` (which
 * throws RangeError on an ill-formed code), confirm refuses a section whose
 * currency doesn't equal the target account's, and fx looks up a rate by it.
 *
 * The LLM extractor is the one producer that can violate that. A statement
 * prints its currency as a symbol — a Dominican one carries "RD$" on every line
 * and never the token "DOP" — so a model told to transcribe faithfully will hand
 * back the symbol. Normalize here, at the boundary, so the invariant the type
 * claims is one something actually enforces.
 */

/** Printed symbols that name exactly one currency in this extractor's corpus
 *  (Latin American / Caribbean statements). A symbol that could denote more
 *  than one currency deliberately has no entry — see `normalizeCurrency`. */
const SYMBOL_TO_ISO: Record<string, string> = {
  RD$: "DOP",
  US$: "USD",
  "€": "EUR",
};

/**
 * Resolve a currency as the model wrote it into an ISO 4217 code.
 *
 * Throws rather than guessing, and throws rather than passing an unknown value
 * through. A statement's currency anchors the balances imported under it, so
 * getting it wrong is worse than not importing: the caller
 * (`extractAndParse`) records the failure and tells the user the parse failed,
 * exactly as it does for an unparseable amount.
 *
 * A bare "$" is the case worth naming — on a Dominican statement it is as
 * likely DOP as USD, and the two sections sit side by side on the same page.
 */
export function normalizeCurrency(raw: string): string {
  // Whitespace, not just at the ends: PDF text layers put spaces and non-breaking
  // spaces inside a printed symbol ("RD $"), and the model transcribes them.
  const cleaned = raw.replace(/\s/g, "").toUpperCase();
  const mapped = SYMBOL_TO_ISO[cleaned];
  if (mapped) return mapped;
  // A code the statement decorated with its symbol ("USD$", "DOP$"). Unambiguous:
  // the three letters already name the currency, the "$" only repeats it.
  const decorated = cleaned.match(/^([A-Z]{3})\$$/);
  if (decorated) return decorated[1];
  // Any well-formed three-letter code is accepted: Intl accepts unknown ones,
  // and an allowlist here would reject a currency the app legitimately supports.
  if (/^[A-Z]{3}$/.test(cleaned)) return cleaned;
  throw new Error(`unrecognized currency: "${raw}"`);
}

/**
 * The statement's `sectionKey` is "<CURRENCY>" or "<CURRENCY>_CUOTAS", and it is
 * persisted in `statement_section_mappings` so a future import of the same card
 * maps itself. A model that put the symbol in `currency` put it here too, and a
 * key built on the symbol misses every saved mapping the next time the model
 * writes the ISO code instead — so rewrite the prefix the raw currency leaked
 * into. Keys that don't start with it are already stable and left untouched.
 */
export function normalizeSectionKey(sectionKey: string, rawCurrency: string, iso: string): string {
  const raw = rawCurrency.trim().toUpperCase();
  const key = sectionKey.trim().toUpperCase();
  if (raw === iso || !key.startsWith(raw)) return sectionKey;
  return `${iso}${key.slice(raw.length)}`;
}
