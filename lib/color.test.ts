import { describe, it, expect } from "vitest";
import { relativeLuminance, contrastRatio, readableForeground, gradientFrom } from "./color";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("accepts hex with or without a leading hash, in any case", () => {
    expect(relativeLuminance("4361F0")).toBeCloseTo(relativeLuminance("#4361f0"), 10);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#4361F0", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#4361F0"), 10);
  });
});

describe("readableForeground", () => {
  // The whole point: a user can pick a pale card colour, and assuming white
  // would make the card face unreadable.
  it("picks dark ink on a pale fill", () => {
    expect(readableForeground("#FFE066")).toBe("#14141c");
  });

  it("picks white on a saturated brand fill", () => {
    expect(readableForeground("#4326C9")).toBe("#ffffff");
  });

  it("always returns the higher-contrast option", () => {
    for (const bg of ["#4361F0", "#FFE066", "#00A08A", "#8A8698", "#000000", "#ffffff"]) {
      const fg = readableForeground(bg);
      const other = fg === "#ffffff" ? "#14141c" : "#ffffff";
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
    }
  });
});

describe("gradientFrom", () => {
  // Two stacked layers, and the order is the whole point: CSS paints the first
  // background-image on TOP, so the highlight has to come first or the base
  // gradient covers it.
  it("puts the sheen above a linear base carrying the source colour", () => {
    const g = gradientFrom("#4361F0");
    expect(g).toMatch(/^radial-gradient\(/);
    expect(g).toContain("linear-gradient(135deg,");
    expect(g.indexOf("radial-gradient")).toBeLessThan(g.indexOf("linear-gradient"));
    expect(g.toLowerCase()).toContain("#4361f0");
  });

  // The highlight is measured against the fill, not assumed white — a white
  // sheen on a pale card is invisible.
  it("flips the sheen to a shadow on a pale fill", () => {
    expect(gradientFrom("#101018")).toContain("rgba(255, 255, 255,");
    expect(gradientFrom("#F4E9C8")).toContain("rgba(0, 0, 0,");
  });
});
