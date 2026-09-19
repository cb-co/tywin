import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HEX6 } from "@/lib/color";
import { stampInk, STAMP_SURFACE } from "@/lib/papel/ink";

const SIZES = {
  sm: { box: "size-9", glyph: "text-sm", icon: "size-[18px]" },
  md: { box: "size-11", glyph: "text-lg", icon: "size-5" },
  lg: { box: "size-14", glyph: "text-2xl", icon: "size-6" },
} as const;

/**
 * A category's or account's identity, printed as an ink stamp: a double ring
 * and the glyph in the user's own colour. The colour is data, so both theme
 * inks are computed from it (never assumed to be a shipped swatch) and the
 * CSS picks one per theme. Emoji keep their own colour inside the ring.
 */
export function Stamp({
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
  const valid = color && HEX6.test(color) ? color : null;
  const style = (
    valid
      ? { "--stamp-light": stampInk(valid, STAMP_SURFACE.light), "--stamp-dark": stampInk(valid, STAMP_SURFACE.dark) }
      : color?.startsWith("var(")
        ? { "--stamp-light": color, "--stamp-dark": color }
        : { "--stamp-light": "var(--ink-soft)", "--stamp-dark": "var(--ink-soft)" }
  ) as React.CSSProperties;
  return (
    <span
      aria-hidden
      style={style}
      className={cn("stamp flex shrink-0 items-center justify-center rounded-full font-bold", s.box, className)}
    >
      {emoji ? (
        <span className={s.glyph}>{emoji}</span>
      ) : Icon ? (
        <Icon className={s.icon} strokeWidth={2.25} />
      ) : name ? (
        <span className={cn(s.glyph, "text-(--ink) [font-stretch:112%]")}>{name.charAt(0).toUpperCase()}</span>
      ) : null}
    </span>
  );
}
