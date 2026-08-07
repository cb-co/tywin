import { describe, expect, it } from "vitest";
import { APICallError, RetryError } from "ai";
import { isRateLimitError, toParsedStatement } from "./extract";
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
      totalCashback: "328.00",
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
      totalCashback: null,
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

  /* `ParsedSection.currency` is declared ISO 4217 and consumed as one — the preview
     hands it to Intl.NumberFormat, confirm compares it against the account's currency,
     and fx looks up a rate by it. A statement that prints only "RD$" and never "DOP"
     got the symbol transcribed into it verbatim, and Intl threw RangeError on render. */
  describe("currency", () => {
    const withCurrency = (currency: string, sectionKey = currency): LlmStatement => ({
      ...WITH_LINES,
      sections: [{ ...WITH_LINES.sections[0], currency, sectionKey }],
    });

    it("normalizes a transcribed symbol to its ISO code", () => {
      expect(toParsedStatement(withCurrency("RD$")).sections[0].currency).toBe("DOP");
    });

    it("normalizes the currency the parserId is built from", () => {
      expect(toParsedStatement(withCurrency("RD$")).parserId).toBe("visa_1234_dop");
    });

    /* sectionKey is persisted in statement_section_mappings to make future imports
       zero-touch, so a key built on the symbol would miss every saved mapping the
       moment the model transcribes the ISO code instead. */
    it("rewrites the sectionKey the symbol leaked into", () => {
      expect(toParsedStatement(withCurrency("RD$")).sections[0].sectionKey).toBe("DOP");
      expect(toParsedStatement(withCurrency("RD$", "RD$_CUOTAS")).sections[0].sectionKey).toBe(
        "DOP_CUOTAS",
      );
    });

    it("leaves a sectionKey that never held the raw currency alone", () => {
      expect(toParsedStatement(withCurrency("RD$", "DOP_CUOTAS")).sections[0].sectionKey).toBe(
        "DOP_CUOTAS",
      );
    });

    /* Loud, not silent: extractAndParse catches this into a failed_detection row and
       shows parseFailed, the same as an unparseable amount. Importing a statement
       under a guessed currency would corrupt the balances it anchors. */
    it("throws on a currency it cannot resolve", () => {
      expect(() => toParsedStatement(withCurrency("$"))).toThrow(/currency/i);
    });
  });

  describe("cashback", () => {
    const withCashback = (totalCashback: string | null): LlmStatement => ({
      ...LINE_LESS,
      sections: [{ ...LINE_LESS.sections[0], totalCashback }],
    });
    const cents = (raw: string | null) =>
      toParsedStatement(withCashback(raw)).sections[0].cashbackCents;

    it("carries the reported figure through as cents", () => {
      expect(cents("328.00")).toBe(32800);
      expect(cents("1,240.50")).toBe(124050);
    });

    it("reports an unreported figure as null rather than zero", () => {
      // Distinguishes "the statement said nothing" from "the statement said
      // zero" — only the latter proves cashback was actually read.
      expect(cents(null)).toBeNull();
      expect(cents("")).toBeNull();
      expect(cents("0.00")).toBe(0);
    });

    it("takes the magnitude when the model transcribes the source's minus sign", () => {
      // The lines it is read off ARE negative; -328.00 is still 328.00 earned.
      expect(cents("-328.00")).toBe(32800);
    });

    it("drops an unparseable figure instead of failing the whole statement", () => {
      // Cashback feeds no checksum, so a bad value here must not take a
      // statement's balances and transactions down with it.
      expect(cents("N/A")).toBeNull();
      expect(cents("RD$328")).toBeNull();
    });

    it("leaves the rest of the section intact when cashback is dropped", () => {
      const parsed = toParsedStatement(withCashback("N/A"));
      expect(parsed.sections[0].totalDebitsCents).toBe(130000);
      expect(parsed.sections[0].closingBalanceCents).toBe(80000);
      expect(validateChecksums(parsed)).toEqual([]);
    });
  });
});

describe("isRateLimitError", () => {
  const apiError = (statusCode: number) =>
    new APICallError({ message: "failed", url: "https://example.com", requestBodyValues: {}, statusCode });

  it("recognizes a 429 APICallError", () => {
    expect(isRateLimitError(apiError(429))).toBe(true);
  });

  it("recognizes a 429 buried in a RetryError once the SDK's own retries are exhausted", () => {
    const retry = new RetryError({ message: "max retries exceeded", reason: "maxRetriesExceeded", errors: [apiError(429)] });
    expect(isRateLimitError(retry)).toBe(true);
  });

  it("rejects a non-429 APICallError", () => {
    expect(isRateLimitError(apiError(500))).toBe(false);
  });

  it("rejects a plain, non-AI-SDK error", () => {
    expect(isRateLimitError(new Error("boom"))).toBe(false);
  });
});
