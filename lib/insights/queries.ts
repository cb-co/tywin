import { createClient } from "@/lib/supabase/server";
import { addMonths, monthStart } from "@/lib/budgets/month";

function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const CHART_FALLBACK = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function shortMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

export type Insights = {
  baseCurrency: string;
  distribution: { name: string; value: number; color: string }[];
  budgetBars: { name: string; used: number; budget: number }[];
  trend: { month: string; income: number; expense: number; net: number }[];
  utilization: { name: string; pct: number }[];
  loans: { name: string; paidPct: number }[];
  totalSpend: number;
  pace: { day: number; thisMonth: number | null; lastMonth: number | null }[];
};

export async function getInsights(month: string): Promise<Insights> {
  const supabase = await createClient();
  const [
    { data: dist },
    { data: usage },
    { data: cashflow },
    { data: cards },
    { data: loans },
    { data: cats },
    { data: accounts },
    { data: profile },
    { data: expenses },
  ] = await Promise.all([
    supabase.rpc("spend_distribution", { p_month: month }),
    supabase.rpc("category_usage", { p_month: month }),
    supabase.from("monthly_cashflow").select("*").order("month"),
    supabase.from("card_status").select("account_id,utilization_pct"),
    supabase.from("loan_status").select("account_id,principal,outstanding_balance,installments_paid,term_months"),
    supabase.from("categories").select("id,name,color"),
    supabase.from("accounts").select("id,name"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("transactions")
      .select("base_total_amount,occurred_at")
      .eq("type", "expense")
      .eq("budget_only", false)
      .gte("occurred_at", addMonths(month, -1))
      .lt("occurred_at", addMonths(month, 1)),
  ]);

  // Cumulative spend by day-of-month, this month vs last.
  const prevMonth = addMonths(month, -1);
  const thisArr = new Array(31).fill(0);
  const lastArr = new Array(31).fill(0);
  for (const e of expenses ?? []) {
    const d = new Date(e.occurred_at);
    const iso = monthStart(d);
    const day = d.getDate();
    if (iso === month) thisArr[day - 1] += Number(e.base_total_amount ?? 0);
    else if (iso === prevMonth) lastArr[day - 1] += Number(e.base_total_amount ?? 0);
  }
  const thisDays = daysInMonth(month);
  const lastDays = daysInMonth(prevMonth);
  const pace: Insights["pace"] = [];
  let ct = 0;
  let cl = 0;
  for (let i = 0; i < 31; i++) {
    ct += thisArr[i];
    cl += lastArr[i];
    pace.push({
      day: i + 1,
      thisMonth: i < thisDays ? Math.round(ct * 100) / 100 : null,
      lastMonth: i < lastDays ? Math.round(cl * 100) / 100 : null,
    });
  }

  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const acctById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const distribution = (dist ?? []).map((d, i) => ({
    name: catById.get(d.category_id ?? "")?.name ?? "Uncategorized",
    value: Number(d.total ?? 0),
    color: catById.get(d.category_id ?? "")?.color ?? CHART_FALLBACK[i % CHART_FALLBACK.length],
  }));

  const budgetBars = (usage ?? [])
    .map((u) => ({
      name: catById.get(u.category_id ?? "")?.name ?? "—",
      used: Number(u.used ?? 0),
      budget: Number(u.budget ?? 0),
    }))
    .filter((b) => b.budget > 0 || b.used > 0)
    .sort((a, b) => b.used - b.budget - (a.used - a.budget))
    .slice(0, 8);

  const trend = (cashflow ?? []).slice(-8).map((c) => ({
    month: shortMonth(c.month ?? month),
    income: Number(c.income ?? 0),
    expense: Number(c.expense ?? 0),
    net: Number(c.net ?? 0),
  }));

  const utilization = (cards ?? [])
    .filter((c) => c.utilization_pct != null)
    .map((c) => ({ name: acctById.get(c.account_id ?? "") ?? "Card", pct: Number(c.utilization_pct) }));

  const loanRows = (loans ?? []).map((l) => {
    const principal = Number(l.principal ?? 0);
    const outstanding = Number(l.outstanding_balance ?? 0);
    const paidPct =
      l.term_months && l.term_months > 0
        ? (Number(l.installments_paid ?? 0) / l.term_months) * 100
        : principal > 0
          ? ((principal - outstanding) / principal) * 100
          : 0;
    return { name: acctById.get(l.account_id ?? "") ?? "Loan", paidPct: Math.max(0, Math.min(paidPct, 100)) };
  });

  return {
    baseCurrency: profile?.base_currency ?? "USD",
    distribution,
    budgetBars,
    trend,
    utilization,
    loans: loanRows,
    totalSpend: distribution.reduce((s, d) => s + d.value, 0),
    pace,
  };
}
