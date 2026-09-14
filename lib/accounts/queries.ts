import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getAccountFunding } from "@/lib/goals/queries";
import { addMonths } from "@/lib/budgets/month";
import { buildCardGroupLines, type CardGroupLine } from "./group-lines";
import { cardSpendDistribution, type SpendSlice } from "./card-spend";
import type { FeeLineRow } from "./card-fees";
import { sumAccountTransferCosts, type TransferCostRow } from "./transfer-costs";

export type { CardGroupLine } from "./group-lines";
export type { SpendSlice } from "./card-spend";

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

/**
 * How many lines of each statement still have no category, and which import to
 * send someone to. Keyed by statement id so the panel can render a count per row.
 *
 * Statements with no import (added by hand) are absent from the result: there is
 * no import to triage.
 */
export async function getPendingTriageCounts(
  accountId: string,
): Promise<Record<string, { importId: string; count: number }>> {
  const supabase = await createClient();
  const { data: statements } = await supabase
    .from("card_statements")
    .select("id,import_id")
    .eq("account_id", accountId)
    .not("import_id", "is", null);
  if (!statements || statements.length === 0) return {};

  const { data: lines } = await supabase
    .from("card_statement_lines")
    .select("statement_id,transaction:transactions!card_statement_lines_transaction_id_fkey(category_id)")
    .in("statement_id", statements.map((s) => s.id));

  const counts: Record<string, { importId: string; count: number }> = {};
  for (const s of statements) {
    const n = (lines ?? []).filter(
      (l) => l.statement_id === s.id && l.transaction && l.transaction.category_id === null,
    ).length;
    if (n > 0) counts[s.id] = { importId: s.import_id!, count: n };
  }
  return counts;
}

/**
 * One card's fee lines for one calendar year, ready for summarizeCardFees.
 *
 * Scoped to a single account and needs no FX at all, since the detail page
 * speaks that card's own currency throughout. The classification lives in
 * card-fees.ts, which keeps it testable without a database.
 *
 * Credits come along only to catch reversals — see reversalTarget.
 */
export async function getAccountFeeLines(
  accountId: string,
  year: number,
): Promise<FeeLineRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_statement_lines")
    .select("description,amount,kind,posted_on")
    .eq("account_id", accountId)
    .in("kind", ["fee", "credit"])
    .gte("posted_on", `${year}-01-01`)
    .lte("posted_on", `${year}-12-31`);
  return (data ?? []).map((r) => ({
    description: r.description ?? "",
    amount: Number(r.amount ?? 0),
    kind: r.kind as "fee" | "credit",
    posted_on: r.posted_on ?? "",
  }));
}

/**
 * What a card was charged for in `month`, grouped by category, in the card's
 * own currency.
 *
 * Scoped by `account_id`, so a payment made *to* the card never lands here:
 * settling a balance is not spending. See lib/accounts/card-spend.ts for the
 * inclusion rules the grouping applies on top of this window.
 */
export async function getCardSpendByCategory(
  accountId: string,
  month: string,
  uncategorizedLabel: string,
): Promise<SpendSlice[]> {
  const supabase = await createClient();
  const [{ data: rows }, { data: categories }] = await Promise.all([
    supabase
      .from("transactions")
      .select("category_id,total_amount")
      .eq("account_id", accountId)
      .eq("type", "expense")
      .gte("occurred_at", month)
      .lt("occurred_at", addMonths(month, 1)),
    supabase.from("categories").select("id,name,color"),
  ]);
  return cardSpendDistribution(rows ?? [], categories ?? [], uncategorizedLabel);
}

/**
 * Fees and tax this account paid in `year`, across every transaction type.
 *
 * Not payments only: the trigger that fills fee_amount/tax_amount runs on any
 * type, so an expense from a checking account carries both.
 *
 * Paged because PostgREST caps a request at `max_rows` (1000, see
 * supabase/config.toml) silently — a busy account would under-report with no
 * signal that it had.
 */
export async function getAccountTransferCosts(
  accountId: string,
  year: number,
): Promise<{ fees: number; tax: number }> {
  const supabase = await createClient();
  const PAGE_SIZE = 1000;
  const rows: TransferCostRow[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("fee_amount,tax_amount")
      .eq("account_id", accountId)
      .gte("occurred_at", `${year}-01-01`)
      .lt("occurred_at", `${year + 1}-01-01`)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return sumAccountTransferCosts(rows);
}

export type AccountCostOfCarry = { periodEnd: string; apr: number | null; costOfCarry: number };

/** This card's cost of carry from its newest statement, or null when there is
 *  no statement or the statement printed no figure. The view already picks the
 *  latest statement per line — see card_cost_of_carry. */
export async function getAccountCostOfCarry(accountId: string): Promise<AccountCostOfCarry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_cost_of_carry")
    .select("period_end,interest_rate_annual,cost_of_carry")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!data || data.cost_of_carry === null) return null;
  return {
    periodEnd: data.period_end ?? "",
    apr: data.interest_rate_annual === null ? null : Number(data.interest_rate_annual),
    costOfCarry: Number(data.cost_of_carry),
  };
}

/** What was paid INTO this card during `month` (a "YYYY-MM-01" string), in the
 *  card's own currency — `to_amount` when the payment crossed currencies. */
export async function getCardPaymentsInMonth(accountId: string, month: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("amount,to_amount")
    .eq("type", "payment")
    .eq("to_account_id", accountId)
    .gte("occurred_at", month)
    .lt("occurred_at", addMonths(month, 1));
  const total = (data ?? []).reduce((s, r) => s + Number(r.to_amount ?? r.amount ?? 0), 0);
  return Math.round(total * 100) / 100;
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
