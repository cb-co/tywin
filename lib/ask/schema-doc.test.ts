import { describe, expect, it } from "vitest";
import { schemaDoc, documentedColumns } from "./schema-doc";
import { ALLOWED_RELATIONS } from "./guard";

describe("schemaDoc", () => {
  it("names every whitelisted view", () => {
    const doc = schemaDoc();
    for (const view of ALLOWED_RELATIONS) expect(doc).toContain(view);
  });

  /* The document is prose and the views are SQL, so nothing forces them to
     agree. Drift shows up as the model confidently selecting a column that
     used to exist, which reads as a model failure and is not one. */
  it("documents every whitelisted view and its key columns", () => {
    const documented = documentedColumns();
    expect([...documented.keys()].sort()).toEqual([...ALLOWED_RELATIONS].sort());

    // Every documented view must document at least its key columns.
    expect(documented.get("q_transactions")).toContain("budget_spend");
    expect(documented.get("q_transactions")).toContain("cash_out");
    expect(documented.get("q_accounts")).toContain("last4");
    expect(documented.get("q_budgets")).toContain("remaining");
  });

  it("tells the model which column answers a spending question", () => {
    expect(schemaDoc()).toMatch(/budget_spend[\s\S]{0,200}how much did I spend/i);
  });
});
