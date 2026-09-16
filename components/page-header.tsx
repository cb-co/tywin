import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    /* Two rows at every width: the title and its one action share the first,
       the description gets the second to itself.

       It started as a phone-only fix — a wrapping flex row put the actions on
       a line of their own below the description, which cost a whole band of
       vertical space for a single button — but the arrangement reads better
       wide as well, so there is no breakpoint in it. The title column is
       `minmax(0,1fr)` so it yields to the actions rather than pushing them off
       the edge; the actions column is `auto` and the buttons inside it are
       `whitespace-nowrap`, so it never compresses a label onto two lines.

       `col-span-full` on the description is what makes the second row full
       width. Left in column one it wrapped early, breaking under the button
       against an empty right-hand column. */
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b pb-5 sm:gap-x-4",
        className,
      )}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      {description ? (
        <p className="col-span-full text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
