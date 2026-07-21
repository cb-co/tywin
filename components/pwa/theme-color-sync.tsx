"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { topbarThemeColor } from "@/lib/pwa/theme-color";

/**
 * Keeps the mobile browser/PWA chrome color matching the in-app topbar.
 * `next-themes` can resolve to a theme the OS's `prefers-color-scheme`
 * doesn't agree with (the user picked light/dark explicitly), so a static
 * `<meta name="theme-color">` can't cover every case — this corrects it
 * live once the real resolved theme is known.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = topbarThemeColor(resolvedTheme);
    if (!color) return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}
