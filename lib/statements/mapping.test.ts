import { describe, expect, it } from "vitest";
import { suggestAccountId } from "./mapping";

const options = [
  { id: "dop-main", name: "AMEX DOP", currency: "DOP", credit_limit: 624400 },
  { id: "usd", name: "AMEX USD", currency: "USD", credit_limit: 6036 },
  { id: "cuotas", name: "AMEX Cuotas", currency: "DOP", credit_limit: 40000 },
];

describe("suggestAccountId", () => {
  it("matches by currency when unambiguous", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: 603600 }, options)).toBe("usd");
  });
  it("disambiguates same-currency lines by nearest credit limit", () => {
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 62440000 }, options)).toBe("dop-main");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: 4000000 }, options)).toBe("cuotas");
  });
  it("returns null when no option shares the currency", () => {
    expect(suggestAccountId({ currency: "EUR", creditLimitCents: null }, options)).toBeNull();
  });
  it("without a statement limit, picks the sole currency match or null", () => {
    expect(suggestAccountId({ currency: "USD", creditLimitCents: null }, options)).toBe("usd");
    expect(suggestAccountId({ currency: "DOP", creditLimitCents: null }, options)).toBeNull();
  });
});
