"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Light/dark, on one tap.
 *
 * This was a three-item menu — light, dark, system — and "system" was the cost
 * of it: a third state that looks identical to one of the other two, so the
 * control could never show which mode you were in, only which rule you had
 * picked. Two states and a button that flips between them is the whole feature
 * here, and it survives being small enough to sit in the sidebar next to the
 * figure mask.
 *
 * `system` is still next-themes' DEFAULT for anyone who has never touched this,
 * so a first visit follows the OS. Tapping only ever leaves that default; it is
 * not a state you can land back on, which is the point.
 *
 * The icons swap in CSS off the `dark` class rather than off `resolvedTheme`.
 * That value is undefined during SSR, so rendering from it would either mismatch
 * on hydration or need a mounted flag that blanks the button on first paint. The
 * class is on <html> before paint (next-themes' pre-hydration script), so the
 * right icon is there from the first frame. The label is mode-neutral for the
 * same reason: one naming the target mode would have to be guessed on the
 * server.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("Theme");

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={t("toggle")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
