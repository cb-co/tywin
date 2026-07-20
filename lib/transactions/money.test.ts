import { describe, expect, test } from "vitest";
import { destinationAmount, invertRate, round4 } from "./money";

/* A payment between two currencies has two legs, each denominated in its own
 * account's currency. The original model carried a single `amount` and applied
 * it verbatim to both legs, so a 10,000 DOP payment out of a USD account took
 * 10,000 USD off the source. These helpers produce the destination leg. */

describe("round4", () => {
  test("matches the numeric(18,4) the DB stores", () => {
    expect(round4(1742.00005)).toBe(1742.0001);
    expect(round4(0.123456)).toBe(0.1235);
    expect(round4(10000)).toBe(10000);
  });
});

describe("invertRate", () => {
  /* The form shows "1 USD = 5.741 DOP" (whole-ish numbers, dollar first) while
   * the DB stores base-per-unit — the reciprocal. */
  test("round-trips a rate through display and back", () => {
    const stored = 0.1742;
    const shown = invertRate(stored);
    expect(shown).toBeCloseTo(5.7405, 3);
    expect(invertRate(shown)).toBeCloseTo(stored, 8);
  });

  test("leaves parity alone", () => {
    expect(invertRate(1)).toBe(1);
  });

  test("refuses a non-positive rate rather than returning Infinity", () => {
    expect(() => invertRate(0)).toThrow();
    expect(() => invertRate(-2)).toThrow();
  });
});

describe("destinationAmount", () => {
  /* The reported bug, as a test: 1742 USD out of Main, at 5.741 DOP per USD,
   * must land 10,000 DOP in Santa Cruz — not 1742. */
  test("converts the source amount into destination currency", () => {
    expect(destinationAmount(1742, 5.741)).toBe(10000.822);
  });

  test("is identity at rate 1 (same-currency payment)", () => {
    expect(destinationAmount(10000, 1)).toBe(10000);
  });

  test("rounds to 4dp", () => {
    expect(destinationAmount(100, 1.23456789)).toBe(123.4568);
  });

  test("refuses a non-positive rate", () => {
    expect(() => destinationAmount(100, 0)).toThrow();
  });
});
