import { cn } from "@/lib/utils";

/**
 * A ledger line with a body under it: `head` is a `LedgerRow`, `children` are
 * the controls or meter that belong to it. The block owns the separator, so
 * the head's own rule is stripped and there is exactly one hairline between
 * blocks. With no children it is just the head.
 */
export function LedgerBlock({
  head,
  children,
  className,
}: {
  head: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 border-b border-(--paper-line) last:border-b-0 [&>:first-child]:border-b-0", className)}>
      {head}
      {children ? <div className="min-w-0 space-y-2.5 px-4 pb-3">{children}</div> : null}
    </div>
  );
}
