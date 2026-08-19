import { createClient } from "@/lib/supabase/server";
import { baseCurrencyOf } from "@/lib/profile";

export type BudgetStatus = "within" | "approaching" | "over";

export type BudgetRow = {
  category_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  budget: number;
  used: number;
  remaining: number;
  status: BudgetStatus;
};

export type BudgetOverview = {
  rows: BudgetRow[];
  totalBudget: number;
  totalUsed: number;
  baseCurrency: string;
  /** Spend with no category this month — expense/payment rows excluded from
   *  budget stay out, mirroring category_usage's inclusion rule exactly (see
   *  uncategorized_spend in 20260819131444_null_category_triage.sql), so the
   *  two figures can never disagree about what counts as spending. */
  uncategorized: number;
  /** The newest import that still has an uncategorised line, so the figure
   *  above can link somewhere useful. Null when every leftover is a
   *  subscription charge (design §1c / §2) — triage has nothing to offer
   *  those, so the figure renders as plain text instead. */
  pendingTriageImportId: string | null;
};

export async function getBudgetOverview(month: string): Promise<BudgetOverview> {
  const supabase = await createClient();
  const [{ data: usage }, { data: categories }, { data: profile }, { data: uncategorized }, pendingTriageImportId] =
    await Promise.all([
      supabase.rpc("category_usage", { p_month: month }),
      supabase.from("categories").select("id,name,emoji,color").order("sort_order"),
      supabase.from("profiles").select("base_currency").maybeSingle(),
      supabase.rpc("uncategorized_spend", { p_month: month }),
      getPendingTriageImportId(supabase),
    ]);

  const usageByCat = new Map((usage ?? []).map((u) => [u.category_id, u]));

  const rows: BudgetRow[] = (categories ?? []).map((c) => {
    const u = usageByCat.get(c.id);
    return {
      category_id: c.id,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      budget: Number(u?.budget ?? 0),
      used: Number(u?.used ?? 0),
      remaining: Number(u?.remaining ?? 0),
      status: (u?.status ?? "within") as BudgetStatus,
    };
  });

  return {
    rows,
    totalBudget: rows.reduce((s, r) => s + r.budget, 0),
    totalUsed: rows.reduce((s, r) => s + r.used, 0),
    baseCurrency: baseCurrencyOf(profile),
    uncategorized: Number(uncategorized ?? 0),
    pendingTriageImportId,
  };
}

/**
 * The newest import that still has at least one uncategorised line — so the
 * budget page's uncategorised figure can be a link to somewhere useful, and
 * not to a triage screen with nothing left on it (the same failure the
 * post-import redirect already avoids by skipping itself when there is
 * nothing to triage).
 *
 * Unlike `getPendingTriageCounts` (lib/accounts/queries.ts), which is scoped
 * to one account's statements and walks forward from every statement line,
 * this one is unscoped across the whole ledger — so it walks backward from
 * `transactions`, starting at the rows that actually still need triage (null
 * category, statement-sourced), and follows each one up to its import. That
 * keeps the fetch bounded by how much is left to do rather than by how much
 * was ever imported. A null-category row with no `statement_line_id` is a
 * subscription charge (design §1c) and is deliberately excluded — triage
 * cannot help it, and it must never make this function return an import that
 * has nothing left in it.
 */
async function getPendingTriageImportId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from("transactions")
    .select(
      "statement_line:card_statement_lines!transactions_statement_line_id_fkey(statement:card_statements(import:statement_imports(id,created_at)))",
    )
    .is("category_id", null)
    .not("statement_line_id", "is", null);

  let newest: { id: string; created_at: string } | null = null;
  for (const r of rows ?? []) {
    const imp = r.statement_line?.statement?.import;
    if (!imp) continue;
    if (!newest || imp.created_at > newest.created_at) newest = imp;
  }
  return newest?.id ?? null;
}
