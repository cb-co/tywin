import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A chart's printed plate: a hairline sheet with a captioned head. `basis`
 *  says how the plate counts money ("when charged" / "when paid"). */
export function Plate({
  figLabel,
  title,
  basis,
  className,
  children,
}: {
  figLabel: string;
  title: string;
  basis?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("h-full gap-0 p-0", className)}>
      <div className="flex min-h-10 items-end justify-between gap-3 border-b-2 border-(--rule) px-4 pb-1.5 pt-3">
        <h3 className="legend min-w-0 truncate text-[11px] text-foreground">
          <span className="text-muted-foreground">{figLabel} · </span>
          {title}
        </h3>
        {basis ? <span className="shrink-0 text-xs text-muted-foreground">{basis}</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </Card>
  );
}
