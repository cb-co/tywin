import { cn } from "@/lib/utils";
import { BIRD_BODY, BIRD_FEATHER, BIRD_WING } from "@/lib/papel/bird";
import { rosettePath } from "@/lib/papel/rosette";

const RING = rosettePath(64);

/**
 * The Cigua seal: the engraved re-issue of the logo. A guilloche rosette
 * ring cut around the palmchat, all line work, in note ink on a note-violet
 * disc. Static SVG (no canvas) so next/og can render it too.
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
        {/* The palmchat, engraved in one line weight (lib/papel/bird.ts). */}
        <g transform="translate(-0.8 0.2)" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
          <path d={BIRD_WING} />
          {rosette ? <path d={BIRD_FEATHER} strokeWidth={1} /> : null}
          <path d={BIRD_BODY} />
        </g>
      </svg>
    </span>
  );
}
