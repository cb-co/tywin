import { describe, expect, it } from "vitest";
import { toParsedStatement } from "./extract";
import { validateChecksums } from "../validate";
import type { LlmStatement } from "./schema";

const WITH_LINES: LlmStatement = {
  cardNetwork: "visa",
  cardLast4: "1234",
  sections: [
    {
      sectionKey: "DOP",
      currency: "DOP",
      periodEnd: "2026-06-25",
      dueDate: "2026-07-20",
      previousBalance: "1,000.00",
      closingBalance: "1,375.50",
      balanceToPay: "1,375.50",
      minimumPayment: "137.55",
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
          madeOn: "2026-05-28", postedOn: "2026-05-26", reference: "REF1",
          description: "MERCADO UNO", mcc: "5411", authCode: "045602",
          amount: "500.00", kind: "purchase", suggestedCategory: "Groceries",
        },
        {
          madeOn: "2026-06-05", postedOn: "2026-06-03", reference: "REF2",
          description: "Pago via SPE", mcc: null, authCode: null,
          amount: "-200.00", kind: "payment", suggestedCategory: null,
        },
        {
          madeOn: "2026-06-10", postedOn: "2026-06-09", reference: "REF3",
          description: "RESTAURANTE TRES", mcc: "5812", authCode: "013148",
          amount: "75.50", kind: "purchase", suggestedCategory: "Dining",
        },
      ],
    },
  ],
};

const LINE_LESS: LlmStatement = {
  cardNetwork: "amex",
  cardLast4: "6760",
  sections: [
    {
      sectionKey: "DOP_CUOTAS",
      currency: "DOP",
      periodEnd: "2026-07-15",
      dueDate: "2026-08-10",
      previousBalance: "0.00",
      closingBalance: "800.00",
      balanceToPay: "800.00",
      minimumPayment: "80.00",
      overdueAmount: null,
      overdueInstallments: null,
      creditLimit: "20,000.00",
      availableCredit: null,
      interestRateAnnual: null,
      avgDailyBalance: "650.00",
      avgDailyBalancePrior: "0.00",
      costOfCarry: null,
      costOfCarryPrior: null,
      totalDebits: "1,300.00",
      totalCredits: "500.00",
      lines: [],
    },
  ],
};

describe("toParsedStatement", () => {
  it("derives a stable parserId from network + last4 + currencies", () => {
    expect(toParsedStatement(WITH_LINES).parserId).toBe("visa_1234_dop");
  });

  it("computes totals from lines when lines is non-empty, ignoring the LLM's totals", () => {
    const parsed = toParsedStatement(WITH_LINES);
    const s = parsed.sections[0];
    expect(s.totalDebitsCents).toBe(57550); // 500.00 + 75.50
    expect(s.totalCreditsCents).toBe(20000); // |-200.00|
  });

  it("assigns lineNo by index and passes suggestedCategory through", () => {
    const lines = toParsedStatement(WITH_LINES).sections[0].lines;
    expect(lines.map((l) => l.lineNo)).toEqual([1, 2, 3]);
    expect(lines[0].suggestedCategory).toBe("Groceries");
    expect(lines[1].suggestedCategory).toBeNull();
  });

  it("computes periodStart from periodEnd", () => {
    expect(toParsedStatement(WITH_LINES).sections[0].periodStart).toBe("2026-05-26");
  });

  it("passes checksums for a statement with lines", () => {
    expect(validateChecksums(toParsedStatement(WITH_LINES))).toEqual([]);
  });

  it("falls back to the LLM's totalDebits/totalCredits for a line-less section", () => {
    const s = toParsedStatement(LINE_LESS).sections[0];
    expect(s.totalDebitsCents).toBe(130000);
    expect(s.totalCreditsCents).toBe(50000);
    expect(s.lines).toEqual([]);
  });

  it("passes checksums for a line-less section", () => {
    expect(validateChecksums(toParsedStatement(LINE_LESS))).toEqual([]);
  });
});
