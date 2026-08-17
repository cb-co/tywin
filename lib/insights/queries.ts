import { createClient } from "@/lib/supabase/server";
import { addMonths, monthStart, shortMonth } from "@/lib/budgets/month";
import { getExchangeRates, convertToBase } from "@/lib/fx";
import { CHART_FALLBACK } from "@/lib/chart-series";
import { splitPayments } from "@/lib/accounts/amortization";
import { loanPaymentAmounts } from "@/lib/insights/net-worth-history";

const round2 = (n: number) => Math.round(n * 100) / 100;

function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

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

export type LoanInterestLine = {
  accountId: string;
  name: string;
  currency: string;
  apr: number | null; // percent, e.g. 12 — matches CostOfCarryLine.apr
  lastPaymentDate: string;
  lastInterest: number; // native (loan currency)
  yearInterest: number; // native
};

export type LoanInterest = {
  year: number;
  baseCurrency: string;
  lines: LoanInterestLine[];
  monthlyBase: number; // Σ lastInterest, in base
  yearBase: number; // Σ yearInterest, in base
};

export type LoanInterestInput = {
  year: number;
  baseCurrency: string;
  rates: Record<string, number>;
  loans: {
    id: string;
    name: string;
    currency: string;
    principal: number;
    interest_rate: number | null;
    term_months: number | null;
  }[];
  /** Every payment into every loan, ever, ordered (occurred_at, created_at, id). */
  payments: { to_account_id: string | null; amount: number; to_amount: number | null; occurred_at: string }[];
};

/**
 * Pure core of getLoanInterest: what each active loan's interest costs, from
 * the payments actually logged against it.
 *
 * Two figures per loan, because they answer different questions. `lastInterest`
 * is the interest inside that loan's most recent payment — one month of carry,
 * which is why summing it across loans gives a monthly run-rate rather than a
 * period total (the same shape getCostOfCarry builds from each card's newest
 * statement). `yearInterest` is a period total: every payment dated in `year`.
 *
 * The split always runs from the loan's first payment, not from the start of
 * the year, because each payment's interest depends on the balance the earlier
 * ones left. Filtering the payments first would charge January's payment
 * interest on the full principal.
 *
 * A loan only appears once it has a payment to report and while it still owes
 * something. A paid-off loan costs nothing to carry, and a loan with no logged
 * payment has no interest this app can vouch for — the same reason
 * getCashbackByCard omits cards whose statements never reported a figure.
 *
 * Caveat this cannot fix: payments made before the loan was added to the app
 * are not transactions, so `yearInterest` covers the tracked part of the year
 * only. The card labels it as such rather than implying a full year.
 */
export function buildLoanInterest(input: LoanInterestInput): LoanInterest {
  const { year, baseCurrency, rates } = input;
  const toBase = (amount: number, currency: string) =>
    convertToBase(amount, currency || baseCurrency, baseCurrency, rates);

  const lines: LoanInterestLine[] = [];
  for (const loan of input.loans) {
    const split = splitPayments({
      principal: Number(loan.principal ?? 0),
      annualRate: loan.interest_rate,
      termMonths: loan.term_months,
      payments: loanPaymentAmounts(input.payments.filter((p) => p.to_account_id === loan.id)),
    });
    const last = split.at(-1);
    if (!last || last.balance <= 0) continue;

    lines.push({
      accountId: loan.id,
      name: loan.name,
      currency: loan.currency || baseCurrency,
      apr: loan.interest_rate === null ? null : round2(Number(loan.interest_rate) * 100),
      lastPaymentDate: last.date,
      lastInterest: last.interest,
      yearInterest: round2(
        split
          .filter((s) => s.date.startsWith(`${year}-`))
          .reduce((sum, s) => sum + s.interest, 0),
      ),
    });
  }

  lines.sort((a, b) => toBase(b.lastInterest, b.currency) - toBase(a.lastInterest, a.currency));

  return {
    year,
    baseCurrency,
    lines,
    monthlyBase: round2(lines.reduce((s, l) => s + toBase(l.lastInterest, l.currency), 0)),
    yearBase: round2(lines.reduce((s, l) => s + toBase(l.yearInterest, l.currency), 0)),
  };
}

/** What each active loan's interest costs — see buildLoanInterest for the rules. */
export async function getLoanInterest(): Promise<LoanInterest> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: profile }, { data: loans }] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    supabase
      .from("accounts")
      .select("id,name,currency,principal,interest_rate,term_months")
      .eq("type", "loan")
      .eq("is_archived", false),
  ]);

  const baseCurrency = profile?.base_currency ?? "USD";
  const loanIds = (loans ?? []).map((l) => l.id);
  if (loanIds.length === 0) {
    return { year, baseCurrency, lines: [], monthlyBase: 0, yearBase: 0 };
  }

  const [rates, payments] = await Promise.all([
    getExchangeRates(baseCurrency),
    fetchAllLoanPayments(supabase, loanIds),
  ]);

  return buildLoanInterest({
    year,
    baseCurrency,
    rates,
    loans: (loans ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      currency: l.currency,
      principal: Number(l.principal ?? 0),
      interest_rate: l.interest_rate === null ? null : Number(l.interest_rate),
      term_months: l.term_months,
    })),
    payments,
  });
}

/**
 * Every payment into these loans, oldest first, ordered the way `loan_status`
 * orders them so the interest split lands on the same balances that view does.
 *
 * Paged rather than fetched in one request, and for a stronger reason than the
 * transfer-costs total: that one merely under-reports when PostgREST silently
 * truncates at `max_rows`. Here a missing early payment shifts the balance
 * every later payment is charged on, so a truncated fetch would report wrong
 * interest for the payments it *did* read.
 */
async function fetchAllLoanPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loanIds: string[],
): Promise<LoanInterestInput["payments"]> {
  const PAGE_SIZE = 1000;
  const rows: LoanInterestInput["payments"] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("to_account_id,amount,to_amount,occurred_at")
      .eq("type", "payment")
      .in("to_account_id", loanIds)
      .order("occurred_at")
      .order("created_at")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
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

/** Groups cashback lines by currency and sums each group's total — the pure
 *  arithmetic behind the per-currency total rows the insights page renders
 *  under the Cashback card's line list. */
export function sumCashbackByCurrency(lines: { currency: string; total: number }[]): [string, number][] {
  return Object.entries(
    lines.reduce<Record<string, number>>((acc, l) => {
      acc[l.currency] = (acc[l.currency] ?? 0) + l.total;
      return acc;
    }, {}),
  );
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

export type TransferCosts = {
  year: number;
  baseCurrency: string;
  totalFeesBase: number;
  totalTaxBase: number;
};

/**
 * Fees and tax paid to move money between your own accounts this calendar
 * year — the `payment`-type transactions' `fee_amount`/`tax_amount`
 * (see transactions_compute_amounts() in
 * supabase/migrations/20260717234227_transactions.sql). Converted to base
 * currency using each transaction's own stored exchange_rate, not today's
 * live rate — the same rate base_amount was derived from, so this doesn't
 * restate history through a rate that didn't apply at the time.
 *
 * fee_amount/tax_amount are populated for `payment`-type transactions — see
 * transactions_compute_amounts() — though other transaction types can carry
 * a fee_amount too when include_commission is set; this card counts only
 * transfers between your own accounts, so the type filter is deliberate,
 * not redundant.
 */
export async function getTransferCosts(): Promise<TransferCosts> {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [{ data: profile }, rows] = await Promise.all([
    supabase.from("profiles").select("base_currency").maybeSingle(),
    fetchAllTransferRows(supabase, year),
  ]);

  const baseCurrency = profile?.base_currency ?? "USD";
  const { totalFeesBase, totalTaxBase } = sumTransferCosts(rows);

  return { year, baseCurrency, totalFeesBase, totalTaxBase };
}

/**
 * PostgREST caps any single request at `max_rows` (1000, see
 * supabase/config.toml) — silently, with no error, just a truncated result.
 * A year with more than 1000 qualifying payments would otherwise under-report
 * the fees/tax total without any signal that it happened, so this pages
 * through with `.range()` until a page comes back short of PAGE_SIZE.
 */
async function fetchAllTransferRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
): Promise<Parameters<typeof sumTransferCosts>[0]> {
  const PAGE_SIZE = 1000;
  const rows: Parameters<typeof sumTransferCosts>[0] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("transactions")
      .select("fee_amount,tax_amount,exchange_rate")
      .eq("type", "payment")
      .gte("occurred_at", `${year}-01-01`)
      .lt("occurred_at", `${year + 1}-01-01`)
      .range(offset, offset + PAGE_SIZE - 1);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}
