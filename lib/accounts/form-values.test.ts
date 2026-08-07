import { describe, expect, test } from "vitest";
import { accountResolver, blankToUndefined, normalizeFormValues } from "./form-values";
import type { AccountFormValues } from "./form-values";

function form(overrides: Partial<AccountFormValues> = {}): AccountFormValues {
  return {
    name: "Sapphire Preferred",
    type: "credit_card",
    currency: "USD",
    bank_id: "none",
    starting_balance: "0",
    transfer_tax_rate: "0.002",
    network_fee_amount: "0",
    network_fee_optional: true,
    credit_limit: "5000",
    last4: "",
    statement_closing_day: "12",
    payment_due_day: "5",
    current_balance: "0",
    card_group_id: "none",
    welcome_bonus_goal_amount: "",
    welcome_bonus_goal_currency: "",
    welcome_bonus_due_date: "",
    has_welcome_bonus_goal: false,
    principal: "",
    interest_rate: "",
    term_months: "",
    original_term_months: "",
    start_date: "",
    installment_amount: "",
    ...overrides,
  };
}

const resolve = (values: AccountFormValues) =>
  accountResolver()(values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  } as never);

describe("normalizeFormValues", () => {
  test("flattens the Select sentinels the schema can't accept", () => {
    const out = normalizeFormValues(form({ bank_id: "new", card_group_id: "none" }));
    expect(out.bank_id).toBe("");
    expect(out.card_group_id).toBe("");
  });

  test("clears the welcome-bonus trio when the toggle is off", () => {
    const out = normalizeFormValues(
      form({
        has_welcome_bonus_goal: false,
        welcome_bonus_goal_amount: "4000",
        welcome_bonus_goal_currency: "USD",
        welcome_bonus_due_date: "2026-01-01",
      }),
    );
    expect(out.welcome_bonus_goal_amount).toBe("");
    expect(out.welcome_bonus_goal_currency).toBe("");
    expect(out.welcome_bonus_due_date).toBe("");
  });
});

describe("blankToUndefined", () => {
  test("turns every empty string into undefined", () => {
    expect(blankToUndefined({ a: "", b: "x", c: 0, d: false })).toEqual({
      a: undefined,
      b: "x",
      c: 0,
      d: false,
    });
  });
});

describe("accountResolver", () => {
  /* The regression this file exists for. The dialog's onSubmit branches on
     `card_group_id === "new"` / `bank_id === "new"` to create the group or bank before
     saving; a resolver that hands back its own cleaned input flattens both to "" first, so
     "New group…"/"New bank…" saved an unlinked account and dropped the typed name. */
  test("hands back the raw values, sentinels intact, on success", async () => {
    const values = form({ bank_id: "new", card_group_id: "new" });
    const { values: out, errors } = await resolve(values);
    expect(errors).toEqual({});
    expect(out).toEqual(values);
  });

  test("does not coerce or strip form-only fields", async () => {
    const { values: out } = await resolve(form({ has_welcome_bonus_goal: false }));
    // Strings stay strings (the schema would have coerced them to numbers) and
    // `has_welcome_bonus_goal` survives even though `accountInput` has no such field.
    expect(out.credit_limit).toBe("5000");
    expect(out).toHaveProperty("has_welcome_bonus_goal", false);
  });

  test("validates against the cleaned values, so a sentinel is not a uuid error", async () => {
    const { errors } = await resolve(form({ bank_id: "new", card_group_id: "new" }));
    expect(errors).not.toHaveProperty("bank_id");
    expect(errors).not.toHaveProperty("card_group_id");
  });

  test("still reports real errors and withholds values", async () => {
    const { values: out, errors } = await resolve(form({ credit_limit: "" }));
    expect(errors).toHaveProperty("credit_limit");
    expect(out).toEqual({});
  });

  test("keeps a leftover bonus value from erroring once the toggle is off", async () => {
    const { errors } = await resolve(
      form({ has_welcome_bonus_goal: false, welcome_bonus_goal_amount: "4000" }),
    );
    expect(errors).toEqual({});
  });
});
