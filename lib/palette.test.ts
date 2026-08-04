import { describe, it, expect } from "vitest";
import { SWATCHES } from "./palette";

const lin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a: number, b: number) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = luminance("#ffffff");
const CARD_DARK = luminance("#16161f");

describe("SWATCHES", () => {
  it("has sixteen unique values", () => {
    expect(SWATCHES).toHaveLength(16);
    expect(new Set(SWATCHES.map((s) => s.toLowerCase())).size).toBe(16);
  });

  it("is all valid six-digit hex", () => {
    for (const s of SWATCHES) expect(s).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  // Each swatch is a tile fill behind a white glyph, and a chip foreground on
  // both card surfaces. 3:1 covers glyphs, icons and large text.
  it("clears 3:1 against white for use as a tile fill", () => {
    for (const s of SWATCHES) {
      expect(ratio(luminance(s), WHITE), `${s} vs white`).toBeGreaterThanOrEqual(3);
    }
  });

  it("clears 3:1 against the dark card for use as a chip foreground", () => {
    for (const s of SWATCHES) {
      expect(ratio(luminance(s), CARD_DARK), `${s} vs dark card`).toBeGreaterThanOrEqual(3);
    }
  });
});
