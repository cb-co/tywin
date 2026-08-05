import { describe, it, expect } from "vitest";
import {
  relativeLuminance,
  contrastRatio,
  readableForeground,
  gradientFrom,
  toOklch,
  fromOklch,
  cardForeground,
  cardGradientStops,
} from "./color";

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

  // The far corner brightens. A darkening ramp gives a vignette; the reference
  // card art is lit, and that direction is the whole look.
  it("ends lighter than it starts, for every hue", () => {
    for (const accent of ["#1B4B8F", "#E8833A", "#C74BC0", "#0A0A0A", "#2E3B4A"]) {
      const far = gradientFrom(accent).match(/(#[0-9a-f]{6}) 100%/i)?.[1];
      expect(far, `${accent} far stop`).toBeDefined();
      expect(toOklch(far!).l, `${accent} lifts`).toBeGreaterThan(toOklch(accent).l);
    }
  });

  // A near-white accent cannot lift a full step without leaving the gamut. It
  // must still produce a real colour rather than NaN or a clipped hue shift.
  it("stays in gamut at the top of the lightness range", () => {
    const far = gradientFrom("#F2F4FF").match(/(#[0-9a-f]{6}) 100%/i)?.[1];
    expect(far).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("cardForeground", () => {
  // The bug this exists to stop: a mid-tone accent whose DARKEST corner favours
  // white, on a face that lightens by a full lift toward the bottom right —
  // exactly where the holder name and number sit. A silver Amex card shipped
  // white-on-silver this way.
  it("picks ink for a mid-tone accent that lightens under the text", () => {
    for (const silver of ["#9A9A9A", "#A8A8A8", "#B4B0A6"]) {
      expect(cardForeground(silver), silver).toBe("#14141c");
    }
  });

  it("still picks white on genuinely dark accents", () => {
    for (const dark of ["#1B4B8F", "#0A0A0A", "#2E3B4A", "#494B9A"]) {
      expect(cardForeground(dark), dark).toBe("#ffffff");
    }
  });

  // Whatever it picks must survive BOTH ends of the ramp, not just one.
  it("clears 3:1 against both gradient stops", () => {
    for (const accent of ["#1B4B8F", "#9A9A9A", "#E8C34A", "#0A0A0A", "#C74BC0"]) {
      const fg = cardForeground(accent);
      const { near, far } = cardGradientStops(accent);
      expect(contrastRatio(fg, near), `${accent} near`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(fg, far), `${accent} far`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("oklch round trip", () => {
  it("returns the colour it was given", () => {
    for (const hex of ["#1B4B8F", "#E8833A", "#ffffff", "#000000", "#7F7F7F"]) {
      expect(fromOklch(toOklch(hex)).toLowerCase()).toBe(hex.toLowerCase());
    }
  });
});
