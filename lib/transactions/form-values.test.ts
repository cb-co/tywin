import { describe, expect, test } from "vitest";
import { normalizeFormValues, transactionResolver } from "./form-values";
import type { TransactionFormValues } from "./form-values";

function form(overrides: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return {
    type: "payment",
    account_id: "11111111-1111-4111-8111-111111111111",
    to_account_id: "22222222-2222-4222-8222-222222222222",
    category_id: "none",
    amount: "100",
    transfer_rate: "",
    include_tax: false,
    include_commission: false,
    exclude_from_budget: false,
    occurred_at: "2026-07-28",
    description: "",
    notes: "",
    ...overrides,
  };
}

const resolve = (values: TransactionFormValues) =>
  transactionResolver()(values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  } as never);

describe("normalizeFormValues", () => {
  test("flattens the category Select's 'none' sentinel", () => {
    expect(normalizeFormValues(form({ category_id: "none" })).category_id).toBe("");
  });

  test("leaves a real category id alone", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(normalizeFormValues(form({ type: "expense", category_id: id })).category_id).toBe(id);
  });

  test("clears category_id for income regardless of what's in it", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(normalizeFormValues(form({ type: "income", category_id: id })).category_id).toBe("");
  });

  test("passes notes through untouched", () => {
    const note = "Peaje Autopista Duarte";
    expect(normalizeFormValues(form({ notes: note })).notes).toBe(note);
  });
});

describe("transactionResolver", () => {
  /* A fresh payment defaults category_id to "none" (see transaction-form.tsx) so
   * the Select has something to show. Submitting one without ever touching that
   * field used to fail validation with "Invalid uuid" — the schema only accepts a
   * real uuid or "", never the sentinel the Select itself put there. */
  test("does not reject a payment left on the 'no category' sentinel", async () => {
    const result = await resolve(form({ category_id: "none" }));
    expect(result.errors).toEqual({});
  });

  test("hands the valid callback the sentinel back, not the flattened value", async () => {
    const result = await resolve(form({ category_id: "none" }));
    expect(result.values?.category_id).toBe("none");
  });

  test("still rejects a genuinely invalid category id", async () => {
    const result = await resolve(form({ type: "expense", category_id: "not-a-uuid" }));
    expect(result.errors.category_id).toBeTruthy();
  });
});
