import { test, expect } from "vitest";
import { buildSchedule } from "./amortization";

test("zero-interest loan divides evenly and ends at zero", () => {
  const s = buildSchedule({ principal: 1200, annualRate: 0, termMonths: 12 });
  expect(s).toHaveLength(12);
  expect(s[0].payment).toBeCloseTo(100, 2);
  expect(s[0].interest).toBe(0);
  expect(s.at(-1)!.balance).toBeCloseTo(0, 2);
});

test("interest-bearing loan amortizes to zero with correct first interest", () => {
  const s = buildSchedule({ principal: 10000, annualRate: 0.12, termMonths: 24 });
  expect(s).toHaveLength(24);
  expect(s[0].interest).toBeCloseTo(100, 2); // 10000 * (0.12/12)
  expect(s.at(-1)!.balance).toBeCloseTo(0, 1);
});

test("explicit installment is honored and can finish early", () => {
  const s = buildSchedule({
    principal: 1000,
    annualRate: 0,
    termMonths: 12,
    installment: 300,
  });
  // 1000 / 300 -> pays off in 4 months (300,300,300,100)
  expect(s).toHaveLength(4);
  expect(s.at(-1)!.payment).toBeCloseTo(100, 2);
  expect(s.at(-1)!.balance).toBeCloseTo(0, 2);
});

test("invalid inputs yield an empty schedule", () => {
  expect(buildSchedule({ principal: 0, annualRate: 0.1, termMonths: 12 })).toEqual([]);
  expect(buildSchedule({ principal: 1000, annualRate: 0.1, termMonths: 0 })).toEqual([]);
});
