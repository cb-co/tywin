import { readFileSync } from "node:fs";
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

/**
 * The categorical chart series lives in CSS custom properties, so it cannot be
 * imported. It is parsed straight out of the shipped stylesheet instead —
 * duplicating the sixteen hex strings into this file would assert something
 * about the test rather than about what renders, and would keep passing after
 * someone edits the real values.
 *
 * The URL is resolved from this module, not from the working directory, so the
 * suite does not depend on where vitest is invoked from.
 */
const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// The two theme blocks are top level and in source order. `--color-chart-*` in
// the `@theme inline` block above them holds `var(...)` rather than hex, so it
// cannot be picked up by mistake.
const rootAt = CSS.indexOf("\n:root {");
const darkAt = CSS.indexOf("\n.dark {");

// Each block ends at the first closing brace in column 1. Both blocks are flat
// lists of declarations, so nothing nested can close them early.
const block = (start: number) => CSS.slice(start, CSS.indexOf("\n}", start));
const LIGHT_BLOCK = block(rootAt);
const DARK_BLOCK = block(darkAt);

const series = (block: string) => {
  const found = new Map<number, string>();
  for (const m of block.matchAll(/--chart-([1-8]):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    found.set(Number(m[1]), m[2]);
  }
  return [...found.entries()].sort(([a], [b]) => a - b).map(([, hex]) => hex);
};

const LIGHT_SERIES = series(LIGHT_BLOCK);
const DARK_SERIES = series(DARK_BLOCK);

describe("chart series", () => {
  // Without this, a parse that silently found nothing would make every
  // assertion below vacuously true.
  it("was actually parsed out of app/globals.css", () => {
    expect(rootAt, ":root block").toBeGreaterThan(-1);
    expect(darkAt, ".dark block after :root").toBeGreaterThan(rootAt);
    expect(LIGHT_SERIES, "light --chart-1..8").toHaveLength(8);
    expect(DARK_SERIES, "dark --chart-1..8").toHaveLength(8);
  });

  it("is eight distinct hues per theme", () => {
    expect(new Set(LIGHT_SERIES.map((c) => c.toLowerCase())).size).toBe(8);
    expect(new Set(DARK_SERIES.map((c) => c.toLowerCase())).size).toBe(8);
  });

  // Chart marks are large elements, so 3:1 is the contract — the same one the
  // swatches above are held to.
  it("clears 3:1 against the light surface", () => {
    for (const c of LIGHT_SERIES) {
      expect(ratio(luminance(c), WHITE), `${c} vs white`).toBeGreaterThanOrEqual(3);
    }
  });

  it("clears 3:1 against the dark surface", () => {
    for (const c of DARK_SERIES) {
      expect(ratio(luminance(c), CARD_DARK), `${c} vs dark card`).toBeGreaterThanOrEqual(3);
    }
  });

  // Slot 1 is the lead data hue and is deliberately the brand violet on each
  // theme, so it matches --ring. If someone re-hues the brand, this fails and
  // the series gets re-pointed with it rather than drifting apart.
  it("leads with the brand violet on both themes", () => {
    const ring = (b: string) => b.match(/--ring:\s*(#[0-9A-Fa-f]{6})\s*;/)?.[1]?.toLowerCase();
    expect(ring(LIGHT_BLOCK), "light --ring").toBeDefined();
    expect(ring(DARK_BLOCK), "dark --ring").toBeDefined();
    expect(LIGHT_SERIES[0].toLowerCase()).toBe(ring(LIGHT_BLOCK));
    expect(DARK_SERIES[0].toLowerCase()).toBe(ring(DARK_BLOCK));
  });
});
