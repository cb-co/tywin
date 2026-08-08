import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getAccountFunding } from "@/lib/goals/queries";
import { buildCardGroupLines, type CardGroupLine } from "./group-lines";

export type { CardGroupLine } from "./group-lines";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type CardRow = Database["public"]["Views"]["card_status"]["Row"];
type LoanRow = Database["public"]["Views"]["loan_status"]["Row"];
export type CurrencyRow = Database["public"]["Tables"]["currencies"]["Row"];
export type CardGroupRow = Database["public"]["Tables"]["card_groups"]["Row"];
export type BankRow = Database["public"]["Tables"]["banks"]["Row"];
export type CardStatementRow = Database["public"]["Tables"]["card_statements"]["Row"];

export type AccountWithStatus = AccountRow & {
  balance: number | null;
  /** Committed to savings goals, in the account's own currency. */
  committed: number;
  /** balance − committed. Never negative unless the balance itself is. */
  available: number;
  cardStatus: CardRow | null;
  loanStatus: LoanRow | null;
};

export async function getAccountsWithStatus(): Promise<AccountWithStatus[]> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: balances }, { data: cards }, { data: loans }, funding] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("is_archived", false)
        .order("sort_order")
        .order("created_at"),
      supabase.from("account_balances").select("*"),
      supabase.from("card_status").select("*"),
      supabase.from("loan_status").select("*"),
      getAccountFunding(),
    ]);

  const balByAcct = new Map((balances ?? []).map((b) => [b.account_id, b.balance]));
  const cardByAcct = new Map((cards ?? []).map((c) => [c.account_id, c]));
  const loanByAcct = new Map((loans ?? []).map((l) => [l.account_id, l]));

  return (accounts ?? []).map((a) => {
    const balance = balByAcct.get(a.id) ?? a.starting_balance;
    const f = funding.get(a.id);
    return {
      ...a,
      balance,
      committed: f?.committed ?? 0,
      available: f?.available ?? balance,
      cardStatus: cardByAcct.get(a.id) ?? null,
      loanStatus: loanByAcct.get(a.id) ?? null,
    };
  });
}

export async function getAccountById(id: string): Promise<AccountWithStatus | null> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!account) return null;

  const [{ data: balance }, { data: card }, { data: loan }, funding] = await Promise.all([
    supabase.from("account_balances").select("balance").eq("account_id", id).maybeSingle(),
    supabase.from("card_status").select("*").eq("account_id", id).maybeSingle(),
    supabase.from("loan_status").select("*").eq("account_id", id).maybeSingle(),
    getAccountFunding(),
  ]);

  const resolved = balance?.balance ?? account.starting_balance;
  const f = funding.get(id);

  return {
    ...account,
    balance: resolved,
    committed: f?.committed ?? 0,
    available: f?.available ?? resolved,
    cardStatus: card ?? null,
    loanStatus: loan ?? null,
  };
}

export async function getCurrencies(): Promise<CurrencyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("currencies").select("*").order("code");
  return data ?? [];
}

export async function getCardGroups(): Promise<CardGroupRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("card_groups").select("*").order("name");
  return data ?? [];
}

export async function getBanks(): Promise<BankRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("banks").select("*").order("name");
  return data ?? [];
}

export async function getCardStatements(accountId: string): Promise<CardStatementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statements")
    .select("*")
    .eq("account_id", accountId)
    .order("period_end", { ascending: false });
  return data ?? [];
}

export type CardGroupSibling = {
  id: string;
  currency: string;
  welcome_bonus_goal_amount: number | null;
  welcome_bonus_goal_currency: string | null;
  welcome_bonus_due_date: string | null;
  updated_at: string;
};

const SIBLING_COLUMNS =
  "id, currency, welcome_bonus_goal_amount, welcome_bonus_goal_currency, welcome_bonus_due_date, updated_at";

/** `accountId` plus every other account sharing its card_group_id (or just
 *  itself, if it isn't in a group). Used to resolve the "effective" welcome
 *  bonus goal across a card's currency lines and to sum spend across all of
 *  them. */
export async function getCardGroupSiblings(accountId: string): Promise<CardGroupSibling[]> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select(`${SIBLING_COLUMNS}, card_group_id`)
    .eq("id", accountId)
    .maybeSingle();
  if (!account) return [];
  if (!account.card_group_id) return [account];

  const { data: siblings } = await supabase
    .from("accounts")
    .select(SIBLING_COLUMNS)
    .eq("card_group_id", account.card_group_id)
    .eq("type", "credit_card");
  return siblings ?? [account];
}

/** The currency lines of `accountId`'s card group, for the detail page's rail.
 *
 *  Empty for a card that belongs to no group — there is nothing to navigate
 *  between, and the rail renders nothing. The ordering matches the accounts
 *  grid (`sort_order`, then `created_at`) so a card's lines appear in the same
 *  sequence wherever you meet them. */
export async function getCardGroupLines(accountId: string): Promise<CardGroupLine[]> {
  const supabase = await createClient();
  // The group's name comes along because every segment's label is derived by
  // subtracting it from the line's own name — see `cardLineLabel`.
  const { data: account } = await supabase
    .from("accounts")
    .select("card_group_id, card_groups(name)")
    .eq("id", accountId)
    .maybeSingle();
  if (!account?.card_group_id) return [];

  // Archived lines are filtered in `buildCardGroupLines`, not here: the rule keeps
  // the current line whatever its state, and that is a projection decision the
  // pure helper owns and tests.
  const { data: rows } = await supabase
    .from("accounts")
    .select("id, name, currency, is_archived")
    .eq("card_group_id", account.card_group_id)
    .eq("type", "credit_card")
    .order("sort_order")
    .order("created_at");
  if (!rows) return [];

  return buildCardGroupLines(rows, account.card_groups?.name ?? "", accountId);
}
