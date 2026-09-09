import { describe, it, expect } from "vitest";
import { newestPendingImport, budgetLabelParts, type PendingTriageImportRow } from "./queries";

describe("budgetLabelParts", () => {
  it("shows one figure for a whole calendar month — today's page, unchanged", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-30" }, 5000, 5000),
    ).toEqual({ monthly: 5000, prorated: null });
  });

  it("shows both figures for a quincena", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 5000, 2500),
    ).toEqual({ monthly: 5000, prorated: 2500 });
  });

  it("shows one figure when nothing is budgeted, rather than 0 of 0", () => {
    expect(
      budgetLabelParts({ start: "2026-09-01", end: "2026-09-15" }, 0, 0),
    ).toEqual({ monthly: 0, prorated: null });
  });
});

function row(imp: { id: string; created_at: string } | null): PendingTriageImportRow {
  return { statement_line: { statement: { import: imp } } };
}

describe("newestPendingImport", () => {
  it("returns null for an empty input", () => {
    expect(newestPendingImport([])).toBeNull();
  });

  it("picks the import with the latest created_at among several", () => {
    const rows = [
      row({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      row({ id: "newest", created_at: "2026-08-01T00:00:00Z" }),
      row({ id: "middle", created_at: "2026-05-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("newest");
  });

  it("skips a row whose embedded chain is missing the import, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: { statement: { import: null } } },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("skips a row whose embedded chain is missing the statement, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: { statement: null } },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("skips a row whose embedded chain is missing the statement line, rather than throwing", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: null },
      row({ id: "the-one", created_at: "2026-03-01T00:00:00Z" }),
    ];
    expect(newestPendingImport(rows)).toBe("the-one");
  });

  it("returns null when every row's chain is incomplete", () => {
    const rows: PendingTriageImportRow[] = [
      { statement_line: null },
      { statement_line: { statement: null } },
      { statement_line: { statement: { import: null } } },
    ];
    expect(newestPendingImport(rows)).toBeNull();
  });
});
