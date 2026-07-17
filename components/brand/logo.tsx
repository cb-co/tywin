import { cn } from "@/lib/utils";

/**
 * Tywin brand mark — a serif "T" monogram struck in ivory on a deep-emerald
 * tile and edged with a hairline of gold. Shares the Fraunces face with the
 * wordmark, so the lockup reads as one thing; the emerald + gold pairing is
 * the wealth cue, not a generic app glyph.
 *
 * `variant="ghost"` renders a translucent tile for use on emerald surfaces
 * (e.g. the login brand panel) where a solid emerald tile would disappear.
 */
export function Logo({
  className,
  variant = "solid",
}: {
  className?: string;
  variant?: "solid" | "ghost";
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.65rem]",
        variant === "solid"
          ? "bg-gradient-to-br from-[#0b6a49] to-[#13875d] text-[#f3ecd7] shadow-sm ring-1 ring-gold/40"
          : "bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20",
        className,
      )}
      aria-hidden
    >
      {/* struck-metal top highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
      />
      <span className="font-serif text-[1.2rem] font-semibold leading-none tracking-tight">
        T
      </span>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      Tywin
    </span>
  );
}
