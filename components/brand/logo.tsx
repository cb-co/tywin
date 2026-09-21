import { cn } from "@/lib/utils";
import { Seal } from "@/components/papel/seal";
import { WORDMARK_VIEWBOX, WordmarkPaths } from "@/lib/papel/wordmark";

/** Cigua brand mark: the engraved seal (see components/papel/seal.tsx). */
export function Logo({ className }: { className?: string }) {
  return <Seal className={cn("size-8", className)} />;
}

/**
 * The drawn "cigua" wordmark (lib/papel/wordmark.tsx). It is sized in em, so
 * a `text-*` class or a parent's font-size scales it, and it takes the
 * surrounding text colour.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Cigua"
      viewBox={WORDMARK_VIEWBOX}
      className={cn("inline-block h-[1.1em] w-auto shrink-0", className)}
    >
      <WordmarkPaths />
    </svg>
  );
}
