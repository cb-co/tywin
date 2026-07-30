/**
 * Masks a formatted money string by swapping each digit for a bullet, e.g.
 * "$1,234.56" -> "$•,•••.••". Keeps the currency symbol, grouping
 * separators, sign, and decimal point in place so the result still reads as
 * a number of roughly the right size, rather than a fixed-width password
 * stand-in like "****".
 */
export function maskFigure(formatted: string): string {
  return formatted.replace(/\d/g, "•");
}
