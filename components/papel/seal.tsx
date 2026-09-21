import { cn } from "@/lib/utils";
import { rosettePath } from "@/lib/papel/rosette";

const RING = rosettePath(64);

/**
 * The Cigua seal: the engraved re-issue of the logo. A guilloche rosette
 * ring cut around the incumbent Coins mark, all line work, in note ink on a
 * note-violet disc. Static SVG (no canvas) so next/og can render it too.
 */
export function Seal({
  className,
  tone = "note",
  rosette = false,
}: {
  className?: string;
  tone?: "note" | "ink";
  /** The engraved rosette ring. Its hairlines only resolve from about 80px up; below that they merge into a smear, so nav and splash sizes leave it off. */
  rosette?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full",
        tone === "note" ? "bg-(--note) text-(--note-ink)" : "text-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-full" fill="none" stroke="currentColor">
        {rosette ? <path d={RING} strokeWidth={0.35} opacity={0.55} /> : null}
        <circle cx="32" cy="32" r="30.5" strokeWidth={1.8} />
        <circle cx="32" cy="32" r="22" strokeWidth={1.4} />
        {/* Coins, redrawn in the 64 box (lucide 'coins' geometry, scaled and centred). */}
        <g transform="translate(17.6 17.6) scale(1.1)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </g>
      </svg>
    </span>
  );
}
