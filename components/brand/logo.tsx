import { cn } from "@/lib/utils";
import { Seal } from "@/components/papel/seal";

/** Cigua brand mark: the engraved seal (see components/papel/seal.tsx). */
export function Logo({ className }: { className?: string }) {
  return <Seal className={cn("size-8", className)} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("legend text-base text-foreground", className)}
    >
      Cigua
    </span>
  );
}
