/**
 * Colour maths for surfaces whose fill comes from user data.
 *
 * A stored account or category colour is an arbitrary hex — the user picked it,
 * and it may predate the palette brightening. Anything rendering text on top of
 * one has to measure rather than assume.
 */

const INK = "#14141c";
const PAPER = "#ffffff";

function channels(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Whichever of white or near-black reads better on `background`. */
export function readableForeground(background: string): typeof PAPER | typeof INK {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK;
}

/**
 * The card-face background derived from one colour, so any user colour yields a
 * plausible card without needing a second stored value.
 *
 * Two layers. Underneath, the same hue darkened along the diagonal. On top, a
 * soft off-centre highlight — the thing that makes a flat fill read as a
 * physical object catching light rather than a coloured rectangle. It is
 * deliberately weak; a strong sheen looks like a gloss filter.
 *
 * The highlight is measured, not assumed white: on a pale card a white sheen is
 * invisible, so it flips to a shadow instead. Same discipline as
 * `readableForeground` — the fill is arbitrary user data.
 */
export function gradientFrom(hex: string): string {
  const [r, g, b] = channels(hex);
  const dark = `#${[r, g, b]
    .map((c) => Math.round(c * 0.62).toString(16).padStart(2, "0"))
    .join("")}`;
  const sheen = relativeLuminance(hex) > 0.45 ? "0, 0, 0" : "255, 255, 255";
  return [
    `radial-gradient(115% 85% at 18% 0%, rgba(${sheen}, 0.16) 0%, rgba(${sheen}, 0.05) 40%, transparent 70%)`,
    `linear-gradient(135deg, ${hex} 0%, ${dark} 100%)`,
  ].join(", ");
}
