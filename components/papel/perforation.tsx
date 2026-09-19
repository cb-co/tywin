import { cn } from "@/lib/utils";
import { perforationCells } from "@/lib/papel/perforation";

/** Cuotas as a perforated strip: paid cells print solid ink, unpaid ones
 *  are outlined. `label` is the accessible reading ("3 de 12 cuotas"). */
export function Perforation({ total, paid, label, className }: { total: number; paid: number; label: string; className?: string }) {
  const { cells, hidden } = perforationCells(total, paid);
  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap items-center gap-1", className)}>
      {cells.map((c) => (
        <i
          key={c.index}
          className={cn(
            "h-3 w-2.5 rounded-[1px] border border-current",
            c.paid ? "bg-current" : "border-dashed opacity-60",
          )}
        />
      ))}
      {hidden > 0 ? <span className="figure ml-1 text-xs text-muted-foreground">+{hidden}</span> : null}
    </div>
  );
}
