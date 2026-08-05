import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Avatars in this app are circles, and `rounded-full` says so.
 *
 * These read as circles today by ACCIDENT, not by intent: they asked for
 * `rounded-xl`/`rounded-2xl`, which resolve to 27px and 34px against boxes of
 * 36px and 44px, and the browser silently clamps a radius past half the box.
 * The circle was a side effect of `--radius` being 1.25rem. Dropping that token
 * — a plausible thing to do to a design system — would have turned every avatar
 * in the app into a squircle with nothing in the code having changed.
 */
const SIZES = {
  sm: { box: "size-9 rounded-full", glyph: "text-sm", icon: "size-[18px]" },
  md: { box: "size-11 rounded-full", glyph: "text-lg", icon: "size-5" },
  lg: { box: "size-14 rounded-full", glyph: "text-2xl", icon: "size-6" },
} as const;

/**
 * The identity tile for a category or account: a FILLED colour square with the
 * entity's emoji on it.
 *
 * The fill is the stored hex at full strength, not a wash. `color` is whatever
 * is on the row — an arbitrary hex, possibly one of the pre-brightening values
 * — so nothing here may assume it is a member of SWATCHES.
 *
 * Fallback order is emoji, then supplied icon, then the first letter of the
 * name, then nothing. Glyphs are white: every shipped swatch clears 3:1 there.
 *
 * `.tile-sheen` gives the fill its depth. It only ever darkens, and only away
 * from the centre, which is what keeps that 3:1 intact — see the utility in
 * globals.css for why an additive highlight is not available here.
 */
export function ColorTile({
  color,
  emoji,
  name,
  icon: Icon,
  size = "sm",
  className,
}: {
  color: string | null;
  emoji?: string | null;
  name?: string | null;
  icon?: LucideIcon;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "tile-sheen flex shrink-0 items-center justify-center font-semibold text-white",
        s.box,
        className,
      )}
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    >
      {emoji ? (
        <span className={s.glyph}>{emoji}</span>
      ) : Icon ? (
        <Icon className={s.icon} />
      ) : name ? (
        <span className={s.glyph}>{name.charAt(0).toUpperCase()}</span>
      ) : null}
    </span>
  );
}
