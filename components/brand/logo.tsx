import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cashly brand mark — the Lucide "Coins" glyph on the signature gradient.
 *
 * It carries `--hero`, the one surface in the app that does NOT invert, so the
 * mark is identical in both themes. That is the point of a logo: the previous
 * version was graphite-on-ivory flipping to ivory-on-graphite, which left it
 * wearing the old warm palette long after the rest of the app went cool, and
 * meant the brand looked like two different marks depending on the theme.
 *
 * The gradient is referenced through the token rather than hardcoded, so a
 * change to the brand ramp reaches the logo too — the one thing that should
 * never drift from it.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.6rem]",
        "bg-[image:var(--hero)] text-(--hero-foreground) shadow-sm ring-1 ring-black/[0.07] dark:ring-white/10",
        className,
      )}
      aria-hidden
    >
      {/* subtle top edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      />
      <Coins className="h-[56%] w-[56%]" strokeWidth={2} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
    >
      Cashly
    </span>
  );
}
