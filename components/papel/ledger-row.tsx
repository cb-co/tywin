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
  className,
  ...props
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  meta?: React.ReactNode;
} & Omit<React.ComponentProps<"div">, "title">) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-3 border-b border-(--paper-line) px-4 py-3 last:border-b-0", className)}
      {...props}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {amount || meta ? (
        <div className="figure shrink-0 text-right">
          {amount}
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
