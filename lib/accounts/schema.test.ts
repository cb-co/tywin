import { describe, expect, it } from "vitest";
import { accountInput } from "./schema";

describe("accountInput schema - welcome-bonus all-or-none validation", () => {
  // Minimal credit-card fixture with required fields
  const creditCardBase = {
    name: "My Credit Card",
    type: "credit_card" as const,
    currency: "USD",
    credit_limit: 5000,
    statement_closing_day: 1,
    payment_due_day: 21,
  };

  it("allows all three welcome-bonus fields blank (empty strings)", () => {
    const input = {
      ...creditCardBase,
      welcome_bonus_goal_amount: "",
      welcome_bonus_goal_currency: "",
      welcome_bonus_due_date: "",
    };
    const result = accountInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("allows all three welcome-bonus fields omitted", () => {
    const input = creditCardBase;
    const result = accountInput.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("allows all three welcome-bonus fields fully set with valid values", () => {
    const input = {
      ...creditCardBase,
      welcome_bonus_goal_amount: "5000",
      welcome_bonus_goal_currency: "usd", // lowercase gets uppercased
      welcome_bonus_due_date: "2026-12-31",
    };
    const result = accountInput.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.welcome_bonus_goal_amount).toBe(5000);
      expect(result.data.welcome_bonus_goal_currency).toBe("USD");
      expect(result.data.welcome_bonus_due_date).toBe("2026-12-31");
    }
  });

  it("rejects when only welcome_bonus_goal_currency is set", () => {
    const input = {
      ...creditCardBase,
      welcome_bonus_goal_amount: "",
      welcome_bonus_goal_currency: "USD",
      welcome_bonus_due_date: "",
    };
    const result = accountInput.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("welcome_bonus_goal_amount"))).toBe(
        true,
      );
    }
  });

  it("rejects when only welcome_bonus_goal_amount is set", () => {
    const input = {
      ...creditCardBase,
      welcome_bonus_goal_amount: "5000",
      welcome_bonus_goal_currency: "",
      welcome_bonus_due_date: "",
    };
    const result = accountInput.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("welcome_bonus_goal_amount"))).toBe(
        true,
      );
    }
  });
});
