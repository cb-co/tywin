import { createClient } from "@/lib/supabase/server";
import { addMonths, monthStart, shortMonth } from "@/lib/budgets/month";
import { getExchangeRates, convertToBase } from "@/lib/fx";

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

export type Insights = {
  baseCurrency: string;
  distribution: { name: string; value: number; color: string }[];
  budgetBars: { name: string; used: number; budget: number }[];
  trend: { month: string; income: number; expense: number; net: number }[];
  utilization: { id: string; name: string; pct: number; currency: string }[];
  loans: { id: string; name: string; paidPct: number; currency: string }[];
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
    supabase.from("card_status").select("account_id,currency,utilization_pct"),
    supabase
      .from("loan_status")
      .select(
        "account_id,currency,principal,outstanding_balance,progress_installments_paid,progress_term_months",
      ),
    supabase.from("categories").select("id,name,color"),
    supabase.from("accounts").select("id,name"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("transactions")
      .select("base_total_amount,occurred_at")
      .in("type", ["expense", "payment"])
      .eq("exclude_from_budget", false)
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

  const baseCurrency = profile?.base_currency ?? "USD";

  const utilization = (cards ?? [])
    .filter((c) => c.utilization_pct != null)
    .map((c) => ({
      id: c.account_id ?? "",
      name: acctById.get(c.account_id ?? "") ?? "Card",
      pct: Number(c.utilization_pct),
      currency: c.currency ?? baseCurrency,
    }));

  const loanRows = (loans ?? []).map((l) => {
    const principal = Number(l.principal ?? 0);
    const outstanding = Number(l.outstanding_balance ?? 0);
    const paidPct =
      l.progress_term_months && l.progress_term_months > 0
        ? (Number(l.progress_installments_paid ?? 0) / l.progress_term_months) * 100
        : principal > 0
          ? ((principal - outstanding) / principal) * 100
          : 0;
    return {
      id: l.account_id ?? "",
      name: acctById.get(l.account_id ?? "") ?? "Loan",
      paidPct: Math.max(0, Math.min(paidPct, 100)),
      currency: l.currency ?? baseCurrency,
    };
  });

  return {
    baseCurrency,
    distribution,
    budgetBars,
    trend,
    utilization,
    loans: loanRows,
    totalSpend: distribution.reduce((s, d) => s + d.value, 0),
    pace,
  };
}

export type CardPaymentLine = {
  accountId: string;
  name: string;
  currency: string;
  amount: number; // native (card currency)
  baseAmount: number;
};

export type CardPayments = {
  baseCurrency: string;
  lines: CardPaymentLine[];
  totalBase: number;
};

/** Sum of payments made *to* credit cards this month — what actually left your
 *  accounts to settle card balances. This totals every payment regardless of
 *  category, independent of category_usage/spend_distribution (which now
 *  count *categorized* card payments toward budget instead of excluding
 *  them; see 20260731130000_card_payment_default_and_cashflow.sql). */
export async function getCardPayments(month: string): Promise<CardPayments> {
  const supabase = await createClient();
  const [{ data: profile }, { data: cards }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase.from("accounts").select("id,name,currency").eq("type", "credit_card"),
  ]);

  const baseCurrency = profile?.base_currency ?? "USD";
  const cardIds = (cards ?? []).map((c) => c.id);

  const { data: rows } = cardIds.length
    ? await supabase
        .from("transactions")
        .select("to_account_id,amount,to_amount,base_amount")
        .eq("type", "payment")
        .in("to_account_id", cardIds)
        .gte("occurred_at", month)
        .lt("occurred_at", addMonths(month, 1))
    : { data: [] };

  const cardById = new Map((cards ?? []).map((c) => [c.id, c]));
  const totals = new Map<string, { amount: number; baseAmount: number }>();
  for (const r of rows ?? []) {
    const id = r.to_account_id;
    if (!id) continue;
    const prev = totals.get(id) ?? { amount: 0, baseAmount: 0 };
    prev.amount += Number(r.to_amount ?? r.amount ?? 0);
    prev.baseAmount += Number(r.base_amount ?? 0);
    totals.set(id, prev);
  }

  const lines: CardPaymentLine[] = Array.from(totals.entries())
    .map(([accountId, t]) => {
      const card = cardById.get(accountId);
      return {
        accountId,
        name: card?.name ?? "Card",
        currency: card?.currency ?? baseCurrency,
        amount: t.amount,
        baseAmount: t.baseAmount,
      };
    })
    .sort((a, b) => b.baseAmount - a.baseAmount);

  return {
    baseCurrency,
    lines,
    totalBase: lines.reduce((s, l) => s + l.baseAmount, 0),
  };
}

export interface CostOfCarryLine {
  accountId: string;
  name: string; // "Group — Line" when grouped, else account name
  currency: string;
  periodEnd: string;
  apr: number | null;
  avgDailyBalance: number | null;
  costOfCarry: number | null; // native currency
  costOfCarryBase: number | null; // base currency
}

export interface CostOfCarry {
  baseCurrency: string;
  lines: CostOfCarryLine[];
  totalBase: number; // Σ costOfCarryBase
}

export async function getCostOfCarry(): Promise<CostOfCarry> {
  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("card_cost_of_carry")
      .select(
        "account_id,name,currency,group_name,period_end,interest_rate_annual,avg_daily_balance,cost_of_carry",
      ),
  ]);
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);

  const lines: CostOfCarryLine[] = (rows ?? []).map((r) => {
    const carry = r.cost_of_carry === null ? null : Number(r.cost_of_carry);
    const currency = r.currency ?? baseCurrency;
    return {
      accountId: r.account_id ?? "",
      name: r.group_name ? `${r.group_name} — ${r.name ?? "Card"}` : (r.name ?? "Card"),
      currency,
      periodEnd: r.period_end ?? "",
      apr: r.interest_rate_annual === null ? null : Number(r.interest_rate_annual),
      avgDailyBalance: r.avg_daily_balance === null ? null : Number(r.avg_daily_balance),
      costOfCarry: carry,
      costOfCarryBase: carry === null ? null : convertToBase(carry, currency, baseCurrency, rates),
    };
  });
  return {
    baseCurrency,
    lines,
    totalBase: lines.reduce((s, l) => s + (l.costOfCarryBase ?? 0), 0),
  };
}

export type CashbackLine = {
  accountId: string;
  name: string;
  currency: string;
  total: number;
};
export type CashbackByCard = {
  year: number;
  lines: CashbackLine[];
};

/**
 * Cashback earned per credit line, this calendar year.
 *
 * Summed over statements rather than accumulated onto the account, which is
 * what makes a re-uploaded statement harmless: `card_statements` is unique on
 * (account_id, period_end) and the import replaces the row it already has, so
 * the same PDF twice overwrites instead of adding. See lib/accounts/cashback.ts.
 *
 * Totals stay in each card's OWN currency and are never converted. Cashback is
 * money the issuer credited to that specific line — a DOP line's rebate is paid
 * in pesos and a USD line's in dollars — so adding them through today's FX rate
 * would invent a figure no statement ever printed. The card renders one row per
 * line, each labelled with its own currency, and prints no grand total.
 *
 * Cards whose statements never reported a figure are omitted entirely: every
 * statement imported before the column existed carries null, and a row reading
 * "RD$0.00" would state a zero the data cannot vouch for.
 */
export async function getCashbackByCard(): Promise<CashbackByCard> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: statements }, { data: accounts }, { data: groups }] = await Promise.all([
    supabase
      .from("card_statements")
      .select("account_id,cashback_total")
      .gte("period_end", `${year}-01-01`)
      .lte("period_end", `${year}-12-31`)
      .not("cashback_total", "is", null),
    supabase
      .from("accounts")
      .select("id,name,currency,card_group_id")
      .eq("type", "credit_card"),
    supabase.from("card_groups").select("id,name"),
  ]);

  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const totals = new Map<string, number>();
  for (const s of statements ?? []) {
    if (!s.account_id) continue;
    totals.set(s.account_id, (totals.get(s.account_id) ?? 0) + Number(s.cashback_total ?? 0));
  }

  const lines: CashbackLine[] = (accounts ?? [])
    .filter((a) => totals.has(a.id))
    .map((a) => ({
      accountId: a.id,
      // Same label shape the cost-of-carry card uses, so a card group's two
      // currency lines are told apart the same way on both.
      name: a.card_group_id && groupName.has(a.card_group_id)
        ? `${groupName.get(a.card_group_id)} — ${a.name}`
        : a.name,
      currency: a.currency,
      total: totals.get(a.id) ?? 0,
    }))
    .sort((x, y) => y.total - x.total);

  return { year, lines };
}

export function sumTransferCosts(
  rows: { fee_amount: number | null; tax_amount: number | null; exchange_rate: number | null }[],
): { totalFeesBase: number; totalTaxBase: number } {
  let totalFeesBase = 0;
  let totalTaxBase = 0;
  for (const r of rows) {
    const rate = Number(r.exchange_rate ?? 1);
    totalFeesBase += Number(r.fee_amount ?? 0) * rate;
    totalTaxBase += Number(r.tax_amount ?? 0) * rate;
  }
  return {
    totalFeesBase: Math.round(totalFeesBase * 100) / 100,
    totalTaxBase: Math.round(totalTaxBase * 100) / 100,
  };
}
