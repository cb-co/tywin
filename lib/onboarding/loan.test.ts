import { describe, expect, it } from "vitest";
import { accountInput } from "@/lib/accounts/schema";
import { loanAccountFromOnboarding } from "./loan";

const base = {
  name: "Préstamo vehículo",
  currency: "DOP",
  owedToday: "450000",
  installment: "15250.50",
  remainingInstallments: "36",
  dueDay: "15",
  annualRatePercent: "",
};

describe("loanAccountFromOnboarding", () => {
  it("describes the loan from today: owed is principal, remaining is the term", () => {
    const row = loanAccountFromOnboarding(base, "2026-09-18");
    expect(row).toMatchObject({
      type: "loan",
      name: "Préstamo vehículo",
      currency: "DOP",
      principal: 450000,
      installment_amount: 15250.5,
      term_months: 36,
      payment_due_day: 15,
      start_date: "2026-09-18",
      starting_balance: 0,
    });
    expect(row.interest_rate).toBeUndefined();
    expect(row.original_term_months).toBeUndefined();
    expect(accountInput.safeParse(row).success).toBe(true);
  });

  it("turns an annual percent into the fraction the column stores", () => {
    const row = loanAccountFromOnboarding({ ...base, annualRatePercent: "18.5" }, "2026-09-18");
    expect(row.interest_rate).toBeCloseTo(0.185);
  });

  it("leaves the due day unset when blank", () => {
    const row = loanAccountFromOnboarding({ ...base, dueDay: "" }, "2026-09-18");
    expect(row.payment_due_day).toBeUndefined();
    expect(accountInput.safeParse(row).success).toBe(true);
  });

  it("fails validation when a required figure is missing", () => {
    const row = loanAccountFromOnboarding({ ...base, installment: "" }, "2026-09-18");
    expect(accountInput.safeParse(row).success).toBe(false);
  });
});
