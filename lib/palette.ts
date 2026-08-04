import type { CSSProperties } from "react";

/**
 * Identity colours for categories, accounts and goals. Stored as literal hex on
 * the row — not `var(--chart-n)` — because the value has to survive a theme
 * switch.
 *
 * These serve two jobs, and every value is validated for both (see
 * lib/palette.test.ts, which fails the build if a future edit breaks it):
 *
 *   1. Tile FILL behind a white glyph  -> >= 3:1 against #ffffff
 *   2. Chip FOREGROUND on either card  -> >= 3:1 against #ffffff and #16161f
 *
 * The tightest are amber and olive at 3.05:1 against white. 3:1 covers glyphs,
 * icons and large text; it does not cover small body text on a filled tile.
 *
 * These are hue-matched to the sixteen they replaced, so an existing category
 * keeps its identity and only gains saturation. The matching database rewrite
 * is supabase/migrations/20260804120000_brighten_palette.sql. Until the user
 * pushes it, rows still hold the old values — every consumer must therefore
 * treat a stored colour as an arbitrary hex, never as an index into this array.
 */
export const SWATCHES = [
  "#4361F0", "#CE830A", "#00A08A", "#E85B3F", "#9B4FBC", "#899C39", "#1A96CE", "#DB4A76",
  "#CE7A38", "#98912B", "#4AA331", "#309E54", "#8471E8", "#C752B0", "#E0666C", "#8A8698",
];

/**
 * A colour swatch button, shared by the category and goal dialogs.
 *
 * Selection is marked by a white tick inside the swatch, not by a ring alone.
 * A ring cannot carry this job: `--ring` is the blue `#2f55ab`, and `--chart-1`
 * is `#3e5fad` — selecting the first swatch drew a blue ring around a blue
 * circle and was all but invisible. Several other swatches are blue-adjacent.
 *
 * The tick is literal white rather than a token because the swatch beneath it
 * is a literal hex that does not change with the theme. Every swatch sits in
 * the 0.126..0.300 luminance band (see SWATCHES above), so white-on-swatch
 * clears ~4:1 on all sixteen, in both themes.
 *
 * `--ring` is still used, but for its actual purpose: the keyboard focus ring.
 * Selection gets `--foreground`, which is near-black/near-white and so never
 * collides with a swatch hue.
 */
export const SWATCH_CLASS =
  "flex size-7 items-center justify-center rounded-full text-white outline-none " +
  "ring-offset-2 ring-offset-background transition-all " +
  "focus-visible:ring-2 focus-visible:ring-ring " +
  "data-[active=true]:ring-2 data-[active=true]:ring-foreground";

/**
 * The wash a coloured card takes. Mixing against `var(--card)` rather than a
 * fixed value is what makes this theme-correct for free: the same 5% over ivory
 * and over near-black both land as a gentle cast in the right direction.
 */
export function colorCardStyle(color: string | null): CSSProperties {
  if (!color) return {};
  return {
    backgroundColor: `color-mix(in oklab, ${color} 5%, var(--card))`,
  };
}
