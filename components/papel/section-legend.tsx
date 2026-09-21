import { cn } from "@/lib/utils";

/** A section's heading: engraved caps over a heavy rule, with an optional
 *  aside (a period label, an action) at the far end. */
export function SectionLegend({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-end justify-between gap-4 border-b-2 border-(--rule) pb-1.5", className)}>
      <h2 className="legend text-[11px] text-foreground">{children}</h2>
      {aside ? <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
