import { describe, expect, test } from "vitest";
import { estimateDestinationAmount, recordedFlags, templateAllowsFees } from "./template";

const flags = { include_tax: true, include_commission: true };

describe("templateAllowsFees", () => {
  test("checking and savings carry fees", () => {
    expect(templateAllowsFees("checking")).toBe(true);
    expect(templateAllowsFees("savings")).toBe(true);
  });

  test("a card, cash, or no account does not", () => {
    expect(templateAllowsFees("credit_card")).toBe(false);
    expect(templateAllowsFees("cash")).toBe(false);
    expect(templateAllowsFees(null)).toBe(false);
  });
});

describe("recordedFlags", () => {
  // The card behaviour from before: no transfer tax, no commission, and the
  // charge stays off the budget because the card payment is what counts.
  test("an expense on a card drops the fees and skips the budget", () => {
    expect(recordedFlags({ kind: "expense", srcType: "credit_card", ...flags })).toEqual({
      include_tax: false,
      include_commission: false,
      exclude_from_budget: true,
    });
  });

  test("an expense from a bank keeps the template's fees and counts", () => {
    expect(recordedFlags({ kind: "expense", srcType: "checking", ...flags })).toEqual({
      include_tax: true,
      include_commission: true,
      exclude_from_budget: false,
    });
    expect(
      recordedFlags({ kind: "expense", srcType: "savings", include_tax: false, include_commission: true }),
    ).toEqual({ include_tax: false, include_commission: true, exclude_from_budget: false });
  });

  // exclude_from_budget is an expense-only flag; transactions/actions zeroes it
  // for payments too.
  test("a payment from a bank keeps its fees and never sets the budget flag", () => {
    expect(recordedFlags({ kind: "payment", srcType: "savings", ...flags })).toEqual({
      include_tax: true,
      include_commission: true,
      exclude_from_budget: false,
    });
  });

  test("a payment from a card carries no fees", () => {
    expect(recordedFlags({ kind: "payment", srcType: "credit_card", ...flags })).toEqual({
      include_tax: false,
      include_commission: false,
      exclude_from_budget: false,
    });
  });
});

describe("estimateDestinationAmount", () => {
  const rates = { USD: 1, DOP: 59.3 };

  test("converts at market, with no spread", () => {
    expect(estimateDestinationAmount({ amount: 100, from: "USD", to: "DOP", rates })).toBeCloseTo(5930, 2);
  });

  test("null when the pair has no rate", () => {
    expect(estimateDestinationAmount({ amount: 100, from: "USD", to: "EUR", rates })).toBeNull();
  });
});
