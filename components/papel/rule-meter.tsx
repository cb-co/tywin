import { cn } from "@/lib/utils";
import { meterFill } from "@/lib/papel/meter";

/** A ruled scale filled with ink. Over budget prints a double rule at the
 *  end and a red fill, so the state never relies on colour alone. */
export function RuleMeter({ used, total, label, overLabel, className }: { used: number; total: number; label: string; /** Localised reading announced when over budget (e.g. "Over budget"). */ overLabel?: string; className?: string }) {
  const { pct, over } = meterFill(used, total);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={over && overLabel ? `${Math.round(pct)}%, ${overLabel}` : undefined}
      className={cn("relative h-2 border-b border-(--rule)", className)}
      style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--paper-line) 0 1px, transparent 1px 10%)" }}
    >
      <div
        className={cn("bar-fill absolute inset-y-0 left-0", over ? "bg-(--red)" : "bg-foreground")}
        style={{ width: `${pct}%` }}
      />
      {over ? <span aria-hidden className="absolute -right-1 inset-y-[-3px] w-[3px] border-x border-(--red)" /> : null}
    </div>
  );
}
