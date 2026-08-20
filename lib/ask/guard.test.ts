import { describe, expect, it } from "vitest";
import { guardSql } from "./guard";

/** Convenience: assert rejection and surface the reason when it does not. */
function reject(sql: string): string {
  const r = guardSql(sql);
  if (r.ok) throw new Error(`expected rejection, got ok: ${r.sql}`);
  return r.reason;
}

describe("guardSql — accepts", () => {
  it("a plain select over a whitelisted view", () => {
    const r = guardSql("select sum(budget_spend) from q_transactions");
    expect(r).toEqual({
      ok: true,
      sql: "select sum(budget_spend) from q_transactions",
    });
  });

  it("a schema-qualified relation", () => {
    expect(guardSql("select 1 from public.q_accounts").ok).toBe(true);
  });

  it("joins across whitelisted views with aliases", () => {
    const sql =
      "select a.name, sum(t.budget_spend) from q_transactions t join q_accounts a on a.id = t.account_id group by a.name";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("a CTE, whose own name is not a whitelisted relation", () => {
    const sql =
      "with recent as (select * from q_transactions where occurred_at > '2026-08-01') select count(*) from recent";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("a subquery in the from position", () => {
    const sql = "select * from (select category from q_transactions) s";
    expect(guardSql(sql).ok).toBe(true);
  });

  /* Models end statements with a semicolon out of habit. Rejecting that would
     burn a whole step of the 3-step budget on a formatting nit. */
  it("a trailing semicolon, and strips it", () => {
    const r = guardSql("select 1 from q_budgets;  ");
    expect(r).toEqual({ ok: true, sql: "select 1 from q_budgets" });
  });

  it("strips comments rather than rejecting them", () => {
    const r = guardSql("select 1 from q_budgets -- monthly totals");
    expect(r).toEqual({ ok: true, sql: "select 1 from q_budgets" });
  });
});

describe("guardSql — rejects", () => {
  it.each([
    ["insert into q_transactions values (1)"],
    ["update q_accounts set name = 'x'"],
    ["delete from q_transactions"],
    ["drop view q_transactions"],
    ["truncate q_transactions"],
    ["grant select on q_transactions to anon"],
  ])("the write statement %s", (sql) => {
    expect(reject(sql)).toMatch(/not allowed|must be a select/i);
  });

  /* The whole point of stripping comments before analysis: a write hidden
     behind `--` must not reach the database as a second statement. */
  it("a write smuggled behind a comment", () => {
    expect(reject("select 1 from q_budgets; -- \n delete from q_transactions")).toMatch(
      /one statement|not allowed/i,
    );
  });

  it("a second statement", () => {
    expect(reject("select 1 from q_budgets; select 2 from q_budgets")).toMatch(
      /one statement/i,
    );
  });

  it("a base table, even though RLS would have allowed it", () => {
    expect(reject("select sum(base_total_amount) from transactions")).toMatch(
      /q_transactions|not available/i,
    );
  });

  it("the catalog", () => {
    expect(reject("select * from pg_catalog.pg_tables")).toMatch(/not allowed/i);
  });

  it("information_schema", () => {
    expect(reject("select * from information_schema.columns")).toMatch(/not allowed/i);
  });

  it("the auth schema", () => {
    expect(reject("select * from auth.users")).toMatch(/not allowed/i);
  });

  it("a CTE that shadows nothing but reads a base table", () => {
    expect(
      reject("with x as (select * from accounts) select * from x"),
    ).toMatch(/q_accounts|not available/i);
  });

  it("something that is not a query at all", () => {
    expect(reject("how much did I spend")).toMatch(/must be a select/i);
  });

  it("an empty string", () => {
    expect(reject("   ")).toMatch(/empty/i);
  });
});

/* These are the cases a live probe found, not ones reasoned out in advance.
   `stable` on ask_query refuses DML but happily runs a SELECT that calls a
   volatile function which writes inside itself — so the app's own RPCs were
   reachable from a bare SELECT that trips none of the checks above. */
describe("guardSql — function calls", () => {
  it("rejects the app's own destructive RPC, which no keyword catches", () => {
    /* The exact hole: \bdelete\b finds no word boundary inside
       delete_own_account, and there is no FROM clause to whitelist. */
    expect(reject("select delete_own_account()")).toMatch(/not available/i);
    expect(reject("select public.delete_own_account()")).toMatch(/not allowed|not available/i);
  });

  it.each([
    ["select import_card_statement('{}'::jsonb)"],
    ["select seed_default_categories('00000000-0000-0000-0000-000000000000')"],
    ["select recompute_card_balance('00000000-0000-0000-0000-000000000000')"],
  ])("rejects the writing RPC in %s", (sql) => {
    expect(reject(sql)).toMatch(/not available/i);
  });

  it("rejects a destructive call buried in a subquery", () => {
    expect(
      reject("select (select delete_own_account()) from q_transactions"),
    ).toMatch(/not available/i);
  });

  it("rejects an unknown function rather than assuming it is harmless", () => {
    expect(reject("select pg_sleep(10) from q_transactions")).toMatch(
      /not allowed|not available/i,
    );
    expect(reject("select some_new_rpc() from q_transactions")).toMatch(/not available/i);
  });

  it("rejects any schema-qualified call, even of an allowed function", () => {
    /* The allowlist matches bare names, so a qualified call would leave the
       schema half unexamined. Cheaper to refuse the whole shape. */
    expect(reject("select pg_catalog.sum(budget_spend) from q_transactions")).toMatch(
      /not allowed/i,
    );
  });

  it("still accepts the ordinary vocabulary a real question needs", () => {
    const sql =
      "select date_trunc('month', occurred_at) as m, sum(budget_spend), count(*), round(avg(base_total_amount), 2) from q_transactions where lower(description) like '%uber%' group by 1 order by 1";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("accepts window functions and their keywords", () => {
    const sql =
      "select account, sum(cash_out), row_number() over (partition by account order by sum(cash_out) desc) from q_transactions group by account";
    expect(guardSql(sql).ok).toBe(true);
  });

  it("accepts a type precision, which is not a call", () => {
    expect(guardSql("select cast(budget_spend as numeric(12,2)) from q_transactions").ok).toBe(
      true,
    );
  });

  /* Every one of these was ACCEPTED by the first version of the allowlist.
     A quote between the name and the paren means the call-detection regex
     never sees a call. Found by writing attacks against the finished guard,
     not by reading it — which is why they live here permanently. */
  it.each([
    ['select "delete_own_account"()'],
    ['select public."delete_own_account"()'],
    ['select "public"."delete_own_account"()'],
    ['select 1 from q_transactions where 1 = (select "delete_own_account"())'],
  ])("rejects the quoted-identifier bypass in %s", (sql) => {
    expect(reject(sql)).toMatch(/double-quoted|not available|not allowed/i);
  });

  it.each([
    ["select DELETE_OWN_ACCOUNT()"],
    ["select delete_own_account ()"],
    ["select delete_own_account/**/()"],
    ["select\tdelete_own_account\n()"],
  ])("rejects casing and whitespace variants in %j", (sql) => {
    expect(reject(sql)).toMatch(/not available/i);
  });

  it("accepts a subquery and IN list, whose keywords precede parens", () => {
    const sql =
      "select * from (select category, sum(budget_spend) s from q_transactions where type in ('expense','payment') group by category) x where s > 100";
    expect(guardSql(sql).ok).toBe(true);
  });
});
