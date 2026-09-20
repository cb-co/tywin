import { cn } from "@/lib/utils";

/**
 * One printed ledger line: lead (a Stamp or date), title/subtitle, and a
 * right-aligned tabular amount. The rule under it is the separator; a list
 * of these needs no card around each row.
 */
export function LedgerRow({
  lead,
  title,
  subtitle,
  amount,
  meta,
  wrapSubtitle,
  trailing,
  className,
  ...props
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  meta?: React.ReactNode;
  /** Let the subtitle wrap instead of truncating (default: truncate). */
  wrapSubtitle?: boolean;
  /** Controls that live at the row's end (edit/delete). Not part of the figure column. */
  trailing?: React.ReactNode;
} & Omit<React.ComponentProps<"div">, "title">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-3 border-b border-(--paper-line) px-4 py-3 last:border-b-0", className)}
      {...props}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className={cn("text-xs text-muted-foreground", !wrapSubtitle && "truncate")}>{subtitle}</p> : null}
      </div>
      {amount || meta ? (
        <div className="figure shrink-0 text-right">
          {amount}
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      ) : null}
      {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
    </div>
  );
}
