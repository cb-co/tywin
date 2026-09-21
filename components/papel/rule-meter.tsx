import { cn } from "@/lib/utils";
import { meterFill } from "@/lib/papel/meter";

/** A ruled scale filled with ink. Over budget prints a double rule at the
 *  end and a red fill, so the state never relies on colour alone. */
export function RuleMeter({ used, total, label, overLabel, pct: truePct, near, className }: { used: number; total: number; label: string; /** Localised reading announced when over budget (e.g. "Over budget"). */ overLabel?: string; /** The caller's own unclamped percent (e.g. 160 at 160% spend), for `aria-valuetext` only. `aria-valuenow` always uses the clamped fill percent, since ARIA requires it within `aria-valuemin`/`aria-valuemax`. Falls back to the clamped percent when omitted. */ pct?: number; /** Within sight of the limit: prints a heavy base rule. Ignored when over. */ near?: boolean; className?: string }) {
  const { pct, over } = meterFill(used, total);
  const reportedPct = truePct ?? pct;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={over && overLabel ? `${Math.round(reportedPct)}%, ${overLabel}` : undefined}
      className={cn("relative h-2 border-(--rule)", near && !over ? "border-b-2" : "border-b", className)}
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
