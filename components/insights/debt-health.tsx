import { formatPercent } from "@/lib/format";
import type { Insights } from "@/lib/insights/queries";

function tone(pct: number) {
  if (pct >= 80) return "var(--destructive)";
  if (pct >= 50) return "var(--warning)";
  return "var(--chart-1)";
}

export function DebtHealth({
  utilization,
  loans,
}: {
  utilization: Insights["utilization"];
  loans: Insights["loans"];
}) {
  if (utilization.length === 0 && loans.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No cards or loans yet.</p>;
  }

  return (
    <div className="space-y-5">
      {utilization.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground">Card utilization</p>
          {utilization.map((c) => (
            <Bar key={c.name} label={c.name} pct={c.pct} value={formatPercent(c.pct)} color={tone(c.pct)} />
          ))}
        </div>
      ) : null}
      {loans.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground">Loan payoff</p>
          {loans.map((l) => (
            <Bar key={l.name} label={l.name} pct={l.paidPct} value={formatPercent(l.paidPct)} color="var(--chart-1)" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Bar({ label, pct, value, color }: { label: string; pct: number; value: string; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
