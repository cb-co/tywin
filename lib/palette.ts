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
