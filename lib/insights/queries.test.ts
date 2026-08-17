import { describe, expect, it } from "vitest";
import { buildCardFeeLines, buildLoanInterest, sumCashbackByCurrency, sumTransferCosts } from "./queries";
import type { FeeLineRow } from "@/lib/accounts/card-fees";

describe("sumCashbackByCurrency", () => {
  it("groups multiple currencies and sums each one separately", () => {
    const result = sumCashbackByCurrency([
      { currency: "USD", total: 10 },
      { currency: "DOP", total: 500 },
      { currency: "USD", total: 5 },
    ]);
    expect(result).toEqual([
      ["USD", 15],
      ["DOP", 500],
    ]);
  });

  it("returns a single entry when every line shares one currency", () => {
    const result = sumCashbackByCurrency([
      { currency: "USD", total: 10 },
      { currency: "USD", total: 20 },
    ]);
    expect(result).toEqual([["USD", 30]]);
  });

  it("returns an empty array for no lines", () => {
    expect(sumCashbackByCurrency([])).toEqual([]);
  });
});

describe("sumTransferCosts", () => {
  it("sums fee and tax separately, each weighted by its own row's exchange rate", () => {
    const result = sumTransferCosts([
      { fee_amount: 5, tax_amount: 2, exchange_rate: 1 },
      { fee_amount: 10, tax_amount: 4, exchange_rate: 60 },
    ]);
    // 5*1 + 10*60 = 605 ; 2*1 + 4*60 = 242
    expect(result.totalFeesBase).toBe(605);
    expect(result.totalTaxBase).toBe(242);
  });

  it("treats a null fee, tax, or rate as zero fee/tax and a 1:1 rate", () => {
    const result = sumTransferCosts([{ fee_amount: null, tax_amount: null, exchange_rate: null }]);
    expect(result).toEqual({ totalFeesBase: 0, totalTaxBase: 0 });
  });

  it("returns zero for no rows", () => {
    expect(sumTransferCosts([])).toEqual({ totalFeesBase: 0, totalTaxBase: 0 });
  });

  it("rounds each total to two decimal places", () => {
    const result = sumTransferCosts([{ fee_amount: 1, tax_amount: 1, exchange_rate: 1 / 3 }]);
    expect(result.totalFeesBase).toBe(0.33);
    expect(result.totalTaxBase).toBe(0.33);
  });
});

describe("buildLoanInterest", () => {
  const loan = (over: Record<string, unknown> = {}) => ({
    id: "loan",
    name: "Car loan",
    currency: "USD",
    principal: 10000,
    interest_rate: 0.12,
    term_months: 12,
    ...over,
  });
  const pay = (to: string, amount: number, date: string, toAmount: number | null = null) => ({
    to_account_id: to,
    amount,
    to_amount: toAmount,
    occurred_at: `${date}T12:00:00+00:00`,
  });
  const build = (over: Partial<Parameters<typeof buildLoanInterest>[0]> = {}) =>
    buildLoanInterest({
      year: 2026,
      baseCurrency: "USD",
      rates: {},
      loans: [loan()],
      payments: [],
      ...over,
    });

  it("reports the interest component of each loan's most recent payment", () => {
    // 1% monthly on 10000 is 100; the second payment is charged on 9100.
    const result = build({
      payments: [pay("loan", 1000, "2026-03-05"), pay("loan", 1000, "2026-04-05")],
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].lastInterest).toBe(91);
    expect(result.lines[0].lastPaymentDate).toBe("2026-04-05");
  });

  it("states the annual rate as a percentage", () => {
    const result = build({ payments: [pay("loan", 1000, "2026-03-05")] });
    expect(result.lines[0].apr).toBe(12);
  });

  it("counts only this year's interest but amortizes from the first payment ever", () => {
    // Splitting only the 2026 payment would charge it 100 (1% of the full
    // principal) instead of 91 — the 2025 payment has to run first even though
    // its own interest is not counted.
    const result = build({
      payments: [pay("loan", 1000, "2025-12-05"), pay("loan", 1000, "2026-01-05")],
    });
    expect(result.lines[0].yearInterest).toBe(91);
    expect(result.yearBase).toBe(91);
  });

  it("omits a loan with no payments logged against it", () => {
    expect(build({ payments: [] }).lines).toEqual([]);
  });

  it("omits a loan that has been paid off", () => {
    const result = build({
      loans: [loan({ principal: 500, term_months: null })],
      payments: [pay("loan", 9999, "2026-03-05")],
    });
    expect(result.lines).toEqual([]);
  });

  it("keeps each row in the loan's own currency and totals in base", () => {
    const result = build({
      baseCurrency: "USD",
      rates: { DOP: 60 },
      loans: [loan({ currency: "DOP", principal: 60000 })],
      payments: [pay("loan", 6000, "2026-03-05")],
    });
    // 1% of 60000 is 600 pesos, which is 10 dollars at 60 to the dollar.
    expect(result.lines[0].lastInterest).toBe(600);
    expect(result.lines[0].currency).toBe("DOP");
    expect(result.monthlyBase).toBe(10);
  });

  it("orders the loans by what they currently cost", () => {
    const result = build({
      loans: [loan({ id: "small", principal: 1000 }), loan({ id: "big", principal: 50000 })],
      payments: [pay("small", 200, "2026-03-05"), pay("big", 2000, "2026-03-05")],
    });
    expect(result.lines.map((l) => l.accountId)).toEqual(["big", "small"]);
  });

  it("sums the monthly run-rate across loans", () => {
    const result = build({
      loans: [loan({ id: "a" }), loan({ id: "b", principal: 20000 })],
      payments: [pay("a", 1000, "2026-03-05"), pay("b", 1000, "2026-03-05")],
    });
    expect(result.monthlyBase).toBe(300); // 100 + 200
  });

  it("ignores payments made into a different loan", () => {
    const result = build({ payments: [pay("other", 1000, "2026-03-05")] });
    expect(result.lines).toEqual([]);
  });
});

describe("buildCardFeeLines", () => {
  const accounts = [
    { id: "a1", name: "Visa Infinite", currency: "DOP", card_group_id: null },
    { id: "a2", name: "USD", currency: "USD", card_group_id: "g1" },
    { id: "a3", name: "Clean Card", currency: "DOP", card_group_id: null },
  ];
  const groupName = new Map([["g1", "Platinum"]]);

  const rows = new Map<string, FeeLineRow[]>([
    ["a1", [
      { description: "CARGO SEGURO FRAUDE", amount: 350, kind: "fee", posted_on: "2026-06-26" },
      { description: "CARGO SOBREGIRO", amount: 500, kind: "fee", posted_on: "2026-06-25" },
    ]],
    ["a2", [
      { description: "ANNUAL FEE", amount: 99, kind: "fee", posted_on: "2026-03-01" },
    ]],
  ]);

  it("builds one line per card that was charged something", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines).toEqual([
      { accountId: "a1", name: "Visa Infinite", currency: "DOP", recurring: 350, incidents: 500 },
      { accountId: "a2", name: "Platinum — USD", currency: "USD", recurring: 99, incidents: 0 },
    ]);
  });

  // Silence, not zeros: a3 has no fee rows and must not appear at all.
  it("omits a card with no fee lines rather than showing it at zero", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines.map((l) => l.accountId)).not.toContain("a3");
  });

  it("sorts by recurring cost, heaviest first", () => {
    const lines = buildCardFeeLines(rows, accounts, groupName, 2026);
    expect(lines.map((l) => l.recurring)).toEqual([350, 99]);
  });

  it("is empty for a year with no charges", () => {
    expect(buildCardFeeLines(rows, accounts, groupName, 2025)).toEqual([]);
  });
});
