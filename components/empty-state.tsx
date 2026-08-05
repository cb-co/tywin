import { cn } from "@/lib/utils";

/**
 * `illustration` and `icon` are alternatives, not a stack: an empty state gets
 * one piece of art, and showing both reads as a rendering fault. The
 * illustration wins where both are supplied, because a caller passing one is
 * asking for the larger treatment.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          {icon}
        </span>
      ) : null}
      <p className="text-lg font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
