import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cashly brand mark — the Lucide "Coins" glyph in ivory on a neutral graphite
 * tile. Deliberately color-neutral: the emerald UI carries the brand while the
 * mark stays calm and reads on any surface.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.6rem]",
        "bg-[#e7e1d3] text-[#2b2f2c] shadow-sm ring-1 ring-black/[0.07] dark:bg-gradient-to-br dark:from-[#262a28] dark:to-[#141614] dark:text-[#f1efe8] dark:ring-white/10",
        className,
      )}
      aria-hidden
    >
      {/* subtle top edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
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
