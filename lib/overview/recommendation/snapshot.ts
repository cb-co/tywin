import type { Overview, UpcomingItem } from "@/lib/overview/queries";
import type { BudgetRow } from "@/lib/budgets/queries";
import type { GoalCardRow } from "@/lib/goals/queries";

type UpcomingKind = "card_payment" | "loan_installment" | "subscription" | "other";

/**
 * What one person's finances look like to the model.
 *
 * Every field is a number, a currency code, a date, or a category name. That is
 * the whole privacy design: there is no field here a name could be put in, so
 * nothing downstream has to remember not to put one there. `buildSnapshot` takes
 * the RAW rows — names, UUIDs and all — precisely so the dropping happens in one
 * place with a test on it.
 *
 * Amounts are rounded to whole currency units. Coaching does not need cents, and
 * false precision spends tokens to make the model sound like a ledger.
 */
export type RecommendationSnapshot = {
  asOf: string;
  dayOfMonth: number;
  daysLeftInMonth: number;
  baseCurrency: string;
  netWorth: number;
  monthIncome: number;
  monthExpense: number;
  monthlySubscriptions: number;
  budgets: { category: string; budget: number; used: number }[];
  accounts: { type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
  goals: { target: number; saved: number; targetDate: string | null }[];
  upcoming: { kind: UpcomingKind; amount: number; currency: string; dueInDays: number }[];
};

export type SnapshotRows = {
  now: Date;
  overview: Overview;
  budgets: BudgetRow[];
  goals: GoalCardRow[];
  accounts: { id: string; name: string; type: string; currency: string; balance: number }[];
  loans: { currency: string; outstanding: number; installment: number }[];
};

/* `UpcomingItem.key` is the only place the kind survives — `title` and
   `subtitle` are already translated prose and carry the account's name. The key
   also carries a UUID, so the prefix is taken and the rest discarded. */
const KIND_BY_PREFIX: Record<string, UpcomingKind> = {
  card: "card_payment",
  loan: "loan_installment",
  sub: "subscription",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function upcomingKind(item: UpcomingItem): UpcomingKind {
  return KIND_BY_PREFIX[item.key.split("-")[0]] ?? "other";
}

/** Whole days from `now` to `date`, floored at zero — an overdue item is "due
 *  today" to the model rather than a negative number it has to interpret. */
function dueInDays(date: string, now: Date): number {
  const days = Math.round((new Date(date).getTime() - now.getTime()) / MS_PER_DAY);
  return Math.max(days, 0);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysLeftInMonth(now: Date): number {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return end.getUTCDate() - now.getUTCDate();
}

export function buildSnapshot(rows: SnapshotRows): RecommendationSnapshot {
  const { now, overview: o } = rows;
  const r = Math.round;

  return {
    asOf: isoDate(now),
    dayOfMonth: now.getUTCDate(),
    daysLeftInMonth: daysLeftInMonth(now),
    baseCurrency: o.baseCurrency,
    netWorth: r(o.netWorth),
    monthIncome: r(o.monthIncome),
    monthExpense: r(o.monthExpense),
    monthlySubscriptions: r(o.monthlySubscriptions),
    // Categories with no limit set are dropped: nothing can be over, under or
    // approaching a budget of zero, so they are pure prompt noise.
    budgets: rows.budgets
      .filter((b) => b.budget > 0)
      .map((b) => ({ category: b.name, budget: r(b.budget), used: r(b.used) })),
    accounts: rows.accounts.map((a) => ({
      type: a.type,
      currency: a.currency,
      balance: r(a.balance),
    })),
    loans: rows.loans.map((l) => ({
      currency: l.currency,
      outstanding: r(l.outstanding),
      installment: r(l.installment),
    })),
    goals: rows.goals.map((g) => ({
      target: r(g.target_amount),
      saved: r(g.saved),
      targetDate: g.target_date,
    })),
    upcoming: o.upcoming.map((u) => ({
      kind: upcomingKind(u),
      amount: r(u.amount),
      currency: u.currency,
      dueInDays: dueInDays(u.date, now),
    })),
  };
}
