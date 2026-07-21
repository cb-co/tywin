/** Matches components/shell/mobile-header.tsx's `bg-card` in each theme. */
export const TOPBAR_LIGHT = "#ffffff";
export const TOPBAR_DARK = "#161d19";

export function topbarThemeColor(resolvedTheme: string | undefined): string | null {
  if (resolvedTheme === "light") return TOPBAR_LIGHT;
  if (resolvedTheme === "dark") return TOPBAR_DARK;
  return null;
}
