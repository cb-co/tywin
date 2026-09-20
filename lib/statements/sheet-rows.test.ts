import { describe, it, expect } from "vitest";
import { sheetRows } from "./sheet-rows";

const line = (lineNo: number, amountCents: number, madeOn = "2026-09-05") => ({
  lineNo, madeOn, postedOn: madeOn, reference: null, description: `LINE ${lineNo}`,
  mcc: null, authCode: null, amountCents, kind: amountCents < 0 ? "credit" : "purchase", suggestedCategory: null,
});
const stmt = JSON.stringify({
  parserId: "p", cardLast4: "4417",
  sections: [
    { sectionKey: "DOP", currency: "DOP", lines: [line(1, 438210), line(2, -5000, "2026-09-06"), line(3, 100), line(4, 200)] },
    { sectionKey: "USD", currency: "USD", lines: [line(9, 1549)] },
  ],
});

describe("sheetRows", () => {
  it("returns the section's real lines, newest data untouched, limited", () => {
    const { rows, more } = sheetRows(stmt, "DOP", 2);
    expect(rows).toHaveLength(2);
    expect(more).toBe(2);
    expect(rows[0]).toEqual({ key: "DOP-1", date: "05/09", text: "LINE 1", amount: 4382.1, credit: false });
  });

  it("marks a negative line as a credit with a positive magnitude", () => {
    const { rows } = sheetRows(stmt, "DOP", 8);
    expect(rows[1]).toMatchObject({ amount: 50, credit: true, date: "06/09" });
    expect(sheetRows(stmt, "DOP", 8).more).toBe(0);
  });

  it("only reads the requested section", () => {
    expect(sheetRows(stmt, "USD", 8).rows.map((r) => r.key)).toEqual(["USD-9"]);
  });

  it("degrades to nothing for null, malformed or unknown input", () => {
    expect(sheetRows(null, "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows("{nope", "DOP", 8)).toEqual({ rows: [], more: 0 });
    expect(sheetRows(stmt, "EUR", 8)).toEqual({ rows: [], more: 0 });
  });
});
