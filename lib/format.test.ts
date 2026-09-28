import { expect, test } from "vitest";
import { currencyLabel, formatDate, formatMoney } from "./format";

test("formats an ISO date in the given locale", () => {
  expect(formatDate("2026-07-22", "en")).toBe("Jul 22, 2026");
  expect(formatDate("2026-07-22", "es")).toBe("22 jul 2026");
});

test("never shifts the date across a UTC-offset boundary", () => {
  // A date-only string must render the same calendar day regardless of the
  // machine's local timezone — this is what timeZone: "UTC" buys us.
  const result = formatDate("2026-01-01", "en");
  expect(result).toBe("Jan 1, 2026");
});

test("accepts custom Intl.DateTimeFormat options", () => {
  expect(formatDate("2026-07-22", "en", { month: "short", day: "numeric" })).toBe("Jul 22");
});

// A label has to match the symbol the amounts print with, or the same peso
// reads as "DOP" in a subtitle and "RD$" in the figure beside it.
test("labels DOP with the same RD$ the amounts use", () => {
  expect(currencyLabel("DOP")).toBe("RD$");
  expect(formatMoney(1, "DOP").startsWith(currencyLabel("DOP"))).toBe(true);
});

// en-US would print a bare "$" for these, which cannot tell USD from DOP.
test("keeps the ISO code for every other currency", () => {
  expect(currencyLabel("USD")).toBe("USD");
  expect(currencyLabel("EUR")).toBe("EUR");
});
