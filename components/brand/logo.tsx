import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cashly brand mark — the Lucide "Coins" glyph in ivory on a neutral graphite
 * tile. Deliberately color-neutral: the emerald UI carries the brand while the
 * mark stays calm and reads on any surface.
 *
 * `variant="ghost"` renders a translucent tile for emerald surfaces (e.g. the
 * login brand panel) where the graphite tile would fight the background.
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
        "relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-[0.6rem]",
        variant === "solid"
          ? "bg-gradient-to-br from-[#262a28] to-[#141614] text-[#f1efe8] shadow-sm ring-1 ring-white/10"
          : "bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20",
        className,
      )}
      aria-hidden
    >
      {/* subtle top edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
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
