import { formatMoney } from "@/lib/format";
import type { GoalCardRow } from "@/lib/goals/queries";
import { getTranslations } from "next-intl/server";

/**
 * Goals belong in the `position` band rather than `this month`: they are
 * cumulative and month-independent, so the month picker in the other band's
 * heading would falsely claim to scope them.
 *
 * Structurally this mirrors the page's local `Tally` helper (rows closed by a
 * total, same wrapper classes) but does not import it: `Tally` is a private
 * helper defined inside `app/(app)/insights/page.tsx`, and reaching into a
 * page file from a component file would invert the usual dependency
 * direction for one shared `<div>` shell. Duplicating that small shell here
 * is cheaper than promoting `Tally` out of the page for a single reuse.
 */
export async function SavingsGoals({
  goals,
  totalSaved,
  totalTarget,
  currency,
}: {
  goals: GoalCardRow[];
  totalSaved: number;
  totalTarget: number;
  currency: string;
}) {
  const t = await getTranslations("Insights");
  const tg = await getTranslations("Goals");

  if (goals.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("savingsGoalsEmpty")}</p>;
  }

  const verdict = (g: GoalCardRow) => {
    switch (g.pace.kind) {
      case "shortfall":
        return { label: tg("paceShortfall", { amount: formatMoney(g.pace.amount, currency) }), tone: "text-destructive" };
      case "complete":
        return { label: tg("paceComplete"), tone: "text-success" };
      case "overdue":
        return { label: tg("paceOverdue"), tone: "text-destructive" };
      case "on-track":
        return { label: tg("paceOnTrack"), tone: "text-success" };
      case "behind":
        return { label: tg("paceBehind"), tone: "text-warning" };
      case "projection":
        return { label: tg("paceProjectionShort", { months: g.pace.months }), tone: "text-muted-foreground" };
      case "no-pace":
        return { label: tg("paceNone"), tone: "text-muted-foreground" };
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-3 pb-4">
        {goals.map((g) => {
          const v = verdict(g);
          const pct = g.target_amount > 0
            ? Math.min(Math.max(g.saved / g.target_amount, 0), 1) * 100
            : 0;
          return (
            <div key={g.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {g.emoji ? `${g.emoji} ` : ""}
                  {g.name}
                </span>
                <span className={`shrink-0 text-xs ${v.tone}`}>{v.label}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: g.color ?? "var(--brand)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex items-baseline justify-between border-t pt-3 text-sm font-medium">
        <span className="text-foreground">{t("savingsGoalsTotal")}</span>
        <span className="tabular-nums text-foreground">
          {formatMoney(totalSaved, currency)} / {formatMoney(totalTarget, currency)}
        </span>
      </div>
    </div>
  );
}
