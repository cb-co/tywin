import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { baseCurrencyOf } from "@/lib/profile";
import { nextChargeDate, monthlyEquivalent, type BillingCycle } from "@/lib/subscriptions/cycle";
import { getExchangeRates, convertToBase, unconvertedCurrencies } from "@/lib/fx";
import { cardAmountDue, dayAfter } from "./card-due";
import { importPromptState, type ImportPrompt } from "./import-prompt";
import { currentPeriod } from "@/lib/period/profile";
import type { Period } from "@/lib/period/cycle";
import { computeAvailable, type Available } from "./available";
import { computeFunding, type ContributionRow } from "@/lib/goals/funding";

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
  importPrompt: ImportPrompt;
  /** Currencies that went into the totals above at a 1:1 fallback rate because
   *  the FX table was unavailable. Empty on every single-currency account set,
   *  which is why the page can render the warning unconditionally on it. */
  fxUnconverted: string[];
  /** The pay-cycle period `today` falls in. A monthly profile's period is
   *  exactly the calendar month, which is what keeps this build byte-for-byte
   *  identical to today's app for every profile that hasn't opted into a
   *  quincena. */
  period: Period;
  /** "Disponible hasta el <payday>" — composed from the rows above, not
   *  queried separately. See lib/overview/available.ts. */
  available: Available;
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

  // The period must be resolved before the range RPCs below can run, so the
  // profile is read on its own first rather than folded into the Promise.all.
  // One extra round trip on the most-viewed page is worth less than a period
  // that's wrong for everyone on it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency,display_name,pay_cycle,pay_anchor_day")
    .maybeSingle();

  const period = currentPeriod(profile, new Date().toISOString().slice(0, 10));

  const [
    { data: cashflowRows },
    { data: usage },
    { data: accounts },
    { data: balances },
    { data: cards },
    { data: loans },
    { data: subs },
    { data: contributions },
  ] = await Promise.all([
    supabase.rpc("cashflow_range", { p_start: period.start, p_end: period.end }),
    supabase.rpc("category_usage_range", { p_start: period.start, p_end: period.end }),
    supabase.from("accounts").select("id,name,currency,type").eq("is_archived", false),
    supabase.from("account_balances").select("account_id,currency,balance"),
    supabase
      .from("card_status")
      .select(
        "account_id,currency,owed,latest_statement_balance,latest_due_date,latest_period_end,payment_due_day,latest_minimum_payment",
      ),
    supabase.from("loan_status").select("account_id,currency,outstanding_balance,installment_amount,payment_due_day"),
    supabase
      .from("subscriptions")
      .select("id,name,amount,currency,billing_cycle,anchor_day,is_active")
      .eq("is_active", true),
    // The full set, never scoped to a single account — computeFunding's
    // borrow-back allocation depends on every goal sharing an account. See the
    // same comment in lib/goals/queries.ts:147.
    supabase.from("goal_contributions").select("id,goal_id,account_id,amount,base_amount,occurred_at"),
  ]);

  // cashflow_range always returns exactly one row (its sums are coalesced),
  // but a table-returning RPC is typed as an array.
  const cashflow = (cashflowRows ?? [])[0];

  const baseCurrency = baseCurrencyOf(profile);
  const [rates, cardPaid] = await Promise.all([
    getExchangeRates(baseCurrency),
    statementPaymentsByCard(supabase, cards ?? []),
  ]);
  const toBase = (amount: number, currency: string) => convertToBase(amount, currency, baseCurrency, rates);
  // Only the rows that actually feed a base-currency total: `upcoming` shows
  // each amount in its own currency, so a missing rate costs it nothing.
  const fxUnconverted = unconvertedCurrencies(
    [
      ...(balances ?? []).map((b) => b.currency),
      ...(cards ?? []).map((c) => c.currency),
      ...(loans ?? []).map((l) => l.currency),
      ...(subs ?? []).map((s) => s.currency),
    ],
    baseCurrency,
    rates,
  );
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

  const contributionRows: ContributionRow[] = (contributions ?? []).map((c) => ({
    id: c.id,
    goal_id: c.goal_id,
    account_id: c.account_id,
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    occurred_at: c.occurred_at,
  }));

  // All contributions and all balances, never scoped to the accounts this
  // page happens to render — see the comment on the goal_contributions query
  // above.
  const funding = computeFunding(
    contributionRows,
    (balances ?? []).map((b) => ({ account_id: b.account_id!, balance: Number(b.balance) })),
  );

  const available = computeAvailable({
    periodEnd: period.end,
    toBase,
    accounts: (accounts ?? []).map((a) => {
      // funding.accounts is keyed off the balance rows, so every account with
      // a balance has an entry. An account with no contributions has
      // committed 0.
      const f = funding.accounts.get(a.id);
      return {
        accountId: a.id,
        type: a.type,
        balance: f?.balance ?? Number((balances ?? []).find((b) => b.account_id === a.id)?.balance ?? 0),
        committed: f?.committed ?? 0,
        currency: a.currency,
      };
    }),
    cards: (cards ?? []).map((c) => ({
      accountId: c.account_id ?? "",
      name: acctById.get(c.account_id ?? "")?.name ?? "",
      currency: c.currency ?? baseCurrency,
      statementBalance: c.latest_statement_balance,
      owed: c.owed,
      paidSinceStatement: cardPaid.get(c.account_id ?? "") ?? 0,
      minimumPayment: c.latest_minimum_payment,
    })),
    loans: (loans ?? []).map((l) => ({
      amount: Number(l.installment_amount ?? 0),
      currency: l.currency ?? baseCurrency,
      date: nextDue(l.payment_due_day)?.toISOString().slice(0, 10) ?? null,
    })),
    subscriptions: (subs ?? []).map((s) => ({
      amount: Number(s.amount),
      currency: s.currency,
      date: nextChargeDate(s.billing_cycle as BillingCycle, s.anchor_day)?.toISOString().slice(0, 10) ?? null,
    })),
    fxUnconverted,
  });

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
    importPrompt: importPromptState(cards ?? []),
    fxUnconverted,
    period,
    available,
  };
}
