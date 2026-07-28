import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cashly brand mark — the Lucide "Coins" glyph on a tile that inverts with the
 * theme: graphite-on-ivory in light, ivory-on-graphite in dark. It is the
 * whole palette in one 32px square, which is why the tile is hardcoded rather
 * than tokenised — the mark should look the same wherever it is dropped.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.6rem]",
        "bg-[#ece5d6] text-[#26221e] shadow-sm ring-1 ring-black/[0.07] dark:bg-gradient-to-br dark:from-[#2a2723] dark:to-[#141210] dark:text-[#ece7de] dark:ring-white/10",
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
