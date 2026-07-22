/** Statement money is held as integer cents: statements carry their own
 *  checksum and float drift would produce false validation failures. */
export function parseMoneyCents(raw: string): number {
  const cleaned = raw.trim().replace(/\.$/, "").replace(/,/g, "");
  const m = cleaned.match(/^(-?)(\d+)\.(\d{2})$/);
  if (!m) throw new Error(`unparseable amount: "${raw}"`);
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 100 + Number(m[3]));
}

export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
