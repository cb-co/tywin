import { describe, it, expect } from "vitest";
import { shareRows } from "./share";

const d = (name: string, value: number) => ({ name, value, color: "#123456" });

describe("shareRows", () => {
  it("returns each row with its share of the total", () => {
    const rows = shareRows([d("a", 75), d("b", 25)], 100);
    expect(rows.map((r) => r.pct)).toEqual([75, 25]);
    expect(rows.every((r) => !r.rest)).toBe(true);
  });
  it("rolls everything past `max` into one rest row so the rows still sum to the total", () => {
    const rows = shareRows([d("a", 50), d("b", 30), d("c", 15), d("d", 5)], 100, 2);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ rest: true, value: 20, pct: 20 });
  });
  it("gives a zero total zero shares, never NaN", () => {
    expect(shareRows([d("a", 0)], 0)[0].pct).toBe(0);
  });
});
