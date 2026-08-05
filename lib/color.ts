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

/* --- OKLCH -----------------------------------------------------------------
   The card gradient shifts lightness and hue, and doing that in sRGB gives
   muddy midtones and unpredictable steps — a fixed multiplier that looks right
   on orange looks wrong on blue. OKLCH is perceptually uniform, so one formula
   holds across every accent the LLM can return. */

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

type Oklch = { l: number; c: number; h: number };

export function toOklch(hex: string): Oklch {
  const [R, G, B] = channels(hex).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: L,
    c: Math.hypot(a, b2),
    h: ((Math.atan2(b2, a) * 180) / Math.PI + 360) % 360,
  };
}

function oklchChannels({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S,
  ];
}

export function fromOklch(color: Oklch): string {
  // Walk chroma down until the colour fits sRGB. Clipping the channels instead
  // would shift the hue, which is the one thing the gradient must preserve.
  let { c } = color;
  while (c > 0.001 && !oklchChannels({ ...color, c }).every((v) => v >= -0.001 && v <= 1.001)) {
    c -= 0.002;
  }
  return `#${oklchChannels({ ...color, c })
    .map((v) => linearToSrgb(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** How far the far corner lifts and rotates from the accent. Fixed by design. */
const LIFT = 0.13;
const ROTATE = 15;

/**
 * The card-face background derived from a single accent, so one stored value
 * yields a complete card.
 *
 * The GEOMETRY is fixed and the accent is the only variable — every card in the
 * app is lit the same way, which is what makes a wall of them read as a set
 * rather than as unrelated rectangles.
 *
 * Two layers. Underneath, a 135° ramp from the accent to a lighter, slightly
 * warmer-rotated version of itself. Note it brightens toward the far corner
 * rather than darkening: that is what gives these faces the lit, moulded look
 * of a real card instead of the flat vignette a darkening ramp produces. On an
 * achromatic accent the rotation has nothing to act on, so a near-black card
 * simply lifts to charcoal — which is exactly right.
 *
 * On top, a weak off-centre highlight. It is deliberately faint; a strong sheen
 * looks like a gloss filter. The highlight is measured, not assumed white: on a
 * pale accent a white sheen is invisible, so it flips to a shadow. Same
 * discipline as `readableForeground`.
 */
export function gradientFrom(hex: string): string {
  const accent = toOklch(hex);
  const far = fromOklch({
    l: Math.min(0.97, accent.l + LIFT),
    c: accent.c,
    h: (accent.h + ROTATE) % 360,
  });
  const sheen = relativeLuminance(hex) > 0.45 ? "0, 0, 0" : "255, 255, 255";
  return [
    `radial-gradient(115% 85% at 18% 0%, rgba(${sheen}, 0.16) 0%, rgba(${sheen}, 0.05) 40%, transparent 70%)`,
    `linear-gradient(135deg, ${hex} 0%, ${far} 100%)`,
  ].join(", ");
}
