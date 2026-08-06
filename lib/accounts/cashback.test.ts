import { describe, expect, it } from "vitest";
import { hasReportedCashback, yearCashback, type CashbackStatement } from "./cashback";

function stmt(period_end: string, cashback_total: number | null): CashbackStatement {
  return { period_end, cashback_total };
}

/** A row from a database where the migration hasn't been applied yet: the key
 *  is absent entirely, not null. */
const preMigration = (period_end: string) => ({ period_end }) as CashbackStatement;

describe("yearCashback", () => {
  it("sums the statements closing in the year", () => {
    const statements = [
      stmt("2026-01-25", 328),
      stmt("2026-02-25", 412.5),
      stmt("2026-03-25", 100),
    ];
    expect(yearCashback(statements, 2026)).toBe(840.5);
  });

  it("ignores statements that closed in another year", () => {
    const statements = [stmt("2025-12-25", 900), stmt("2026-01-25", 328)];
    expect(yearCashback(statements, 2026)).toBe(328);
  });

  it("counts a period straddling New Year once, in its closing year", () => {
    // Period runs 2025-12-26 → 2026-01-25; it closes in 2026 and belongs there
    // whole, matching the year the balance anchor is keyed by.
    expect(yearCashback([stmt("2026-01-25", 328)], 2026)).toBe(328);
    expect(yearCashback([stmt("2026-01-25", 328)], 2025)).toBe(0);
  });

  it("treats an unreported figure as no contribution", () => {
    const statements = [stmt("2026-01-25", null), stmt("2026-02-25", 328)];
    expect(yearCashback(statements, 2026)).toBe(328);
  });

  it("is zero when nothing was imported", () => {
    expect(yearCashback([], 2026)).toBe(0);
  });

  it("ignores rows from a database without the column yet", () => {
    expect(yearCashback([preMigration("2026-01-25")], 2026)).toBe(0);
  });

  /* Re-importing a statement cannot double-count, because the row is replaced
   * rather than appended — the unique index on (account_id, period_end) plus
   * the RPC's delete-then-insert. At this layer that shows up as: two rows can
   * never share a closing date, and a corrected figure simply supersedes. */
  it("reflects a corrected re-import rather than adding to it", () => {
    const beforeReimport = [stmt("2026-01-25", 328)];
    const afterReimport = [stmt("2026-01-25", 350)];
    expect(yearCashback(beforeReimport, 2026)).toBe(328);
    expect(yearCashback(afterReimport, 2026)).toBe(350);
  });
});

describe("hasReportedCashback", () => {
  it("is true when a statement in the year reported a figure", () => {
    expect(hasReportedCashback([stmt("2026-01-25", 328)], 2026)).toBe(true);
  });

  it("is true for an explicitly reported zero", () => {
    expect(hasReportedCashback([stmt("2026-01-25", 0)], 2026)).toBe(true);
  });

  it("is false when every statement predates the field", () => {
    expect(hasReportedCashback([stmt("2026-01-25", null)], 2026)).toBe(false);
  });

  it("is false when the only reported figures are from another year", () => {
    expect(hasReportedCashback([stmt("2025-12-25", 900)], 2026)).toBe(false);
  });

  it("is false when the column does not exist yet, so no zero is claimed", () => {
    // The app can ship before the migration is applied; `select("*")` then
    // returns rows with the key absent. Rendering "0.00 earned" off that would
    // be asserting a figure the database has no column for.
    expect(hasReportedCashback([preMigration("2026-01-25")], 2026)).toBe(false);
  });
});
