import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { baseCurrencyOf } from "@/lib/profile";
import { monthStart } from "@/lib/budgets/month";
import { nextChargeDate, monthlyEquivalent, type BillingCycle } from "@/lib/subscriptions/cycle";
import { getExchangeRates, convertToBase } from "@/lib/fx";
import { cardAmountDue, dayAfter } from "./card-due";

export type UpcomingItem = {
  key: string;
  date: string; // ISO date
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
};

export type Overview = {
  hasAccounts: boolean;
  baseCurrency: string;
  displayName: string | null;
  netWorth: number;
  monthIncome: number;
  monthExpense: number;
  totalBudget: number;
  totalUsed: number;
  monthlySubscriptions: number;
  upcoming: UpcomingItem[];
};

function nextDue(day: number | null, from = new Date()): Date | null {
  return nextChargeDate("monthly", day, from);
}

type CardRow = {
  account_id: string | null;
  latest_statement_balance: number | null;
  latest_period_end: string | null;
};

/** Payments made against each card's latest statement, in the card's own
 *  currency — i.e. transactions into the card dated after that statement
 *  closed. Anything on or before the closing date is already netted into
 *  `statement_balance`, and later charges belong to the next statement, so its
 *  closing date is the only correct cut-off. Mirrors the coalesce the balance
 *  views use for the destination leg (20260720093500_payment_destination_amount).
 */
async function statementPaymentsByCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cards: CardRow[],
): Promise<Map<string, number>> {
  const settled = cards.filter(
    (c): c is CardRow & { account_id: string; latest_period_end: string } =>
      !!c.account_id && !!c.latest_period_end && c.latest_statement_balance != null,
  );
  if (settled.length === 0) return new Map();

  // One round trip for every card: filter from the earliest cut-off, then
  // apply each card's own cut-off in memory.
  const earliest = settled.reduce(
    (min, c) => (c.latest_period_end < min ? c.latest_period_end : min),
    settled[0].latest_period_end,
  );

  const { data: rows } = await supabase
    .from("transactions")
    .select("to_account_id,amount,to_amount,occurred_at")
    .eq("type", "payment")
    .in(
      "to_account_id",
      settled.map((c) => c.account_id),
    )
    .gte("occurred_at", dayAfter(earliest));

  const cutoff = new Map(settled.map((c) => [c.account_id, dayAfter(c.latest_period_end)]));
  const paid = new Map<string, number>();
  for (const r of rows ?? []) {
    const id = r.to_account_id;
    if (!id) continue;
    const from = cutoff.get(id);
    if (!from || r.occurred_at.slice(0, 10) < from) continue;
    paid.set(id, (paid.get(id) ?? 0) + Number(r.to_amount ?? r.amount ?? 0));
  }
  return paid;
}

export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const month = monthStart();

  const [
    { data: profile },
    { data: cashflow },
    { data: usage },
    { data: accounts },
    { data: balances },
    { data: cards },
    { data: loans },
    { data: subs },
  ] = await Promise.all([
    supabase.from("profiles").select("base_currency,display_name").maybeSingle(),
    supabase.from("monthly_cashflow").select("income,expense").eq("month", month).maybeSingle(),
    supabase.rpc("category_usage", { p_month: month }),
    supabase.from("accounts").select("id,name,currency").eq("is_archived", false),
    supabase.from("account_balances").select("account_id,currency,balance"),
    supabase
      .from("card_status")
      .select(
        "account_id,currency,owed,latest_statement_balance,latest_due_date,latest_period_end,payment_due_day",
      ),
    supabase.from("loan_status").select("account_id,currency,outstanding_balance,installment_amount,payment_due_day"),
    supabase
      .from("subscriptions")
      .select("id,name,amount,currency,billing_cycle,anchor_day,is_active")
      .eq("is_active", true),
  ]);

  const baseCurrency = baseCurrencyOf(profile);
  const [rates, cardPaid] = await Promise.all([
    getExchangeRates(baseCurrency),
    statementPaymentsByCard(supabase, cards ?? []),
  ]);
  const toBase = (amount: number, currency: string) => convertToBase(amount, currency, baseCurrency, rates);
  const t = await getTranslations("Overview");

  const acctById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const usageRows = usage ?? [];

  const netWorth =
    (balances ?? []).reduce((s, b) => s + toBase(Number(b.balance), b.currency ?? baseCurrency), 0) -
    (cards ?? []).reduce((s, c) => s + toBase(Number(c.owed ?? 0), c.currency ?? baseCurrency), 0) -
    (loans ?? []).reduce(
      (s, l) => s + toBase(Number(l.outstanding_balance ?? 0), l.currency ?? baseCurrency),
      0,
    );

  const upcoming: UpcomingItem[] = [];

  for (const c of cards ?? []) {
    // Null once the statement is settled — the row then drops off until the
    // next import brings a fresh balance and due date. A card left unpaid keeps
    // showing its real, overdue date, which is the point.
    const amount = cardAmountDue(c.latest_statement_balance, c.owed, cardPaid.get(c.account_id ?? "") ?? 0);
    const d = c.latest_due_date ? new Date(c.latest_due_date) : nextDue(c.payment_due_day);
    const acct = acctById.get(c.account_id ?? "");
    if (d && acct && amount != null)
      upcoming.push({
        key: `card-${c.account_id}`,
        date: d.toISOString(),
        title: t("cardPaymentTitle", { name: acct.name }),
        subtitle: t("creditCardSubtitle", { currency: c.currency ?? acct.currency }),
        amount,
        currency: c.currency ?? acct.currency,
      });
  }
  for (const l of loans ?? []) {
    const d = nextDue(l.payment_due_day);
    const acct = acctById.get(l.account_id ?? "");
    if (d && acct)
      upcoming.push({
        key: `loan-${l.account_id}`,
        date: d.toISOString(),
        title: t("loanInstallmentTitle", { name: acct.name }),
        subtitle: t("loanSubtitle", { currency: l.currency ?? acct.currency }),
        amount: Number(l.installment_amount ?? 0),
        currency: l.currency ?? acct.currency,
      });
  }
  for (const s of subs ?? []) {
    const d = nextChargeDate(s.billing_cycle as BillingCycle, s.anchor_day);
    if (d)
      upcoming.push({
        key: `sub-${s.id}`,
        date: d.toISOString(),
        title: s.name,
        subtitle: t("subscriptionSubtitle", { currency: s.currency }),
        amount: Number(s.amount),
        currency: s.currency,
      });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasAccounts: (accounts ?? []).length > 0,
    baseCurrency,
    displayName: profile?.display_name ?? null,
    netWorth,
    monthIncome: Number(cashflow?.income ?? 0),
    monthExpense: Number(cashflow?.expense ?? 0),
    totalBudget: usageRows.reduce((s, u) => s + Number(u.budget ?? 0), 0),
    totalUsed: usageRows.reduce((s, u) => s + Number(u.used ?? 0), 0),
    monthlySubscriptions: (subs ?? []).reduce(
      (s, sub) => s + monthlyEquivalent(toBase(Number(sub.amount), sub.currency), sub.billing_cycle as BillingCycle),
      0,
    ),
    upcoming: upcoming.slice(0, 6),
  };
}
