import { createClient } from "@/lib/supabase/server";

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
};

export async function getBudgetOverview(month: string): Promise<BudgetOverview> {
  const supabase = await createClient();
  const [{ data: usage }, { data: categories }, { data: profile }] = await Promise.all([
    supabase.rpc("category_usage", { p_month: month }),
    supabase.from("categories").select("id,name,emoji,color").order("sort_order"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
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
    baseCurrency: profile?.base_currency ?? "USD",
  };
}
