import { describe, expect, it } from "vitest";
import { sumCashbackByCurrency, sumTransferCosts } from "./queries";

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
