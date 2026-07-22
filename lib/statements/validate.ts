import type { ParsedStatement } from "./types";

export interface ChecksumFailure {
  sectionKey: string;
  computedCents: number;
  statedCents: number;
}

/** previous + Σ(all lines, payments included) must equal the closing balance.
 *  Line-less sections (e.g. Cuotas) fall back to the stated totals. */
export function validateChecksums(parsed: ParsedStatement): ChecksumFailure[] {
  const failures: ChecksumFailure[] = [];
  for (const s of parsed.sections) {
    const movement =
      s.lines.length > 0
        ? s.lines.reduce((sum, l) => sum + l.amountCents, 0)
        : s.totalDebitsCents - s.totalCreditsCents;
    const computed = s.previousBalanceCents + movement;
    if (computed !== s.closingBalanceCents) {
      failures.push({
        sectionKey: s.sectionKey,
        computedCents: computed,
        statedCents: s.closingBalanceCents,
      });
    }
  }
  return failures;
}
