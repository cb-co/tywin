import { describe, expect, it } from "vitest";
import { scotiaAmex } from "./scotia-amex";
import { SCOTIA_FIXTURE } from "../fixtures/scotia-amex";
import { validateChecksums } from "../validate";

describe("scotiaAmex.detect", () => {
  it("recognizes the RNC fingerprint", () => {
    expect(scotiaAmex.detect(SCOTIA_FIXTURE)).toBe(true);
    expect(scotiaAmex.detect("RNC 101010632 Banco Popular")).toBe(false);
  });
});

describe("scotiaAmex.parse", () => {
  const parsed = scotiaAmex.parse(SCOTIA_FIXTURE);
  const byKey = Object.fromEntries(parsed.sections.map((s) => [s.sectionKey, s]));

  it("emits DOP, USD and CUOTAS_DOP sections", () => {
    expect(parsed.parserId).toBe("scotia_amex");
    expect(parsed.cardLast4).toBe("6760");
    expect(parsed.sections.map((s) => s.sectionKey).sort()).toEqual(
      ["CUOTAS_DOP", "DOP", "USD"],
    );
    expect(byKey.USD.currency).toBe("USD");
    expect(byKey.CUOTAS_DOP.currency).toBe("DOP");
  });

  it("reads period, limits, minimums per section", () => {
    expect(byKey.DOP.periodEnd).toBe("2026-07-15");
    expect(byKey.DOP.periodStart).toBe("2026-06-16");
    expect(byKey.DOP.dueDate).toBe("2026-08-10");
    expect(byKey.DOP.creditLimitCents).toBe(2000000);
    expect(byKey.DOP.minimumPaymentCents).toBe(8000);
    expect(byKey.USD.creditLimitCents).toBe(100000);
    expect(byKey.CUOTAS_DOP.creditLimitCents).toBe(500000);
  });

  it("parses lines with kinds and dates (made = fecha de trans)", () => {
    expect(byKey.DOP.lines).toHaveLength(3);
    const [seguro, tienda, pago] = byKey.DOP.lines;
    expect(seguro).toMatchObject({
      kind: "fee", amountCents: 30000,
      madeOn: "2026-06-26", postedOn: "2026-06-26", mcc: null, reference: null,
    });
    expect(tienda).toMatchObject({ kind: "purchase", amountCents: 100000 });
    expect(pago).toMatchObject({ kind: "payment", amountCents: -50000 });
    expect(byKey.USD.lines).toHaveLength(3);
    expect(byKey.USD.lines[2].kind).toBe("payment");
    expect(byKey.CUOTAS_DOP.lines).toHaveLength(0);
  });

  it("reads per-section closing balance and cost of carry", () => {
    expect(byKey.DOP.closingBalanceCents).toBe(80000);
    expect(byKey.DOP.costOfCarryCents).toBe(2957);
    expect(byKey.DOP.avgDailyBalanceCents).toBe(65000);
    expect(byKey.DOP.interestRateAnnual).toBe(60);
    expect(byKey.USD.closingBalanceCents).toBe(3498);
    expect(byKey.USD.costOfCarryCents).toBe(100);
    expect(byKey.CUOTAS_DOP.closingBalanceCents).toBe(0);
  });

  it("passes checksums on every section", () => {
    expect(validateChecksums(parsed)).toEqual([]);
  });

  it("fails loudly instead of attributing a trailing coupon's balance to a section whose real footer was lost", () => {
    // Strip USD's real "Balance al Corte" footer (simulating a page break that
    // separates a section's transactions from its footer) and splice in a
    // payment-coupon boilerplate line carrying a same-labeled but bogus value.
    // Without the `current` reset, 999.99 would silently become USD's
    // closingBalanceCents; with it, USD is line-bearing with no captured
    // footer and the parser must throw rather than fall back silently.
    const usdStart = SCOTIA_FIXTURE.indexOf("Detalle Transacciones en D");
    const usdFooterAt = SCOTIA_FIXTURE.indexOf("Balance al Corte", usdStart);
    const base = SCOTIA_FIXTURE.slice(0, usdFooterAt).replace(/[^\n]*$/, "");
    const doc = base +
      "\n             Desprenda esta porción para hacer su pago\n" +
      "             Balance al Corte                                                 999.99\n";
    expect(() => scotiaAmex.parse(doc)).toThrow(/missing footer for section USD/);
  });
});
