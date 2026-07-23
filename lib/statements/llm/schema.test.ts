import { describe, expect, it } from "vitest";
import { StatementSchema } from "./schema";

const VALID = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: "1,000.00",
      closingBalance: "1,425.50",
      balanceToPay: "1,425.50",
      minimumPayment: "142.55",
      overdueAmount: "0.00",
      overdueInstallments: 0,
      creditLimit: "10,000.00",
      availableCredit: "8,574.50",
      interestRateAnnual: 40,
      avgDailyBalance: "1,200.00",
      avgDailyBalancePrior: "0.00",
      costOfCarry: "40.00",
      costOfCarryPrior: "0.00",
      totalDebits: null,
      totalCredits: null,
      lines: [
        {
          madeOn: "2026-05-28",
          postedOn: "2026-05-26",
          reference: "74763946147620851045422",
          description: "MERCADO UNO CIUDAD FALSA",
          mcc: "5411",
          authCode: "045602",
          amount: "500.00",
          kind: "purchase",
          suggestedCategory: "Groceries",
        },
      ],
    },
  ],
};

describe("StatementSchema", () => {
  it("accepts a well-formed statement", () => {
    expect(() => StatementSchema.parse(VALID)).not.toThrow();
  });

  it("rejects an invalid line kind", () => {
    const bad = { ...VALID, sections: [{ ...VALID.sections[0], lines: [{ ...VALID.sections[0].lines[0], kind: "refund" }] }] };
    expect(() => StatementSchema.parse(bad)).toThrow();
  });

  it("rejects a missing required field", () => {
    const { closingBalance, ...rest } = VALID.sections[0];
    const bad = { ...VALID, sections: [rest] };
    expect(() => StatementSchema.parse(bad)).toThrow();
  });
});
