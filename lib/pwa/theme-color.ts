/** Matches components/shell/mobile-header.tsx's `bg-background` in each theme. */
export const TOPBAR_LIGHT = "#eeebf5";
export const TOPBAR_DARK = "#15111f";

export function topbarThemeColor(resolvedTheme: string | undefined): string | null {
  if (resolvedTheme === "light") return TOPBAR_LIGHT;
  if (resolvedTheme === "dark") return TOPBAR_DARK;
  return null;
}

/**
 * Next emits a light/dark `<meta name="theme-color" media=...>` pair. Update
 * every one: the browser picks by OS scheme, so touching only the first would
 * leave chrome in the OS colour when the user chose the opposite theme.
 */
export function applyThemeColor(
  root: { querySelectorAll(selector: string): Iterable<{ setAttribute(name: string, value: string): void }> },
  color: string,
): void {
  for (const meta of root.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", color);
  }
}
