import { describe, it, expect } from "vitest";
import { perforationCells } from "./perforation";

describe("perforationCells", () => {
  it("marks the first `paid` cells as punched", () => {
    const { cells, hidden } = perforationCells(6, 2);
    expect(cells.map((c) => c.paid)).toEqual([true, true, false, false, false, false]);
    expect(hidden).toBe(0);
  });
  it("clamps paid into 0..total", () => {
    expect(perforationCells(3, 9).cells.every((c) => c.paid)).toBe(true);
    expect(perforationCells(3, -1).cells.some((c) => c.paid)).toBe(false);
  });
  it("caps the drawn cells and reports the rest", () => {
    const { cells, hidden } = perforationCells(48, 10, 24);
    expect(cells).toHaveLength(24);
    expect(hidden).toBe(24);
  });
  it("returns nothing for a zero or invalid total", () => {
    expect(perforationCells(0, 0).cells).toEqual([]);
    expect(perforationCells(Number.NaN, 1).cells).toEqual([]);
  });
});
