import { describe, it, expect } from "vitest";
import { fitFigureClass } from "./fit";

describe("fitFigureClass", () => {
  it("steps the size down as the figure grows and never returns nothing", () => {
    const sizes = ["RD$ 0.00", "RD$ 12,480.00", "RD$ 1,234,567.89", "RD$ 12,345,678.90"].map(fitFigureClass);
    expect(new Set(sizes).size).toBe(4);
    for (const s of sizes) expect(s).toMatch(/text-/);
  });
  it("gives the same class to figures of the same length", () => {
    expect(fitFigureClass("RD$ 1,000.00")).toBe(fitFigureClass("RD$ 9,999.99"));
  });
});
