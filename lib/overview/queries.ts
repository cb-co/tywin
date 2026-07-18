import { createClient } from "@/lib/supabase/server";
import { monthStart } from "@/lib/budgets/month";
import { nextChargeDate, monthlyEquivalent, type BillingCycle } from "@/lib/subscriptions/cycle";

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

export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();
  const month = monthStart();

  const [
    { data: nw },
    { data: cashflow },
    { data: usage },
    { data: accounts },
    { data: cards },
    { data: loans },
    { data: subs },
  ] = await Promise.all([
    supabase.from("net_worth").select("net_worth,base_currency").maybeSingle(),
    supabase.from("monthly_cashflow").select("income,expense").eq("month", month).maybeSingle(),
    supabase.rpc("category_usage", { p_month: month }),
    supabase.from("accounts").select("id,name,currency").eq("is_archived", false),
    supabase.from("card_status").select("account_id,owed,payment_due_day"),
    supabase.from("loan_status").select("account_id,installment_amount,payment_due_day"),
    supabase
      .from("subscriptions")
      .select("id,name,amount,currency,billing_cycle,anchor_day,is_active")
      .eq("is_active", true),
  ]);

  const acctById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const usageRows = usage ?? [];

  const upcoming: UpcomingItem[] = [];

  for (const c of cards ?? []) {
    const d = nextDue(c.payment_due_day);
    const acct = acctById.get(c.account_id ?? "");
    if (d && acct)
      upcoming.push({
        key: `card-${c.account_id}`,
        date: d.toISOString(),
        title: `${acct.name} payment`,
        subtitle: "Credit card",
        amount: Number(c.owed ?? 0),
        currency: acct.currency,
      });
  }
  for (const l of loans ?? []) {
    const d = nextDue(l.payment_due_day);
    const acct = acctById.get(l.account_id ?? "");
    if (d && acct)
      upcoming.push({
        key: `loan-${l.account_id}`,
        date: d.toISOString(),
        title: `${acct.name} installment`,
        subtitle: "Loan",
        amount: Number(l.installment_amount ?? 0),
        currency: acct.currency,
      });
  }
  for (const s of subs ?? []) {
    const d = nextChargeDate(s.billing_cycle as BillingCycle, s.anchor_day);
    if (d)
      upcoming.push({
        key: `sub-${s.id}`,
        date: d.toISOString(),
        title: s.name,
        subtitle: "Subscription",
        amount: Number(s.amount),
        currency: s.currency,
      });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasAccounts: (accounts ?? []).length > 0,
    baseCurrency: nw?.base_currency ?? "USD",
    netWorth: Number(nw?.net_worth ?? 0),
    monthIncome: Number(cashflow?.income ?? 0),
    monthExpense: Number(cashflow?.expense ?? 0),
    totalBudget: usageRows.reduce((s, u) => s + Number(u.budget ?? 0), 0),
    totalUsed: usageRows.reduce((s, u) => s + Number(u.used ?? 0), 0),
    monthlySubscriptions: (subs ?? []).reduce(
      (s, sub) => s + monthlyEquivalent(Number(sub.amount), sub.billing_cycle as BillingCycle),
      0,
    ),
    upcoming: upcoming.slice(0, 6),
  };
}
