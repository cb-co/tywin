import type { CSSProperties } from "react";

/**
 * Identity colours for categories and goals. Stored as literal hex on the row —
 * not `var(--chart-n)` — because the value has to survive a theme switch.
 *
 * The first eight are the light-mode `--chart-*` values in globals.css; keep
 * them in step. (`--chart-8` was defined there but never listed here.)
 *
 * The last eight were derived, not eyeballed. A swatch is used as chip
 * *foreground* in both themes, so it must clear 3:1 against the light card
 * (#ffffff) and the dark card (#191714). That bounds relative luminance to
 * 0.126..0.300; all eight sit mid-window at ~0.213 (≈4.0:1 light, ≈4.5:1 dark).
 * Saturation is pinned to 0.51, the median of the first eight, so they read as
 * the same family; #867e72 is the one deliberate exception at 0.08, because a
 * neutral is genuinely useful for a catch-all category. Hues fill the widest
 * gaps in the wheel above — the largest being the 99° hole between 73 and 172.
 *
 * Two pairs land close (#cb5c62 near terracotta, #89812c near olive). Unlike
 * the `--chart-*` series, which must survive being told apart in a legend under
 * CVD simulation, these always render beside their own name and emoji, so the
 * label carries distinguishability and hue coverage matters more.
 */
export const SWATCHES = [
  "#3e5fad", "#b6770b", "#008f7d", "#be563d", "#8949a3", "#7e903e", "#1b8abd", "#c4486d",
  "#b56e3a", "#89812c", "#45902e", "#2f914e", "#8471d1", "#c752b0", "#cb5c62", "#867e72",
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
