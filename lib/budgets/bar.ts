import type { BudgetStatus } from "./queries";

/**
 * Three states, escalating in loudness.
 *
 * `within` used to be `--primary`, which drew a comfortable budget as the
 * heaviest black bar on the screen and made every row look urgent; the calm
 * state should be the quietest mark here, and only `over` should shout.
 *
 * Lives here rather than in the grid that first drew it because a budget bar
 * is now drawn in three places — the category band, the group band above it,
 * and the help guide's mock of both — and a category reading amber beside a
 * group reading green for the same fraction of the same money would be the
 * kind of disagreement nobody can debug from the screen.
 */
export const STATUS_COLOR: Record<BudgetStatus, string> = {
  within: "var(--brand)",
  approaching: "var(--warning)",
  over: "var(--destructive)",
};

/**
 * How much of the bar to fill, clamped to the track.
 *
 * An unbudgeted row has no fraction to draw, so it fills completely once there
 * is any spend at all and stays empty otherwise — spending against no budget
 * is not 0% of anything, and drawing it as an empty bar would read as "nothing
 * spent here".
 */
export function barPct(used: number, budget: number) {
  if (budget > 0) return Math.min(Math.max((used / budget) * 100, 0), 100);
  return used > 0 ? 100 : 0;
}

/**
 * The (used, total) pair to hand `RuleMeter` for a row. A real budget passes
 * through. With no budget the meter fills completely once anything is spent
 * and stays empty otherwise, the same rule `barPct` states: spending against
 * no budget is not 0% of anything. `used === total` fills the meter without
 * `meterFill` calling it over.
 */
export function meterArgs(used: number, budget: number): { used: number; total: number } {
  if (budget > 0) return { used, total: budget };
  return { used: used > 0 ? 1 : 0, total: 1 };
}
