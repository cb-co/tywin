import { createClient } from "@/lib/supabase/server";
import { computeFunding, type ContributionRow } from "./funding";
import { computePace, type Pace } from "./pace";

export type ContributableAccount = { id: string; name: string; currency: string };

export type GoalCardRow = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  target_amount: number;
  target_date: string | null;
  saved: number;
  backed: number;
  shortfall: number;
  pace: Pace;
};

export type GoalsOverview = {
  goals: GoalCardRow[];
  totalSaved: number;
  totalTarget: number;
  totalBacked: number;
  totalShortfall: number;
  baseCurrency: string;
  /** Accounts a contribution may be drawn from, for the contribute dialog. */
  accounts: ContributableAccount[];
};

/** Accounts that can hold savings. Cards and loans are debts. */
const SAVINGS_ACCOUNT_TYPES = ["checking", "savings", "cash", "investment", "asset"] as const;

export async function getGoalsOverview(): Promise<GoalsOverview> {
  const supabase = await createClient();
  const [{ data: goals }, { data: contributions }, { data: balances }, { data: profile }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("savings_goals")
        .select("id,name,emoji,color,target_amount,target_date")
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("goal_contributions")
        .select("id,goal_id,account_id,amount,base_amount,occurred_at")
        .order("occurred_at"),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase
        .from("accounts")
        .select("id,name,currency")
        .eq("is_archived", false)
        .in("type", SAVINGS_ACCOUNT_TYPES)
        .order("sort_order")
        .order("created_at"),
    ]);

  const rows: ContributionRow[] = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    occurred_at: c.occurred_at,
  }));

  const funding = computeFunding(
    rows,
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const byGoal = new Map<string, ContributionRow[]>();
  for (const r of rows) {
    const list = byGoal.get(r.goal_id);
    if (list) list.push(r);
    else byGoal.set(r.goal_id, [r]);
  }

  const cards: GoalCardRow[] = (goals ?? []).map((g) => {
    const f = funding.goals.get(g.id) ?? { saved: 0, backed: 0, shortfall: 0 };
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      target_amount: Number(g.target_amount),
      target_date: g.target_date,
      saved: f.saved,
      backed: f.backed,
      shortfall: f.shortfall,
      pace: computePace({
        saved: f.saved,
        shortfall: f.shortfall,
        target: Number(g.target_amount),
        targetDate: g.target_date,
        contributions: byGoal.get(g.id) ?? [],
      }),
    };
  });

  return {
    goals: cards,
    totalSaved: cards.reduce((s, g) => s + g.saved, 0),
    totalTarget: cards.reduce((s, g) => s + g.target_amount, 0),
    totalBacked: cards.reduce((s, g) => s + g.backed, 0),
    totalShortfall: cards.reduce((s, g) => s + g.shortfall, 0),
    baseCurrency: profile?.base_currency ?? "USD",
    accounts: accounts ?? [],
  };
}

/**
 * Committed/available per account, for the accounts page. Separate from
 * `getGoalsOverview` so `/accounts` does not pay for goal and pace assembly it
 * never renders. Reads the raw contribution rows and hands them to
 * `computeFunding` — the same function `getGoalsOverview` uses — rather than
 * a SQL view: the per-(account, goal)-pair clamp rule that decides how much
 * capacity a net-negative pair consumes is subtle enough that it drifted out
 * of step once between a SQL copy and this TypeScript one (see migration
 * 20260803190000_drop_account_commitments.sql). Keeping a single encoding,
 * covered by the tests in ./funding.test.ts, is worth the extra row fetch.
 */
export async function getAccountFunding(): Promise<
  Map<string, { committed: number; available: number }>
> {
  const supabase = await createClient();
  const [{ data: contributions }, { data: balances }] = await Promise.all([
    supabase.from("goal_contributions").select("id,goal_id,account_id,amount,base_amount,occurred_at"),
    supabase.from("account_balances").select("account_id,balance"),
  ]);

  const funding = computeFunding(
    (contributions ?? []).map((c) => ({
      id: c.id,
      goal_id: c.goal_id,
      account_id: c.account_id,
      amount: Number(c.amount),
      base_amount: Number(c.base_amount),
      occurred_at: c.occurred_at,
    })),
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  return new Map(
    [...funding.accounts.values()].map((a) => [
      a.accountId,
      { committed: a.committed, available: a.available },
    ]),
  );
}
