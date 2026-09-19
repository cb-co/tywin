import { cn } from "@/lib/utils";

const GLYPH = {
  ok: <path d="M3.5 8.2 6.6 11 12.5 4.8" />,
  flag: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  neutral: <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />,
} as const;

/**
 * A printed verification mark: glyph in an ink ring + a label. The glyph
 * carries the state, so it never depends on colour alone (teal/red only
 * reinforce it).
 */
export function ProofMark({
  tone,
  children,
  className,
}: {
  tone: keyof typeof GLYPH;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        tone === "ok" && "text-(--teal)",
        tone === "flag" && "text-(--red)",
        tone === "neutral" && "text-muted-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <circle cx="8" cy="8" r="7.1" strokeWidth={1.1} />
        {GLYPH[tone]}
      </svg>
      <span>{children}</span>
    </span>
  );
}
