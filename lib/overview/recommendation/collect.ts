import { createClient } from "@/lib/supabase/server";
import { getOverview } from "@/lib/overview/queries";
import { getBudgetOverview } from "@/lib/budgets/queries";
import { getGoalsOverview } from "@/lib/goals/queries";
import { monthStart } from "@/lib/budgets/month";
import { buildSnapshot, type RecommendationSnapshot } from "./snapshot";

/**
 * Gathers everything the model is shown, and hands it to `buildSnapshot` to be
 * stripped.
 *
 * This runs inside the refresh action, NOT during page render, so it does not
 * duplicate the `getOverview()` the overview page already makes — the two never
 * happen in the same request. That is also why the query count here is not
 * something to economise on.
 *
 * Returns null when there is nothing to talk about. A user with no accounts
 * sees the overview's empty state, which never mounts the card.
 */
export async function collectSnapshot(now = new Date()): Promise<RecommendationSnapshot | null> {
  const supabase = await createClient();

  const [overview, budgets, goals, { data: accounts }, { data: balances }, { data: cards }, { data: loans }] =
    await Promise.all([
      getOverview(),
      getBudgetOverview(monthStart(now)),
      getGoalsOverview(),
      supabase.from("accounts").select("id,name,type,currency").eq("is_archived", false),
      supabase.from("account_balances").select("account_id,balance"),
      supabase.from("card_status").select("account_id,owed"),
      supabase.from("loan_status").select("currency,outstanding_balance,installment_amount"),
    ]);

  if (!overview.hasAccounts) return null;

  /* A card's `account_balances` row is not what it owes — `card_status.owed`
     is — and net worth already subtracts it. Cards are given as a NEGATIVE
     balance so the model reads a wallet as one list of positions rather than
     having to know which types invert. */
  const owedByCard = new Map((cards ?? []).map((c) => [c.account_id, Number(c.owed ?? 0)]));
  const balanceByAccount = new Map((balances ?? []).map((b) => [b.account_id, Number(b.balance)]));

  return buildSnapshot({
    now,
    overview,
    budgets: budgets.rows,
    goals: goals.goals,
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: owedByCard.has(a.id) ? -(owedByCard.get(a.id) ?? 0) : (balanceByAccount.get(a.id) ?? 0),
    })),
    loans: (loans ?? []).map((l) => ({
      currency: l.currency ?? overview.baseCurrency,
      outstanding: Number(l.outstanding_balance ?? 0),
      installment: Number(l.installment_amount ?? 0),
    })),
  });
}
