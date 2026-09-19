import { cn } from "@/lib/utils";
import { perforationCells } from "@/lib/papel/perforation";

/** Cuotas as a perforated strip: paid cells print solid ink, unpaid ones
 *  are outlined. `label` is the accessible reading ("3 de 12 cuotas").
 *
 *  Pass `decorative` when a fully-equivalent caption is already visible
 *  right alongside the strip — otherwise a screen reader announces the
 *  same "N of M installments" text twice in a row, once for this `role="img"`
 *  and once for the visible text. Decorative mode drops the image role and
 *  label in favor of `aria-hidden`, leaving the visible caption as the one
 *  thing announced. */
export function Perforation({
  total,
  paid,
  label,
  className,
  decorative,
}: {
  total: number;
  paid: number;
  label: string;
  className?: string;
  decorative?: boolean;
}) {
  const { cells, hidden } = perforationCells(total, paid);
  return (
    <div
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
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
