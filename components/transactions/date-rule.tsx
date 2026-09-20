import { cn } from "@/lib/utils";

/** A month's heading: engraved caps over a heavy rule. Not sticky — the day
 *  rule below it is what stays pinned. */
export function MonthLegend({ label }: { label: string }) {
  return (
    <h2 className="legend border-b-2 border-(--rule) pb-1.5 text-[11px] text-foreground">{label}</h2>
  );
}

/** The date a run of rows shares: an engraved date over a full-width rule.
 *  Sticky under the mobile header (top-14) and at the top on desktop; the
 *  page background keeps rows from showing through it. */
export function DateRule({ label, className }: { label: string; className?: string }) {
  return (
    <h3
      className={cn(
        "legend sticky top-14 z-10 border-b border-(--rule) bg-background py-1.5 text-[10px] text-muted-foreground md:top-0",
        className,
      )}
    >
      {label}
    </h3>
  );
}
